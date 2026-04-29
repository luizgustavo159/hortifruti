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

const createAdminSession = async () => {
  const email = `ops-admin-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  const passwordHash = bcrypt.hashSync("senha1234", 10);
  const userId = await run(
    "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id",
    ["Ops Admin", email, passwordHash, "admin"]
  );
  const token = jwt.sign({ id: userId, name: "Ops Admin", email, role: "admin" }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });
  await run("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [userId, token]);
  return token;
};

beforeAll((done) => {
  const sql = migrationFiles.map((file) => loadSql(file)).join("\n");
  db.exec(sql, done);
});

afterAll((done) => {
  db.close(done);
});

describe("health endpoint", () => {
  it("returns ok status", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("returns JSON for unknown API routes", async () => {
    const response = await request(app).get("/api/nao-existe");
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Rota de API não encontrada.");
  });

  it("returns operational health for admin", async () => {
    const token = await createAdminSession();
    const response = await request(app).get("/api/admin/ops/health").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.missing_tables).toEqual([]);
    expect(response.body.tables.sales).toBe("ok");
    expect(response.body.tables.finance_accounts).toBe("ok");
  });

  it("returns operational snapshot for admin", async () => {
    const token = await createAdminSession();
    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=2026-04-01")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.date).toBe("2026-04-01");
    expect(response.body).toHaveProperty("low_stock_count");
    expect(response.body).toHaveProperty("expiring_7d_count");
    expect(response.body).toHaveProperty("sales_total");
    expect(response.body).toHaveProperty("open_cash_sessions");
    expect(response.body).toHaveProperty("pending_accounts");
  });

  it("returns 400 for invalid snapshot date", async () => {
    const token = await createAdminSession();
    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=2026-04-01T12:00:00Z")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Data inválida.");
  });

  it("returns 400 for impossible calendar snapshot date", async () => {
    const token = await createAdminSession();
    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=2026-02-31")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Data inválida.");
  });
});
