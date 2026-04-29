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
  const password = "senha1234";
  const passwordHash = bcrypt.hashSync(password, 10);
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
  return { userId, token, password };
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

describe("auth routes", () => {
  it("authenticates via /api/auth/login and accesses /api/auth/me", async () => {
    const password = "senha1234";
    const passwordHash = bcrypt.hashSync(password, 10);
    await run(
      "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id",
      ["User operator", "operator-login@example.com", passwordHash, "operator"]
    );

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: "operator-login@example.com", password });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeTruthy();

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.email).toBe("operator-login@example.com");
    expect(meResponse.body.role).toBe("operator");
  });

  it("returns logged user profile in /api/auth/me", async () => {
    const { token } = await createUserWithSession({ role: "manager", email: "manager@example.com" });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe("manager@example.com");
    expect(response.body.role).toBe("manager");
  });

  it("blocks /api/auth/me without token", async () => {
    const response = await request(app).get("/api/auth/me");
    expect(response.status).toBe(401);
  });

  it("revokes session on logout and blocks /api/auth/me afterwards", async () => {
    const { token } = await createUserWithSession({ role: "supervisor", email: "supervisor@example.com" });

    const logoutResponse = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(logoutResponse.status).toBe(200);

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(meResponse.status).toBe(401);
  });
});
