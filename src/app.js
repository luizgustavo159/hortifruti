const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const pino = require("pino");
const pinoHttp = require("pino-http");
const db = require("../db");
const config = require("../config");
const {
  router,
  sendAlertNotification,
  ALERT_SLOW_THRESHOLD_MS,
  METRICS_ENABLED,
} = require("./routes");

const app = express();
const requestMetrics = {
  total: 0,
  byRoute: {},
  startedAt: Date.now(),
};

const { LOG_LEVEL, corsOrigin } = config;

app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));
const logger = pino({ level: LOG_LEVEL });
app.use(
  pinoHttp({
    logger,
    genReqId: () => crypto.randomUUID(),
  })
);
app.use((req, res, next) => {
  req.requestId = req.id;
  res.setHeader("x-request-id", req.requestId);
  next();
});
app.use((req, res, next) => {
  requestMetrics.total += 1;
  const key = `${req.method} ${req.path}`;
  requestMetrics.byRoute[key] = (requestMetrics.byRoute[key] || 0) + 1;
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (METRICS_ENABLED) {
      db.run(
        "INSERT INTO request_metrics (method, path, status, duration_ms) VALUES (?, ?, ?, ?)",
        [req.method, req.path, res.statusCode, Math.round(durationMs)],
        (err) => {
          if (err) {
            logger.error({ err }, "Erro ao persistir métrica.");
          }
        }
      );
    }
    const isSlow = durationMs > ALERT_SLOW_THRESHOLD_MS;
    const isError = res.statusCode >= 500;
    if (isSlow || isError) {
      const level = isError ? "error" : "warning";
      const message = isError ? "Erro de API" : "Resposta lenta";
      const context = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Math.round(durationMs),
        request_id: req.requestId,
      };
      db.run(
        "INSERT INTO alerts (level, message, context) VALUES (?, ?, ?::jsonb)",
        [level, message, JSON.stringify(context)],
        (err) => {
          if (err) {
            logger.error({ err }, "Erro ao registrar alerta.");
            return;
          }
          sendAlertNotification({ level, message, context }).catch((notifyErr) => {
            logger.error({ err: notifyErr }, "Erro ao enviar alerta.");
          });
        }
      );
    }
  });
  req.requestMetrics = {
    ...requestMetrics,
    uptimeSeconds: Math.floor((Date.now() - requestMetrics.startedAt) / 1000),
  };
  next();
});
app.use(express.static(path.join(__dirname, "..", "public")));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);
app.use(router);

app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada.", request_id: req.requestId });
});

app.use((err, req, res, next) => {
  logger.error({ err, request_id: req.requestId }, "Erro não tratado.");
  res.status(err.status || 500).json({
    message: err.expose ? err.message : "Erro interno do servidor.",
    request_id: req.requestId,
  });
  next();
});

module.exports = { app, db };
