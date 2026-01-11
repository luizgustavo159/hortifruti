const { app, db } = require("./src/app");
const config = require("./config");

const { PORT } = config;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`GreenStore API rodando na porta ${PORT}`);
  });
}

module.exports = { app, db };
