const db = require("../../../db");

const runWithTransaction = (work, callback) => {
  db.withTransaction((tx, finish) => {
    work(tx, finish);
  }, callback);
};

module.exports = {
  runWithTransaction,
};
