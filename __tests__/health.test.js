process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://greenstore:greenstore@localhost:5432/greenstore_test";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost";
process.env.METRICS_ENABLED = "false";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app, db } = require("../server");

const loadSql = (file) => fs.readFileSync(path.join(__dirname, "..", "migrations", file), "utf-8");
const migrationFiles = fs
  .readdirSync(path.join(__dirname, "..", "migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();

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
});
