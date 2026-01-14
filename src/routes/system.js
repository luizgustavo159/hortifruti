const express = require("express");
const db = require("../../db");
const { authenticateToken, requireAdmin } = require("./middleware/auth");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.get("/api/health", (req, res) => {
  db.get("SELECT 1 AS ok", [], (err) => {
    if (err) {
      return sendError(res, req, {
        status: 500,
        code: errorCodes.INTERNAL_ERROR,
        message: "Banco indisponível.",
        details: { status: "error", db: "down", uptime: process.uptime() },
      });
    }
    return res.json({ status: "ok", db: "ok", uptime: process.uptime() });
  });
});

router.get("/api/metrics", authenticateToken, requireAdmin, (req, res) => {
  db.get(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END)::int AS errors
     FROM request_metrics
     WHERE created_at >= NOW() - INTERVAL '24 hours'`,
    [],
    (err, row) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar métricas.",
        });
      }
      return res.json({
        total_requests: req.requestMetrics?.total || 0,
        by_route: req.requestMetrics?.byRoute || {},
        uptime_seconds: req.requestMetrics?.uptimeSeconds || 0,
        last_24h: row || { total: 0, errors: 0 },
      });
    }
  );
});

router.get("/api/alerts", authenticateToken, requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50);
  const safeLimit = Number.isNaN(limit) ? 50 : Math.min(Math.max(limit, 1), 200);
  db.all(
    "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?",
    [safeLimit],
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar alertas.",
        });
      }
      return res.json(rows);
    }
  );
});

module.exports = router;
