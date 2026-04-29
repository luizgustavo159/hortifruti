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

const createSession = async (role = "admin") => {
  const email = `ops-${role}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  const passwordHash = bcrypt.hashSync("senha1234", 10);
  const userId = await run(
    "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1) RETURNING id",
    ["Ops User", email, passwordHash, role]
  );
  const token = jwt.sign({ id: userId, name: "Ops User", email, role }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });
  await run("INSERT INTO sessions (user_id, token) VALUES (?, ?)", [userId, token]);
  return token;
};

const createAdminSession = async () => createSession("admin");

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

  it("returns 401 for operational health request without token", async () => {
    const response = await request(app).get("/api/admin/ops/health");
    expect(response.status).toBe(401);
  });

  it("returns 403 for operational health request by non-admin user", async () => {
    const token = await createSession("operator");
    const response = await request(app).get("/api/admin/ops/health").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
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

  it("returns 401 for snapshot request without token", async () => {
    const response = await request(app).get("/api/admin/ops/snapshot?date=2026-04-01");
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid snapshot date", async () => {
    const token = await createAdminSession();
    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=2026-04-01T12:00:00Z")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Data inválida.");
  });

  it("accepts snapshot date with surrounding whitespace", async () => {
    const token = await createAdminSession();
    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=%202026-04-01%20")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.date).toBe("2026-04-01");
  });

  it("returns 400 for impossible calendar snapshot date", async () => {
    const token = await createAdminSession();
    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=2026-02-31")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Data inválida.");
  });

  it("returns 400 for future snapshot date", async () => {
    const token = await createAdminSession();
    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=2099-01-01")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Data futura não permitida.");
  });

  it("returns 403 for snapshot request by non-admin user", async () => {
    const token = await createSession("operator");
    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=2026-04-01")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it("counts expiring products within exactly 7 calendar days", async () => {
    const token = await createAdminSession();
    const categoryId = await run("INSERT INTO categories (name) VALUES (?) RETURNING id", [
      `Categoria-${Date.now()}`,
    ]);
    await run(
      `INSERT INTO products (name, sku, unit_type, category_id, min_stock, max_stock, current_stock, price, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        "Produto no dia base",
        `SKU-0D-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        "kg",
        categoryId,
        0,
        10,
        5,
        10,
        "2026-04-01T10:00:00.000Z",
      ]
    );
    await run(
      `INSERT INTO products (name, sku, unit_type, category_id, min_stock, max_stock, current_stock, price, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        "Produto 6 dias",
        `SKU-6D-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        "kg",
        categoryId,
        0,
        10,
        5,
        10,
        "2026-04-07T10:00:00.000Z",
      ]
    );
    await run(
      `INSERT INTO products (name, sku, unit_type, category_id, min_stock, max_stock, current_stock, price, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        "Produto 7 dias",
        `SKU-7D-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        "kg",
        categoryId,
        0,
        10,
        5,
        10,
        "2026-04-08T10:00:00.000Z",
      ]
    );

    const response = await request(app)
      .get("/api/admin/ops/snapshot?date=2026-04-01")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.expiring_7d_count).toBe(2);
  });
});
