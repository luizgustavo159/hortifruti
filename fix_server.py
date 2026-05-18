import re
import os

path = '/home/ubuntu/hortifruti/server.js'
content = open(path).read()

# Corrigir a função runMigrations com sintaxe correta e sem erros de template string
migration_code = """async function runMigrations(targetDb) {
  console.log("Executando migrações no banco em memória...");
  const migrationsDir = path.join(__dirname, "migrations");
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).sort();
  for (const file of files) {
    if (file.endsWith(".sql")) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      const commands = sql.split(';').map(c => c.trim()).filter(c => c.length > 0);
      for (const cmd of commands) {
        try {
          await new Promise((resolve, reject) => {
            targetDb.query(cmd, (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (err) {
          console.error("Erro no comando em " + file + ":", err.message);
          // Algumas migrações podem falhar se a tabela já existir (IF NOT EXISTS resolve)
        }
      }
    }
  }
  console.log("Migrações concluídas.");
}"""

content = re.sub(r'async function runMigrations\(targetDb\).*?\}', migration_code, content, flags=re.DOTALL)

# Garantir que o seed funcione
content = content.replace("// Seed liberado para desenvolvimento local", "// Seed liberado")
content = content.replace("if (NODE_ENV !== 'test') return;", "// Seed")

with open(path, 'w') as f:
    f.write(content)
