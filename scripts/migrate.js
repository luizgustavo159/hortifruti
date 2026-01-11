const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost:5432/greenstore";
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

const pool = new Pool({ connectionString: DATABASE_URL });

const run = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [file]
    );
    if (rows.length) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    // eslint-disable-next-line no-await-in-loop
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};

run()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Migrations applied successfully.");
    return pool.end();
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Migration failed:", error);
    process.exitCode = 1;
    return pool.end();
  });
