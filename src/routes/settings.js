const express = require("express");
const db = require("../../db");
const { authenticateToken, requireAdmin } = require("./middleware/auth");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.get("/api/settings", authenticateToken, requireAdmin, (req, res) => {
  db.all("SELECT key, value FROM settings", [], (err, rows) => {
    if (err) {
      return sendError(res, req, {
        status: 500,
        code: errorCodes.INTERNAL_ERROR,
        message: "Erro ao buscar configurações.",
      });
    }
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    return res.json(settings);
  });
});

router.put("/api/settings", authenticateToken, requireAdmin, (req, res) => {
  const settings = req.body || {};
  const entries = Object.entries(settings);
  if (!entries.length) {
    return sendError(res, req, {
      status: 400,
      code: errorCodes.INVALID_REQUEST,
      message: "Nenhuma configuração enviada.",
    });
  }
  db.serialize(() => {
    entries.forEach(([key, value]) => {
      db.run(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        [key, String(value)]
      );
    });
  });
  return res.json({ updated: entries.length });
});

module.exports = router;
