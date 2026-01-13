const db = require("../../../db");

const getSettings = (keys, callback) => {
  if (!keys.length) {
    callback({});
    return;
  }
  const placeholders = keys.map(() => "?").join(",");
  db.all(`SELECT key, value FROM settings WHERE key IN (${placeholders})`, keys, (err, rows) => {
    if (err) {
      callback({});
      return;
    }
    const result = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    callback(result);
  });
};

module.exports = {
  getSettings,
};
