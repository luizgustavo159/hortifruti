const request = require("supertest");
const { app } = require("../server");

describe("Error handling", () => {
  it("returns standardized 404 payload", async () => {
    const response = await request(app).get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: "NOT_FOUND",
      })
    );
    expect(response.body).toHaveProperty("request_id");
  });

  it("returns standardized validation errors", async () => {
    const response = await request(app).post("/api/auth/login").send({});
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toEqual(
      expect.objectContaining({
        code: "VALIDATION_ERROR",
      })
    );
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body).toHaveProperty("request_id");
  });
});
