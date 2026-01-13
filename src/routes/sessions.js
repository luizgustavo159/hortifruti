const express = require("express");
const db = require("../../db");
const { authenticateToken, requireAdmin } = require("./middleware/auth");

const router = express.Router();

router.get("/api/sessions", authenticateToken, requireAdmin, (req, res) => {
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  const sql = userId
    ? "SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC"
    : "SELECT * FROM sessions WHERE revoked_at IS NULL ORDER BY created_at DESC";
  const params = userId ? [userId] : [];
  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar sessões." });
    }
    return res.json(rows);
  });
});

router.delete("/api/sessions/:id", authenticateToken, requireAdmin, (req, res) => {
  const sessionId = Number(req.params.id);
  db.run(
    "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
    [sessionId],
    (err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao encerrar sessão." });
      }
      return res.json({ status: "ok" });
    }
  );
});

module.exports = router;
