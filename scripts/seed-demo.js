const db = require("../db");
const bcrypt = require("bcryptjs");

async function seed() {
  const passwordHash = bcrypt.hashSync("admin", 10);
  
  console.log("Iniciando seed...");
  
  // Limpar e criar usuário admin
  await new Promise((resolve) => {
    db.run("DELETE FROM users WHERE email = 'admin@admin.com'", [], () => resolve());
  });

  await new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      ["Administrador", "admin@admin.com", passwordHash, "admin"],
      (err) => {
        if (err) {
          console.error("Erro ao criar admin:", err);
          reject(err);
        } else {
          console.log("Usuário admin criado com sucesso.");
          resolve();
        }
      }
    );
  });

  // Criar alguns produtos de teste
  await new Promise((resolve) => {
    db.run("DELETE FROM products", [], () => resolve());
  });

  const products = [
    ['Maçã Fuji', 'Frutas', 5.99, 'kg', 100],
    ['Banana Nanica', 'Frutas', 3.50, 'kg', 150],
    ['Tomate Italiano', 'Legumes', 7.20, 'kg', 80],
    ['Alface Crespa', 'Verduras', 2.50, 'un', 50]
  ];

  for (const p of products) {
    await new Promise((resolve) => {
      db.run("INSERT INTO products (name, category, price, unit, stock) VALUES (?, ?, ?, ?, ?)", p, () => resolve());
    });
  }
  
  console.log("Produtos de teste criados.");
}

seed().then(() => {
  console.log("Seed finalizado com sucesso.");
  process.exit(0);
}).catch(err => {
  console.error("Falha no seed:", err);
  process.exit(1);
});
