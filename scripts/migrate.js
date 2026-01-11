const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "greenstore.db");
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

const db = new sqlite3.Database(DB_PATH);

const run = async () => {
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");
    db.run(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );
  });

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve, reject) => {
      db.get(
        "SELECT 1 FROM schema_migrations WHERE filename = ?",
        [file],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          if (row) {
            resolve();
            return;
          }
          const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
          db.exec(sql, (execErr) => {
            if (execErr) {
              reject(execErr);
              return;
            }
            db.run(
              "INSERT INTO schema_migrations (filename) VALUES (?)",
              [file],
              (insertErr) => {
                if (insertErr) {
                  reject(insertErr);
                  return;
                }
                resolve();
              }
            );
          });
        }
      );
    });
  }
  db.close();
};

run()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("Migrations applied successfully.");
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Migration failed:", error);
    process.exitCode = 1;
    db.close();
  });
