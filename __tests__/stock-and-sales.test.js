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

const createUserWithSession = async ({ role }) => {
  const passwordHash = bcrypt.hashSync("senha1234", 10);
  const userId = await run(
    "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id",
    [`User ${role}`, `${role}@example.com`, passwordHash, role]
  );
  const token = jwt.sign(
    { id: userId, name: `User ${role}`, email: `${role}@example.com`, role },
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
    ["Tomate", "SKU-001", "kg", categoryId, 0, 100, stock, price]
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

describe("stock and sales flows", () => {
  it("adjusts stock with supervisor role", async () => {
    const { token } = await createUserWithSession({ role: "supervisor" });
    const { productId } = await createProduct({ stock: 10, price: 5 });

    const response = await request(app)
      .post("/api/stock/adjust")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId, delta: 5, reason: "Inventário" });

    expect(response.status).toBe(200);
    expect(response.body.current_stock).toBe(15);

    const product = await get("SELECT current_stock FROM products WHERE id = ?", [productId]);
    expect(product.current_stock).toBe(15);
  });

  it("records a sale and reduces stock", async () => {
    const { token } = await createUserWithSession({ role: "operator" });
    const { productId } = await createProduct({ stock: 8, price: 4 });

    const response = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: productId, quantity: 3, payment_method: "dinheiro" });

    expect(response.status).toBe(201);
    expect(response.body.total).toBe(12);
    expect(response.body.final_total).toBe(12);

    const product = await get("SELECT current_stock FROM products WHERE id = ?", [productId]);
    expect(product.current_stock).toBe(5);
  });
});
