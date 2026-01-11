const bcrypt = require("bcryptjs");
const db = require("../db");

const required = (value, label) => {
  if (!value) {
    throw new Error(`${label} é obrigatório para bootstrap.`);
  }
  return value;
};

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

const exec = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

const closeDb = () =>
  new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

const bootstrap = async () => {
  const name = required(process.env.ADMIN_NAME, "ADMIN_NAME");
  const email = required(process.env.ADMIN_EMAIL, "ADMIN_EMAIL");
  const password = required(process.env.ADMIN_PASSWORD, "ADMIN_PASSWORD");
  const phone = process.env.ADMIN_PHONE || null;

  const existing = await run("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing?.id) {
    throw new Error("Administrador já configurado.");
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const permissions = JSON.stringify(["admin", "logs", "relatorios", "descontos", "estoque", "caixa"]);
  const created = await run(
    "INSERT INTO users (name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    [name, email, phone, passwordHash, "admin", permissions]
  );

  await exec(
    "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
    [
      "admin_bootstrap",
      JSON.stringify({ user_id: created.id, email }),
      created.id,
      created.id,
    ]
  );

  // eslint-disable-next-line no-console
  console.log(`Administrador criado com id ${created.id}.`);
};

bootstrap()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Falha no bootstrap:", error.message);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
