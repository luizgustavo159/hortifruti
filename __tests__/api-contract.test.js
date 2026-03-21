process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://greenstore:greenstore@localhost:5432/greenstore_test";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost";
process.env.METRICS_ENABLED = "false";

const fs = require("fs");
if (process.env.USE_IN_MEMORY_DB !== "false") {
  jest.mock("../db", () => require("../test-utils/in-memory-db"));
}
const path = require("path");
const request = require("supertest");
const bcrypt = require("bcryptjs");
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
      DELETE FROM idempotency_keys;
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

const createUser = async ({ email = "operator@example.com", role = "operator", password = "senha1234" } = {}) => {
  const passwordHash = bcrypt.hashSync(password, 10);
  const userId = await run(
    "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id",
    ["User Operator", email, passwordHash, role]
  );
  return { userId, email, password };
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

describe("api contracts", () => {
  it("returns validation contract for invalid login payload", async () => {
    const response = await request(app).post("/api/auth/login").send({ email: "invalid-email" });

    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  it("returns token contract for valid login", async () => {
    const { email, password } = await createUser();

    const response = await request(app).post("/api/auth/login").send({ email, password });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.token.length).toBeGreaterThan(20);
  });

  it("enforces sales payload validation contract", async () => {
    const { email, password } = await createUser();
    const loginResponse = await request(app).post("/api/auth/login").send({ email, password });
    const token = loginResponse.body.token;

    const response = await request(app)
      .post("/api/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({ product_id: "x", quantity: 0, payment_method: "" });

    expect(response.status).toBe(400);
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  it("requires authentication contract on protected endpoints", async () => {
    const response = await request(app).get("/api/categories");
    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Token não informado.");
  });

  it("enforces role contract for admin-only endpoint", async () => {
    const { email, password } = await createUser({ email: "operator2@example.com", role: "operator" });
    const loginResponse = await request(app).post("/api/auth/login").send({ email, password });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Acesso não autorizado.");
  });

  it("allows admin access contract to users listing", async () => {
    const { email, password } = await createUser({ email: "admin@example.com", role: "admin" });
    const loginResponse = await request(app).post("/api/auth/login").send({ email, password });

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0].email).toBe("admin@example.com");
  });
});
