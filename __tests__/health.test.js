process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost";

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { app, db } = require("../server");

const loadSql = (file) => fs.readFileSync(path.join(__dirname, "..", "migrations", file), "utf-8");

beforeAll((done) => {
  const schemaSql = loadSql("000_schema.sql");
  const indexSql = loadSql("001_indexes.sql");
  db.exec(`${schemaSql}\n${indexSql}`, done);
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
