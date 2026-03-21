process.env.JWT_SECRET = "test-secret-test-secret-test-secret";
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://greenstore:greenstore@localhost:5432/greenstore_test";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost";
process.env.METRICS_ENABLED = "false";

if (process.env.USE_IN_MEMORY_DB !== "false") {
  jest.mock("../db", () => require("../test-utils/in-memory-db"));
}

const request = require("supertest");
const { app, db } = require("../server");

afterAll((done) => {
  db.close(done);
});

describe("frontend smoke pages", () => {
  it("serves login/home page", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("GreenStore");
    expect(response.text).toContain("login-form");
  });

  it("serves operational pages", async () => {
    const pages = ["/caixa.html", "/estoque.html", "/descontos.html", "/admin/perfil.html"];
    for (const page of pages) {
      // eslint-disable-next-line no-await-in-loop
      const response = await request(app).get(page);
      expect(response.status).toBe(200);
      expect(response.text).toContain("<!DOCTYPE html>");
    }
  });
});
