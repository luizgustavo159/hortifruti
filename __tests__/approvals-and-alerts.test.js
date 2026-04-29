process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
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
      DELETE FROM cash_movements;
      DELETE FROM cash_sessions;
      DELETE FROM finance_transactions;
      DELETE FROM finance_accounts;
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
      DELETE FROM audit_logs;
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
    const { userId: managerId } = await createUserWithSession({
      role: "manager",
      email: "manager@example.com",
    });
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
      .send({ product_id: productId, delta: 6, reason: "Inventário" });

    expect(adjustResponse.status).toBe(201);
    const audit = await get("SELECT approved_by FROM audit_logs WHERE action = ?", ["stock_adjust"]);
    expect(audit.approved_by).toBe(managerId);
  });

  it("blocks large stock adjustment without approval token", async () => {
    const { token: supervisorToken } = await createUserWithSession({
      role: "supervisor",
      email: "supervisor-no-approval@example.com",
    });
    const { productId } = await createProduct({ stock: 10, price: 10 });
    await run("INSERT INTO settings (key, value) VALUES (?, ?)", ["max_stock_adjust", "5"]);

    const adjustResponse = await request(app)
      .post("/api/stock/adjust")
      .set("Authorization", `Bearer ${supervisorToken}`)
      .send({ product_id: productId, delta: 6, reason: "Inventário" });

    expect(adjustResponse.status).toBe(401);
    expect(adjustResponse.body.message).toBe("Aprovação necessária.");
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

  it("cancels a sale with approval and restores stock", async () => {
    const { token: operatorToken } = await createUserWithSession({
      role: "operator",
      email: "operator-cancel@example.com",
    });
    const managerPassword = "senha1234";
    await createUserWithSession({
      role: "manager",
      email: "manager-cancel@example.com",
    });
    await run(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [bcrypt.hashSync(managerPassword, 10), "manager-cancel@example.com"]
    );
    const { productId } = await createProduct({ stock: 10, price: 5 });

    const saleResponse = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({
        product_id: productId,
        quantity: 2,
        payment_method: "dinheiro",
      });
    expect(saleResponse.status).toBe(201);

    const approvalResponse = await request(app)
      .post("/api/approvals")
      .send({
        email: "manager-cancel@example.com",
        password: managerPassword,
        action: "cancel_sale",
        reason: "Cancelamento autorizado",
      });
    expect(approvalResponse.status).toBe(201);

    const cancelResponse = await request(app)
      .post("/api/pos/cancel-sale")
      .set("Authorization", `Bearer ${operatorToken}`)
      .set("x-approval-token", approvalResponse.body.token)
      .send({
        sale_id: saleResponse.body.id,
        reason: "Cliente desistiu",
      });

    expect(cancelResponse.status).toBe(200);
    const stockAfter = await get("SELECT current_stock FROM products WHERE id = ?", [productId]);
    expect(Number(stockAfter.current_stock)).toBe(10);
    const saleAfter = await get("SELECT cancelled_at, cancel_reason, fiscal_status FROM sales WHERE id = ?", [
      saleResponse.body.id,
    ]);
    expect(saleAfter.cancelled_at).toBeTruthy();
    expect(saleAfter.cancel_reason).toBe("Cliente desistiu");
    expect(saleAfter.fiscal_status).toBe("cancelled");
  });
});
