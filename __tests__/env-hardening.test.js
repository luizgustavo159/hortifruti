const { spawnSync } = require("child_process");

describe("environment hardening", () => {
  it("fails startup in production when ADMIN_BOOTSTRAP_TOKEN is missing", () => {
    const result = spawnSync(
      process.execPath,
      ["-e", "require('./server')"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          JWT_SECRET: "x".repeat(32),
          CORS_ORIGIN: "https://app.example.com",
          DATABASE_URL: "postgres://localhost:5432/greenstore",
          ADMIN_BOOTSTRAP_TOKEN: "",
        },
      }
    );

    expect(result.status).not.toBe(0);
    const stderr = result.stderr.toString();
    expect(stderr).toContain("ADMIN_BOOTSTRAP_TOKEN deve ter ao menos 32 caracteres em produção");
  });
});
