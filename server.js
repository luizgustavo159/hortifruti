const { app, db } = require("./src/app");
const config = require("./config");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const { PORT, NODE_ENV } = config;

async function runMigrations(targetDb) {
  console.log("Executando migrações no banco em memória...");
  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(migrationsDir).sort();
  
  for (const file of files) {
    if (file.endsWith(".sql")) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await new Promise((resolve, reject) => {
        targetDb.query(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
  console.log("Migrações concluídas.");
}

async function seedInMemoryDb() {
  if (NODE_ENV !== "test") return;
  
  console.log("Populando banco de dados em memória...");
  const passwordHash = bcrypt.hashSync("admin", 10);
  
  // Usar a instância global para garantir que estamos no mesmo banco
  const targetDb = global.dbPool || db;

  await new Promise((resolve, reject) => {
    const sql = "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)";
    targetDb.query(sql, ["Administrador", "admin@admin.com", passwordHash, "admin"], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const products = [
    ['Maçã Fuji', 'SKU001', 'kg', 5.99, 100],
    ['Banana Nanica', 'SKU002', 'kg', 3.50, 150],
    ['Tomate Italiano', 'SKU003', 'kg', 7.20, 80],
    ['Alface Crespa', 'SKU004', 'un', 2.50, 50]
  ];

  for (const p of products) {
    await new Promise((resolve, reject) => {
      const sql = "INSERT INTO products (name, sku, unit_type, price, current_stock) VALUES ($1, $2, $3, $4, $5)";
      targetDb.query(sql, p, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  console.log("Banco de dados em memória populado com sucesso.");
}

if (require.main === module) {
  const targetDb = global.dbPool || db;
  runMigrations(targetDb)
    .then(() => seedInMemoryDb())
    .then(() => {
      app.listen(PORT, () => {
        console.log(`GreenStore API rodando na porta ${PORT}`);
      });
    })
    .catch(err => {
      console.error("Erro na inicialização:", err);
      process.exit(1);
    });
}

module.exports = { app, db };
