process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://greenstore:greenstore@localhost:5432/greenstore_test";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost";
process.env.METRICS_ENABLED = "false";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { app, db } = require("../server");

const loadSql = (file) => fs.readFileSync(path.join(__dirname, "..", "migrations", file), "utf-8");
const migrationFiles = fs
  .readdirSync(path.join(__dirname, "..", "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row?.id);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

const resetDatabase = () =>
  new Promise((resolve, reject) => {
    db.exec(
      `
      DELETE FROM stock_movements;
      DELETE FROM stock_losses;
      DELETE FROM sales;
      DELETE FROM purchase_order_items;
      DELETE FROM purchase_orders;
      DELETE FROM pos_devices;
      DELETE FROM approvals;
      DELETE FROM password_resets;
      DELETE FROM sessions;
      DELETE FROM login_attempts;
      DELETE FROM request_metrics;
      DELETE FROM alerts;
      DELETE FROM settings;
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM suppliers;
      DELETE FROM users;
      `,
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      }
    );
  });

const createUserWithSession = async ({ role, email }) => {
  const passwordHash = bcrypt.hashSync("senha1234", 10);
  const userId = await run(
    "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id",
    [`User ${role}`, email, passwordHash, role]
  );
  const token = jwt.sign(
    { id: userId, name: `User ${role}`, email, role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
  await run("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [userId, token]);
  return { userId, token };
};

const createProduct = async ({ stock, price }) => {
  const categoryId = await run("INSERT INTO categories (name) VALUES (?) RETURNING id", ["Legumes"]);
  const productId = await run(
    `INSERT INTO products (name, sku, unit_type, category_id, min_stock, max_stock, current_stock, price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ["Tomate", "SKU-002", "kg", categoryId, 0, 100, stock, price]
  );
  return { productId, categoryId };
};

beforeAll((done) => {
  const sql = migrationFiles.map((file) => loadSql(file)).join("\n");
  db.exec(sql, done);
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll((done) => {
  db.close(done);
});

describe("approvals and alerts flows", () => {
  it("requires approval for large stock adjustments", async () => {
    const { token: supervisorToken } = await createUserWithSession({
      role: "supervisor",
      email: "supervisor@example.com",
    });
    const managerPassword = "senha1234";
    await createUserWithSession({ role: "manager", email: "manager@example.com" });
    await run(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [bcrypt.hashSync(managerPassword, 10), "manager@example.com"]
    );
    const { productId } = await createProduct({ stock: 10, price: 10 });
    await run("INSERT INTO settings (key, value) VALUES (?, ?)", ["max_stock_adjust", "5"]);

    const approvalResponse = await request(app)
      .post("/api/approvals")
      .send({
        email: "manager@example.com",
        password: managerPassword,
        action: "stock_adjust",
        reason: "Ajuste crítico",
      });

    expect(approvalResponse.status).toBe(201);
    const approvalToken = approvalResponse.body.token;

    const adjustResponse = await request(app)
      .post("/api/stock/adjust")
      .set("Authorization", `Bearer ${supervisorToken}`)
      .set("x-approval-token", approvalToken)
      .send({ product_id: productId, delta: 2, reason: "Inventário" });

    expect(adjustResponse.status).toBe(200);
    const audit = await get("SELECT approved_by FROM audit_logs WHERE action = ?", ["stock_adjust"]);
    expect(audit.approved_by).toBeTruthy();
  });

  it("lists recent alerts for admins", async () => {
    const { token: adminToken } = await createUserWithSession({
      role: "admin",
      email: "admin@example.com",
    });
    await run("INSERT INTO alerts (level, message, context) VALUES (?, ?, ?::jsonb)", [
      "warning",
      "Teste",
      JSON.stringify({ key: "value" }),
    ]);

    const response = await request(app)
      .get("/api/alerts")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].message).toBe("Teste");
  });
});
