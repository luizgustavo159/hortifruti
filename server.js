require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pino = require("pino");
const pinoHttp = require("pino-http");
const nodemailer = require("nodemailer");
const { body, validationResult } = require("express-validator");
const db = require("./db");

const app = express();
const requestMetrics = {
  total: 0,
  byRoute: {},
  startedAt: Date.now(),
};

const PORT = process.env.PORT || 3000;
let JWT_SECRET = process.env.JWT_SECRET || "";
const NODE_ENV = process.env.NODE_ENV || "development";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const ADMIN_BOOTSTRAP_TOKEN = process.env.ADMIN_BOOTSTRAP_TOKEN || "";
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);
const ALERT_SLOW_THRESHOLD_MS = Number(process.env.ALERT_SLOW_THRESHOLD_MS || 2000);
const METRICS_ENABLED = process.env.METRICS_ENABLED !== "false";
const PASSWORD_RESET_URL = process.env.PASSWORD_RESET_URL || "";
const RESET_EMAIL_FROM = process.env.RESET_EMAIL_FROM || "";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const RESET_SMS_WEBHOOK_URL = process.env.RESET_SMS_WEBHOOK_URL || "";
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";

if (!JWT_SECRET) {
  if (NODE_ENV === "development") {
    JWT_SECRET = "development-secret";
    // eslint-disable-next-line no-console
    console.warn("JWT_SECRET não configurado. Usando segredo temporário apenas para desenvolvimento.");
  } else {
    throw new Error("JWT_SECRET inválido. Configure um segredo forte para produção.");
  }
} else if (JWT_SECRET.length < 32 && NODE_ENV !== "development") {
  throw new Error("JWT_SECRET deve ter ao menos 32 caracteres.");
}

if (NODE_ENV !== "development" && process.env.CORS_ORIGIN === "*") {
  throw new Error("CORS_ORIGIN não pode ser '*' fora de desenvolvimento.");
}

app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (NODE_ENV !== "development" && !allowedOrigins.length) {
  throw new Error("CORS_ORIGIN deve ser configurado fora de desenvolvimento.");
}
const corsOptions = {
  origin: NODE_ENV === "development" && !allowedOrigins.length ? "*" : allowedOrigins,
};
app.use(cors(corsOptions));
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
  next();
});
app.use(express.static(path.join(__dirname, "public")));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", limiter);

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Token não informado." });
  }
  const token = authHeader.replace("Bearer ", "");
  return jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido." });
    }
    db.get(
      "SELECT * FROM sessions WHERE token = ? AND revoked_at IS NULL",
      [token],
      (sessionErr, session) => {
        if (sessionErr || !session) {
          return res.status(401).json({ message: "Sessão expirada." });
        }
        req.user = user;
        return next();
      }
    );
  });
};

const roleLevels = {
  operator: 1,
  supervisor: 2,
  manager: 3,
  admin: 4,
};

const hasRole = (user, role) => {
  const current = roleLevels[user?.role] || 0;
  return current >= roleLevels[role];
};

const requireRole = (role) => (req, res, next) => {
  if (!hasRole(req.user, role)) {
    return res.status(403).json({ message: "Acesso não autorizado." });
  }
  return next();
};

const requireAdmin = requireRole("admin");
const requireManager = requireRole("manager");
const requireSupervisor = requireRole("supervisor");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const runWithTransaction = (work, callback) => {
  db.withTransaction((tx, finish) => {
    work(tx, finish);
  }, callback);
};

const logAudit = ({ action, details, performedBy, approvedBy }) => {
  db.run(
    "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
    [action, details ? JSON.stringify(details) : null, performedBy, approvedBy]
  );
};

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

const emailTransport =
  SMTP_HOST && RESET_EMAIL_FROM
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      })
    : null;

const buildResetMessage = (token, expiresAt) => {
  const resetLink = PASSWORD_RESET_URL ? `${PASSWORD_RESET_URL}?token=${token}` : null;
  const details = [
    "Você solicitou a redefinição de senha.",
    resetLink ? `Link: ${resetLink}` : `Token: ${token}`,
    `Expira em: ${expiresAt}`,
  ];
  return details.join("\n");
};

const sendPasswordResetNotification = async ({ user, token, expiresAt }) => {
  const payload = buildResetMessage(token, expiresAt);
  let sent = false;
  if (emailTransport && user.email) {
    await emailTransport.sendMail({
      from: RESET_EMAIL_FROM,
      to: user.email,
      subject: "Redefinição de senha",
      text: payload,
    });
    sent = true;
  }
  if (RESET_SMS_WEBHOOK_URL && user.phone) {
    const response = await fetch(RESET_SMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: user.phone,
        message: payload,
        token,
        expires_at: expiresAt,
        reset_url: PASSWORD_RESET_URL || null,
      }),
    });
    if (!response.ok) {
      throw new Error("Falha ao enviar SMS.");
    }
    sent = true;
  }
  if (!sent) {
    throw new Error("Nenhum canal de notificação configurado.");
  }
};

const sendAlertNotification = async ({ level, message, context }) => {
  if (!ALERT_WEBHOOK_URL) {
    return;
  }
  const response = await fetch(ALERT_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      level,
      message,
      context,
      created_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error("Falha ao enviar alerta.");
  }
};

const parseDateRange = (req, res) => {
  const { start, end } = req.query;
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (start && Number.isNaN(startDate?.getTime())) {
    res.status(400).json({ message: "Data inicial inválida." });
    return null;
  }
  if (end && Number.isNaN(endDate?.getTime())) {
    res.status(400).json({ message: "Data final inválida." });
    return null;
  }
  if (startDate && endDate && startDate > endDate) {
    res.status(400).json({ message: "Intervalo de datas inválido." });
    return null;
  }
  return { start: start || null, end: end || null };
};

const buildDateFilter = (field, range) => {
  const conditions = [];
  const params = [];
  if (range?.start) {
    conditions.push(`date(${field}) >= date(?)`);
    params.push(range.start);
  }
  if (range?.end) {
    conditions.push(`date(${field}) <= date(?)`);
    params.push(range.end);
  }
  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

const verifyApprovalToken = (token, action, callback) => {
  if (!token) {
    callback({ status: 401, message: "Aprovação necessária." });
    return;
  }
  const tokenHash = hashToken(token);
  db.get(
    "SELECT * FROM approvals WHERE token_hash = ? AND action = ? AND used_at IS NULL",
    [tokenHash, action],
    (err, approval) => {
      if (err || !approval) {
        callback({ status: 403, message: "Aprovação inválida." });
        return;
      }
      const expiresAt = new Date(approval.expires_at);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        callback({ status: 403, message: "Aprovação expirada." });
        return;
      }
      db.run("UPDATE approvals SET used_at = CURRENT_TIMESTAMP WHERE id = ?", [approval.id]);
      callback(null, approval);
    }
  );
};

const requireApproval = (action) => (req, res, next) => {
  const token = req.headers["x-approval-token"];
  verifyApprovalToken(token, action, (error, approval) => {
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }
    req.approval = approval;
    return next();
  });
};

app.get("/api/health", (req, res) => {
  db.get("SELECT 1 AS ok", [], (err) => {
    if (err) {
      return res.status(500).json({ status: "error", db: "down", uptime: process.uptime() });
    }
    return res.json({ status: "ok", db: "ok", uptime: process.uptime() });
  });
});

app.get("/api/metrics", authenticateToken, requireAdmin, (req, res) => {
  db.get(
    `SELECT COUNT(*)::int AS total,
            SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END)::int AS errors
     FROM request_metrics
     WHERE created_at >= NOW() - INTERVAL '24 hours'`,
    [],
    (err, row) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar métricas." });
      }
      return res.json({
        total_requests: requestMetrics.total,
        by_route: requestMetrics.byRoute,
        uptime_seconds: Math.floor((Date.now() - requestMetrics.startedAt) / 1000),
        last_24h: row || { total: 0, errors: 0 },
      });
    }
  );
});

app.get("/api/alerts", authenticateToken, requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50);
  const safeLimit = Number.isNaN(limit) ? 50 : Math.min(Math.max(limit, 1), 200);
  db.all(
    "SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?",
    [safeLimit],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar alertas." });
      }
      return res.json(rows);
    }
  );
});

app.post(
  "/api/auth/register",
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("email").isEmail().withMessage("Email inválido."),
    body("password").isLength({ min: 8 }).withMessage("Senha deve ter 8+ caracteres."),
    body("phone")
      .optional()
      .matches(/^[0-9()+\-\s]{6,20}$/)
      .withMessage("Telefone inválido."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone = null } = req.body;
    const passwordHash = bcrypt.hashSync(password, 10);

    db.get(
      "INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?) RETURNING id",
      [name, email, phone, passwordHash],
      (err, row) => {
        if (err) {
          return res.status(400).json({ message: "Email já cadastrado." });
        }
        return res.status(201).json({ id: row.id, name, email, phone });
      }
    );
  }
);

app.post(
  "/api/auth/bootstrap",
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("email").isEmail().withMessage("Email inválido."),
    body("password").isLength({ min: 8 }).withMessage("Senha deve ter 8+ caracteres."),
    body("phone")
      .optional()
      .matches(/^[0-9()+\-\s]{6,20}$/)
      .withMessage("Telefone inválido."),
  ],
  (req, res) => {
    if (!ADMIN_BOOTSTRAP_TOKEN) {
      return res.status(500).json({ message: "Bootstrap não configurado." });
    }
    const bootstrapToken = req.headers["x-bootstrap-token"];
    if (bootstrapToken !== ADMIN_BOOTSTRAP_TOKEN) {
      return res.status(403).json({ message: "Token de bootstrap inválido." });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", [], (err, row) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao verificar administradores." });
      }
      if (row) {
        return res.status(409).json({ message: "Administrador já configurado." });
      }

      const { name, email, password, phone = null } = req.body;
      const passwordHash = bcrypt.hashSync(password, 10);
      const permissions = ["admin", "logs", "relatorios", "descontos", "estoque", "caixa"];

      db.get(
        "INSERT INTO users (name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        [name, email, phone, passwordHash, "admin", JSON.stringify(permissions)],
        (insertErr, row) => {
          if (insertErr) {
            return res.status(500).json({ message: "Erro ao criar administrador." });
          }
          logAudit({
            action: "admin_bootstrap",
            details: { user_id: row.id, email },
            performedBy: row.id,
            approvedBy: row.id,
          });
          return res.status(201).json({ id: row.id });
        }
      );
    });
  }
);

app.post("/api/auth/logout", authenticateToken, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;
  if (!token) {
    return res.status(400).json({ message: "Token não informado." });
  }
  db.run(
    "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token = ?",
    [token],
    (err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao encerrar sessão." });
      }
      return res.json({ status: "ok" });
    }
  );
});

app.post(
  "/api/auth/request-password-reset",
  [body("email").isEmail().withMessage("Email inválido.")],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { email } = req.body;
    db.get("SELECT id, email, phone FROM users WHERE email = ?", [email], (err, user) => {
      if (err || !user) {
        return res.status(200).json({ status: "ok" });
      }
      const hasEmailChannel = Boolean(emailTransport && user.email);
      const hasSmsChannel = Boolean(RESET_SMS_WEBHOOK_URL && user.phone);
      if (!hasEmailChannel && !hasSmsChannel) {
        return res.status(500).json({ message: "Canal de reset não configurado." });
      }
      const token = crypto.randomBytes(20).toString("hex");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();

      db.run(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
        [user.id, tokenHash, expiresAt],
        (insertErr) => {
          if (insertErr) {
            return res.status(500).json({ message: "Erro ao criar reset." });
          }
          sendPasswordResetNotification({ user, token, expiresAt })
            .then(() => {
              logAudit({
                action: "password_reset_requested",
                details: { user_id: user.id },
                performedBy: user.id,
              });
              return res.json({ status: "ok" });
            })
            .catch((notifyErr) => {
              logger.error({ err: notifyErr }, "Erro ao enviar reset de senha.");
              return res.status(500).json({ message: "Erro ao enviar reset." });
            });
        }
      );
    });
  }
);

app.post(
  "/api/auth/reset-password",
  [
    body("token").trim().notEmpty().withMessage("Token é obrigatório."),
    body("password").isLength({ min: 8 }).withMessage("Senha deve ter 8+ caracteres."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { token, password } = req.body;
    const tokenHash = hashToken(token);
    db.get(
      "SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL",
      [tokenHash],
      (err, reset) => {
        if (err || !reset) {
          return res.status(400).json({ message: "Token inválido." });
        }
        const expiresAt = new Date(reset.expires_at);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
          return res.status(400).json({ message: "Token expirado." });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        runWithTransaction((tx, finish) => {
          tx.run(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            [passwordHash, reset.user_id],
            (updateErr) => {
              if (updateErr) {
                finish(updateErr);
                return;
              }
              tx.run(
                "UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
                [reset.id],
                (resetErr) => {
                  if (resetErr) {
                    finish(resetErr);
                    return;
                  }
                  tx.run(
                    "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
                    [reset.user_id],
                    (revokeErr) => {
                      if (revokeErr) {
                        finish(revokeErr);
                        return;
                      }
                      tx.run(
                        "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
                        [
                          "password_reset_completed",
                          JSON.stringify({ user_id: reset.user_id }),
                          reset.user_id,
                          null,
                        ],
                        (auditErr) => {
                          if (auditErr) {
                            finish(auditErr);
                            return;
                          }
                          finish(null);
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }, (transactionErr) => {
          if (transactionErr) {
            return res.status(500).json({ message: "Erro ao resetar senha." });
          }
          return res.json({ status: "ok" });
        });
      }
    );
  }
);

app.post(
  "/api/users",
  authenticateToken,
  requireAdmin,
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("email").isEmail().withMessage("Email inválido."),
    body("password").isLength({ min: 8 }).withMessage("Senha deve ter 8+ caracteres."),
    body("phone")
      .optional()
      .matches(/^[0-9()+\-\s]{6,20}$/)
      .withMessage("Telefone inválido."),
    body("role")
      .optional()
      .isIn(["admin", "manager", "supervisor", "operator"])
      .withMessage("Cargo inválido."),
    body("permissions")
      .optional()
      .isArray()
      .withMessage("Permissões inválidas."),
    body("permissions.*")
      .optional()
      .isIn(["caixa", "estoque", "descontos", "relatorios", "logs", "admin"])
      .withMessage("Permissão inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, phone = null, role = "operator", permissions = [] } = req.body;
    const passwordHash = bcrypt.hashSync(password, 10);

    db.get(
      "INSERT INTO users (name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
      [name, email, phone, passwordHash, role, JSON.stringify(permissions)],
      (err, row) => {
        if (err) {
          return res.status(400).json({ message: "Email já cadastrado." });
        }
        return res.status(201).json({ id: row.id, name, email, phone, role });
      }
    );
  }
);

app.get("/api/users", authenticateToken, requireAdmin, (req, res) => {
  db.all(
    "SELECT id, name, email, phone, role, is_active, permissions, created_at FROM users",
    [],
    (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao listar usuários." });
    }
    const users = rows.map((row) => {
      let permissions = [];
      if (row.permissions) {
        try {
          permissions = JSON.parse(row.permissions);
        } catch (error) {
          permissions = [];
        }
      }
      return { ...row, permissions };
    });
    return res.json(users);
  });
});

app.put(
  "/api/users/:id",
  authenticateToken,
  requireAdmin,
  [
    body("name").optional().trim().notEmpty().withMessage("Nome é obrigatório."),
    body("email").optional().isEmail().withMessage("Email inválido."),
    body("phone")
      .optional()
      .matches(/^[0-9()+\-\s]{6,20}$/)
      .withMessage("Telefone inválido."),
    body("password")
      .optional()
      .isLength({ min: 8 })
      .withMessage("Senha deve ter 8+ caracteres."),
    body("role")
      .optional()
      .isIn(["admin", "manager", "supervisor", "operator"])
      .withMessage("Cargo inválido."),
    body("is_active").optional().isInt({ min: 0, max: 1 }).withMessage("Status inválido."),
    body("permissions")
      .optional()
      .isArray()
      .withMessage("Permissões inválidas."),
    body("permissions.*")
      .optional()
      .isIn(["caixa", "estoque", "descontos", "relatorios", "logs", "admin"])
      .withMessage("Permissão inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = Number(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Usuário inválido." });
    }

    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      const payload = req.body;
      const updated = {
        name: payload.name ?? user.name,
        email: payload.email ?? user.email,
        phone: typeof payload.phone === "undefined" ? user.phone : payload.phone,
        role: payload.role ?? user.role,
        is_active:
          typeof payload.is_active === "undefined" ? user.is_active : payload.is_active ? 1 : 0,
        password_hash: user.password_hash,
        permissions:
          typeof payload.permissions === "undefined" ? user.permissions : JSON.stringify(payload.permissions),
      };

      if (payload.password) {
        updated.password_hash = bcrypt.hashSync(payload.password, 10);
      }

      const criticalChange =
        (user.role !== "admin" && updated.role === "admin") || (user.is_active && !updated.is_active);
      const approvalToken = req.headers["x-approval-token"];
      const proceedUpdate = (approval) => {
        db.run(
          "UPDATE users SET name = ?, email = ?, phone = ?, role = ?, is_active = ?, password_hash = ?, permissions = ? WHERE id = ?",
          [
            updated.name,
            updated.email,
            updated.phone,
            updated.role,
            updated.is_active,
            updated.password_hash,
            updated.permissions,
            userId,
          ],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ message: "Erro ao atualizar usuário." });
            }
            const changes = {
              name: payload.name ? { from: user.name, to: updated.name } : undefined,
              email: payload.email ? { from: user.email, to: updated.email } : undefined,
              phone: typeof payload.phone !== "undefined" ? { from: user.phone, to: updated.phone } : undefined,
              role: payload.role ? { from: user.role, to: updated.role } : undefined,
              is_active:
                typeof payload.is_active !== "undefined"
                  ? { from: user.is_active, to: updated.is_active }
                  : undefined,
              permissions:
                typeof payload.permissions !== "undefined"
                  ? { from: user.permissions, to: updated.permissions }
                  : undefined,
            };
            logAudit({
              action: "user_update",
              details: { userId, changes },
              performedBy: req.user.id,
              approvedBy: approval?.approved_by,
            });
            return res.json({ id: userId });
          }
        );
      };

      if (criticalChange) {
        return verifyApprovalToken(approvalToken, "user_update", (error, approval) => {
          if (error) {
            return res.status(error.status).json({ message: error.message });
          }
          return proceedUpdate(approval);
        });
      }

      return proceedUpdate(null);
    });
  }
);

app.get("/api/sessions", authenticateToken, requireAdmin, (req, res) => {
  const { user_id } = req.query;
  const query = user_id
    ? "SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC"
    : "SELECT * FROM sessions WHERE revoked_at IS NULL ORDER BY created_at DESC";
  const params = user_id ? [user_id] : [];
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar sessões." });
    }
    return res.json(rows);
  });
});

app.delete("/api/sessions/:id", authenticateToken, requireAdmin, (req, res) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) {
    return res.status(400).json({ message: "Sessão inválida." });
  }
  db.run(
    "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
    [sessionId],
    (err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao revogar sessão." });
      }
      return res.json({ id: sessionId });
    }
  );
});

app.get("/api/settings", authenticateToken, requireAdmin, (req, res) => {
  db.all("SELECT key, value FROM settings", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar configurações." });
    }
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    return res.json(settings);
  });
});

app.put("/api/settings", authenticateToken, requireAdmin, (req, res) => {
  const settings = req.body || {};
  const entries = Object.entries(settings);
  if (!entries.length) {
    return res.status(400).json({ message: "Nenhuma configuração enviada." });
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

app.post(
  "/api/auth/login",
  [
    body("email").isEmail().withMessage("Email inválido."),
    body("password").notEmpty().withMessage("Senha é obrigatória."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const ip = req.ip;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ message: "Credenciais inválidas." });
      }
      if (user.locked_until) {
        const lockedUntil = new Date(user.locked_until);
        if (!Number.isNaN(lockedUntil.getTime()) && lockedUntil > new Date()) {
          return res.status(403).json({ message: "Usuário bloqueado temporariamente." });
        }
      }
      if (!user.is_active) {
        return res.status(403).json({ message: "Usuário inativo." });
      }

      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) {
        return getSettings(["login_attempts", "lock_minutes"], (settings) => {
          const maxAttempts = Number(settings.login_attempts || 5);
          const lockMinutes = Number(settings.lock_minutes || 10);
          db.run(
            "INSERT INTO login_attempts (email, ip) VALUES (?, ?)",
            [email, ip],
            () => {
              db.all(
                `SELECT COUNT(*)::int as attempts
                 FROM login_attempts
                 WHERE email = ?
                 AND created_at >= NOW() - ?::interval`,
                [email, `${lockMinutes} minutes`],
                (countErr, rows) => {
                  const attempts = countErr ? 0 : rows?.[0]?.attempts || 0;
                  if (attempts >= maxAttempts) {
                    const lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000).toISOString();
                    db.run("UPDATE users SET locked_until = ? WHERE email = ?", [lockedUntil, email]);
                    return res.status(403).json({ message: "Usuário bloqueado por tentativas." });
                  }
                  return res.status(401).json({ message: "Credenciais inválidas." });
                }
              );
            }
          );
        });
      }

      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "8h" }
      );
      db.run("DELETE FROM login_attempts WHERE email = ?", [email]);
      db.run("UPDATE users SET locked_until = NULL WHERE email = ?", [email]);
      db.run(
        "INSERT INTO sessions (user_id, token) VALUES (?, ?)",
        [user.id, token],
        (sessionErr) => {
          if (sessionErr) {
            return res.status(500).json({ message: "Erro ao criar sessão." });
          }
          return res.json({ token });
        }
      );
    });
  }
);

app.get("/api/categories", authenticateToken, (req, res) => {
  db.all("SELECT * FROM categories ORDER BY name", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar categorias." });
    }
    return res.json(rows);
  });
});

app.post(
  "/api/categories",
  authenticateToken,
  requireManager,
  [body("name").trim().notEmpty().withMessage("Nome é obrigatório.")],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description = "" } = req.body;
    db.get(
      "INSERT INTO categories (name, description) VALUES (?, ?) RETURNING id",
      [name, description],
      (err, row) => {
        if (err) {
          return res.status(400).json({ message: "Categoria já cadastrada." });
        }
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

app.get("/api/suppliers", authenticateToken, requireManager, (req, res) => {
  db.all("SELECT * FROM suppliers ORDER BY name", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar fornecedores." });
    }
    return res.json(rows);
  });
});

app.post(
  "/api/suppliers",
  authenticateToken,
  requireManager,
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("email").optional().isEmail().withMessage("Email inválido."),
    body("phone")
      .optional()
      .matches(/^[0-9()+\-\s]{6,20}$/)
      .withMessage("Telefone inválido."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, contact = "", phone = "", email = "" } = req.body;
    db.get(
      "INSERT INTO suppliers (name, contact, phone, email) VALUES (?, ?, ?, ?) RETURNING id",
      [name, contact, phone, email],
      (err, row) => {
        if (err) {
          return res.status(400).json({ message: "Fornecedor já cadastrado." });
        }
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

app.get("/api/products", authenticateToken, (req, res) => {
  db.all(
    `SELECT products.*, categories.name AS category_name, suppliers.name AS supplier_name
     FROM products
     LEFT JOIN categories ON categories.id = products.category_id
     LEFT JOIN suppliers ON suppliers.id = products.supplier_id
     ORDER BY products.name`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar produtos." });
      }
      return res.json(rows);
    }
  );
});

app.post(
  "/api/products",
  authenticateToken,
  requireManager,
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("sku").trim().notEmpty().withMessage("SKU é obrigatório."),
    body("unit_type").trim().notEmpty().withMessage("Tipo de unidade é obrigatório."),
    body("price").isFloat({ min: 0 }).withMessage("Preço inválido."),
    body("current_stock").isInt({ min: 0 }).withMessage("Estoque inválido."),
    body("category_id").optional().isInt({ min: 1 }).withMessage("Categoria inválida."),
    body("supplier_id").optional().isInt({ min: 1 }).withMessage("Fornecedor inválido."),
    body("min_stock").optional().isInt({ min: 0 }).withMessage("Estoque mínimo inválido."),
    body("max_stock").optional().isInt({ min: 0 }).withMessage("Estoque máximo inválido."),
    body("expires_at").optional().isISO8601().withMessage("Data de validade inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      sku,
      unit_type,
      category_id = null,
      supplier_id = null,
      min_stock = 0,
      max_stock = 0,
      current_stock = 0,
      price = 0,
      expires_at = null,
    } = req.body;

    if (Number(max_stock) && Number(min_stock) > Number(max_stock)) {
      return res.status(400).json({ message: "Estoque mínimo não pode exceder o máximo." });
    }

    db.run(
      `INSERT INTO products (name, sku, unit_type, category_id, supplier_id, min_stock, max_stock, current_stock, price, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        name,
        sku,
        unit_type,
        category_id,
        supplier_id,
        min_stock,
        max_stock,
        current_stock,
        price,
        expires_at,
      ],
      (err, result) => {
        if (err) {
          return res.status(400).json({ message: "Erro ao cadastrar produto." });
        }
        return res.status(201).json({ id: result.rows[0].id });
      }
    );
  }
);

app.post(
  "/api/stock/loss",
  authenticateToken,
  requireSupervisor,
  [
    body("product_id").isInt({ min: 1 }).withMessage("Produto inválido."),
    body("quantity").isInt({ min: 1 }).withMessage("Quantidade inválida."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { product_id, quantity, reason } = req.body;
    db.get("SELECT * FROM products WHERE id = ?", [product_id], (err, product) => {
      if (err || !product) {
        return res.status(404).json({ message: "Produto não encontrado." });
      }
      if (product.current_stock < quantity) {
        return res.status(400).json({ message: "Estoque insuficiente." });
      }

      const lossValue = Number(product.price) * Number(quantity);
      return getSettings(["max_losses"], (settings) => {
        const maxLosses = Number(settings.max_losses || 0);
        const requiresApproval = maxLosses > 0 && lossValue > maxLosses;
        const approvalToken = req.headers["x-approval-token"];

        const proceed = (approval) => {
          let createdId = null;
          runWithTransaction((tx, finish) => {
            const nextStock = product.current_stock - quantity;
            tx.run(
              "UPDATE products SET current_stock = ? WHERE id = ?",
              [nextStock, product_id],
              (updateErr) => {
                if (updateErr) {
                  finish(updateErr);
                  return;
                }

                tx.get(
                  "INSERT INTO stock_losses (product_id, quantity, reason) VALUES (?, ?, ?) RETURNING id",
                  [product_id, quantity, reason],
                  (lossErr, row) => {
                    if (lossErr) {
                      finish(lossErr);
                      return;
                    }
                    createdId = row.id;
                    tx.run(
                      "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
                      [product_id, "loss", -Number(quantity), reason, req.user.id],
                      (movementErr) => {
                        if (movementErr) {
                          finish(movementErr);
                          return;
                        }
                        tx.run(
                          "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
                          [
                            "stock_loss",
                            JSON.stringify({ product_id, quantity, reason, loss_value: lossValue }),
                            req.user.id,
                            approval?.approved_by || null,
                          ],
                          (auditErr) => {
                            if (auditErr) {
                              finish(auditErr);
                              return;
                            }
                            finish(null);
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }, (transactionErr) => {
            if (transactionErr) {
              return res.status(500).json({ message: "Erro ao registrar perda." });
            }
            return res.status(201).json({ id: createdId });
          });
        };

        if (requiresApproval) {
          return verifyApprovalToken(approvalToken, "stock_loss", (error, approval) => {
            if (error) {
              return res.status(error.status).json({ message: error.message });
            }
            return proceed(approval);
          });
        }

        return proceed(null);
      });
    });
  }
);

app.post(
  "/api/stock/adjust",
  authenticateToken,
  requireSupervisor,
  [
    body("product_id").isInt({ min: 1 }).withMessage("Produto é obrigatório."),
    body("delta").isFloat({ min: -100000, max: 100000 }).withMessage("Ajuste inválido."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { product_id, delta, reason } = req.body;
    db.get("SELECT * FROM products WHERE id = ?", [product_id], (err, product) => {
      if (err || !product) {
        return res.status(404).json({ message: "Produto não encontrado." });
      }
      const nextStock = Number(product.current_stock) + Number(delta);
      if (nextStock < 0) {
        return res.status(400).json({ message: "Estoque insuficiente para ajuste." });
      }
      const adjustmentValue = Math.abs(Number(delta)) * Number(product.price || 0);
      return getSettings(["max_stock_adjust"], (settings) => {
        const maxStockAdjust = Number(settings.max_stock_adjust || 0);
        const requiresApproval = maxStockAdjust > 0 && adjustmentValue > maxStockAdjust;
        const approvalToken = req.headers["x-approval-token"];

        const proceed = (approval) => {
          runWithTransaction((tx, finish) => {
            tx.run(
              "UPDATE products SET current_stock = ? WHERE id = ?",
              [nextStock, product.id],
              (updateErr) => {
                if (updateErr) {
                  finish(updateErr);
                  return;
                }
                tx.run(
                  "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
                  [product.id, "adjust", delta, reason, req.user.id],
                  (movementErr) => {
                    if (movementErr) {
                      finish(movementErr);
                      return;
                    }
                    tx.run(
                      "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
                      [
                        "stock_adjust",
                        JSON.stringify({ product_id: product.id, product_name: product.name, delta, reason }),
                        req.user.id,
                        approval?.approved_by || null,
                      ],
                      (auditErr) => {
                        if (auditErr) {
                          finish(auditErr);
                          return;
                        }
                        finish(null);
                      }
                    );
                  }
                );
              }
            );
          }, (transactionErr) => {
            if (transactionErr) {
              return res.status(500).json({ message: "Erro ao ajustar estoque." });
            }
            return res.json({ id: product.id, current_stock: nextStock });
          });
        };

        if (requiresApproval) {
          return verifyApprovalToken(approvalToken, "stock_adjust", (error, approval) => {
            if (error) {
              return res.status(error.status).json({ message: error.message });
            }
            return proceed(approval);
          });
        }

        return proceed(null);
      });
    });
  }
);

app.post(
  "/api/stock/move",
  authenticateToken,
  requireSupervisor,
  [
    body("product_id").isInt({ min: 1 }).withMessage("Produto é obrigatório."),
    body("quantity").isFloat({ min: 0.01 }).withMessage("Quantidade inválida."),
    body("type").isIn(["inbound", "outbound"]).withMessage("Tipo inválido."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { product_id, quantity, type, reason } = req.body;
    const delta = type === "inbound" ? Number(quantity) : -Number(quantity);
    db.get("SELECT * FROM products WHERE id = ?", [product_id], (err, product) => {
      if (err || !product) {
        return res.status(404).json({ message: "Produto não encontrado." });
      }
      const nextStock = Number(product.current_stock) + delta;
      if (nextStock < 0) {
        return res.status(400).json({ message: "Estoque insuficiente." });
      }
      runWithTransaction((tx, finish) => {
        tx.run(
          "UPDATE products SET current_stock = ? WHERE id = ?",
          [nextStock, product.id],
          (updateErr) => {
            if (updateErr) {
              finish(updateErr);
              return;
            }
            tx.run(
              "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
              [product.id, type, delta, reason, req.user.id],
              (movementErr) => {
                if (movementErr) {
                  finish(movementErr);
                  return;
                }
                tx.run(
                  "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
                  [
                    type === "inbound" ? "stock_inbound" : "stock_outbound",
                    JSON.stringify({ product_id: product.id, product_name: product.name, delta, reason }),
                    req.user.id,
                    null,
                  ],
                  (auditErr) => {
                    if (auditErr) {
                      finish(auditErr);
                      return;
                    }
                    finish(null);
                  }
                );
              }
            );
          }
        );
      }, (transactionErr) => {
        if (transactionErr) {
          return res.status(500).json({ message: "Erro ao movimentar estoque." });
        }
        return res.json({ id: product.id, current_stock: nextStock });
      });
    });
  }
);

app.get("/api/stock/loss", authenticateToken, (req, res) => {
  db.all(
    `SELECT stock_losses.*, products.name AS product_name
     FROM stock_losses
     JOIN products ON products.id = stock_losses.product_id
     ORDER BY stock_losses.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar perdas." });
      }
      return res.json(rows);
    }
  );
});

app.get("/api/stock/movements", authenticateToken, (req, res) => {
  const productId = Number(req.query.product_id || 0);
  const limit = Number(req.query.limit || 20);
  const params = [];
  let whereClause = "";
  if (productId) {
    whereClause = "WHERE stock_movements.product_id = ?";
    params.push(productId);
  }
  const safeLimit = Number.isNaN(limit) ? 20 : Math.min(Math.max(limit, 1), 100);
  db.all(
    `SELECT stock_movements.*, products.name AS product_name, products.unit_type
     FROM stock_movements
     JOIN products ON products.id = stock_movements.product_id
     ${whereClause}
     ORDER BY stock_movements.created_at DESC
     LIMIT ${safeLimit}`,
    params,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar movimentações." });
      }
      const mapped = rows.map((row) => {
        const typeLabel =
          row.type === "loss"
            ? "Perda"
            : row.type === "sale"
            ? "Venda"
            : row.type === "adjust"
            ? "Ajuste"
            : row.type === "inbound"
            ? "Entrada"
            : row.type === "outbound"
            ? "Saída"
            : "Movimentação";
        const dateLabel = row.created_at ? row.created_at.split(" ")[0] : "";
        return {
          id: row.id,
          product_id: row.product_id,
          delta: row.delta,
          type: row.type,
          reason: row.reason,
          unit_type: row.unit_type,
          label: `${typeLabel} • ${row.product_name}${dateLabel ? ` • ${dateLabel}` : ""}`,
        };
      });
      return res.json(mapped);
    }
  );
});

app.get("/api/stock/restock-suggestions", authenticateToken, (req, res) => {
  db.all(
    `SELECT products.id, products.name, products.unit_type, products.current_stock, products.min_stock, products.max_stock,
            suppliers.name AS supplier_name, suppliers.id AS supplier_id
     FROM products
     LEFT JOIN suppliers ON suppliers.id = products.supplier_id
     WHERE products.min_stock > 0 AND products.current_stock <= products.min_stock
     ORDER BY products.current_stock ASC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar sugestões." });
      }
      return res.json(rows);
    }
  );
});

app.post(
  "/api/purchase-orders",
  authenticateToken,
  requireManager,
  [
    body("items").isArray({ min: 1 }).withMessage("Itens são obrigatórios."),
    body("items.*.product_id").isInt({ min: 1 }).withMessage("Produto inválido."),
    body("items.*.quantity").isFloat({ min: 0.01 }).withMessage("Quantidade inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { items } = req.body;
    const productIds = items.map((item) => item.product_id);
    db.all(
      `SELECT id, supplier_id FROM products WHERE id IN (${productIds.map(() => "?").join(",")})`,
      productIds,
      (err, rows) => {
        if (err) {
          return res.status(500).json({ message: "Erro ao buscar produtos." });
        }
        if (!rows.length) {
          return res.status(400).json({ message: "Produtos inválidos." });
        }
        const supplierId = rows[0].supplier_id || null;
        let createdOrderId = null;
        runWithTransaction((tx, finish) => {
          tx.get(
            "INSERT INTO purchase_orders (supplier_id, created_by) VALUES (?, ?) RETURNING id",
            [supplierId, req.user.id],
            (orderErr, row) => {
              if (orderErr) {
                finish(orderErr);
                return;
              }
              const orderId = row.id;
              createdOrderId = orderId;
              let pending = items.length;
              let failed = false;
              items.forEach((item) => {
                tx.run(
                  "INSERT INTO purchase_order_items (order_id, product_id, quantity) VALUES (?, ?, ?)",
                  [orderId, item.product_id, item.quantity],
                  (itemErr) => {
                    if (failed) {
                      return;
                    }
                    if (itemErr) {
                      failed = true;
                      finish(itemErr);
                      return;
                    }
                    pending -= 1;
                    if (pending === 0) {
                      tx.run(
                        "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
                        [
                          "purchase_order_created",
                          JSON.stringify({ order_id: orderId, items }),
                          req.user.id,
                          null,
                        ],
                        (auditErr) => {
                          if (auditErr) {
                            finish(auditErr);
                            return;
                          }
                          finish(null);
                        }
                      );
                    }
                  }
                );
              });
            }
          );
        }, (transactionErr) => {
          if (transactionErr) {
            return res.status(500).json({ message: "Erro ao criar pedido." });
          }
          return res.status(201).json({ id: createdOrderId });
        });
      }
    );
  }
);

app.get("/api/purchase-orders", authenticateToken, requireManager, (req, res) => {
  db.all(
    `SELECT purchase_orders.*, suppliers.name AS supplier_name
     FROM purchase_orders
     LEFT JOIN suppliers ON suppliers.id = purchase_orders.supplier_id
     ORDER BY purchase_orders.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar pedidos." });
      }
      return res.json(rows);
    }
  );
});

app.get("/api/purchase-orders/:id/items", authenticateToken, requireManager, (req, res) => {
  const orderId = Number(req.params.id);
  if (!orderId) {
    return res.status(400).json({ message: "Pedido inválido." });
  }
  db.all(
    `SELECT purchase_order_items.*, products.name AS product_name, products.unit_type
     FROM purchase_order_items
     JOIN products ON products.id = purchase_order_items.product_id
     WHERE purchase_order_items.order_id = ?`,
    [orderId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar itens." });
      }
      return res.json(rows);
    }
  );
});

app.post(
  "/api/purchase-orders/:id/receive",
  authenticateToken,
  requireManager,
  (req, res) => {
    const orderId = Number(req.params.id);
    if (!orderId) {
      return res.status(400).json({ message: "Pedido inválido." });
    }
    db.get("SELECT * FROM purchase_orders WHERE id = ?", [orderId], (err, order) => {
      if (err || !order) {
        return res.status(404).json({ message: "Pedido não encontrado." });
      }
      if (order.status === "received") {
        return res.status(400).json({ message: "Pedido já recebido." });
      }
      db.all(
        "SELECT * FROM purchase_order_items WHERE order_id = ?",
        [orderId],
        (itemsErr, items) => {
          if (itemsErr || !items.length) {
            return res.status(500).json({ message: "Itens do pedido não encontrados." });
          }
          runWithTransaction((tx, finish) => {
            let processed = 0;
            let completed = false;
            const finalize = (err) => {
              if (completed) {
                return;
              }
              completed = true;
              finish(err);
            };
            const handleItem = (item) => {
              tx.get(
                "SELECT * FROM products WHERE id = ?",
                [item.product_id],
                (productErr, product) => {
                  if (productErr || !product) {
                    finalize(productErr || new Error("Produto não encontrado."));
                    return;
                  }
                  const nextStock = Number(product.current_stock) + Number(item.quantity);
                  tx.run(
                    "UPDATE products SET current_stock = ? WHERE id = ?",
                    [nextStock, product.id],
                    (updateErr) => {
                      if (updateErr) {
                        finalize(updateErr);
                        return;
                      }
                      tx.run(
                        "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
                        [
                          product.id,
                          "inbound",
                          Number(item.quantity),
                          `Recebimento pedido #${orderId}`,
                          req.user.id,
                        ],
                        (movementErr) => {
                          if (movementErr) {
                            finalize(movementErr);
                            return;
                          }
                          processed += 1;
                          if (processed === items.length) {
                            tx.run(
                              "UPDATE purchase_orders SET status = 'received', received_at = CURRENT_TIMESTAMP WHERE id = ?",
                              [orderId],
                              (orderErr) => {
                                if (orderErr) {
                                  finalize(orderErr);
                                  return;
                                }
                                tx.run(
                                  "INSERT INTO audit_logs (action, details, performed_by, approved_by) VALUES (?, ?, ?, ?)",
                                  [
                                    "purchase_order_received",
                                    JSON.stringify({ order_id: orderId }),
                                    req.user.id,
                                    null,
                                  ],
                                  (auditErr) => {
                                    if (auditErr) {
                                      finalize(auditErr);
                                      return;
                                    }
                                    finalize(null);
                                  }
                                );
                              }
                            );
                          }
                        }
                      );
                    }
                  );
                }
              );
            };
            items.forEach(handleItem);
          }, (transactionErr) => {
            if (transactionErr) {
              return res.status(500).json({ message: "Erro ao receber pedido." });
            }
            return res.json({ id: orderId, status: "received" });
          });
        }
      );
    });
  }
);

app.get("/api/discounts", authenticateToken, requireManager, (req, res) => {
  db.all("SELECT * FROM discounts ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar descontos." });
    }
    return res.json(rows);
  });
});

app.post(
  "/api/discounts",
  authenticateToken,
  requireManager,
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("type")
      .isIn(["percent", "fixed", "buy_x_get_y", "fixed_bundle"])
      .withMessage("Tipo inválido."),
    body("value").optional().isFloat({ min: 0 }).withMessage("Valor inválido."),
    body("target_type")
      .optional()
      .isIn(["all", "category", "product", "combo"])
      .withMessage("Alvo inválido."),
    body("stacking_rule")
      .optional()
      .isIn(["exclusive", "priority"])
      .withMessage("Regra de empilhamento inválida."),
    body("priority").optional().isInt({ min: 0 }).withMessage("Prioridade inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      type,
      value = 0,
      min_quantity = 0,
      buy_quantity = 0,
      get_quantity = 0,
      target_type = "all",
      target_value = null,
      days_of_week = null,
      starts_at = null,
      ends_at = null,
      starts_time = null,
      ends_time = null,
      stacking_rule = null,
      criteria = null,
      priority = 0,
      active = 1,
    } = req.body;

    if (type === "fixed_bundle" && (!buy_quantity || !value)) {
      return res.status(400).json({ message: "Quantidade e preço do combo são obrigatórios." });
    }

    return getSettings(["max_discount"], (settings) => {
      const maxDiscount = Number(settings.max_discount || 0);
      if (type === "percent" && maxDiscount > 0 && Number(value) > maxDiscount) {
        return res.status(403).json({ message: "Desconto acima do limite permitido." });
      }

      db.get(
        `INSERT INTO discounts (
          name,
          type,
          value,
          min_quantity,
          buy_quantity,
          get_quantity,
          target_type,
          target_value,
          days_of_week,
          starts_at,
          ends_at,
          starts_time,
          ends_time,
          stacking_rule,
          criteria,
          priority,
          active
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          name,
          type,
          value,
          min_quantity,
          buy_quantity,
          get_quantity,
          target_type,
          target_value,
          days_of_week ? JSON.stringify(days_of_week) : null,
          starts_at,
          ends_at,
          starts_time,
          ends_time,
          stacking_rule,
          criteria ? JSON.stringify(criteria) : null,
          priority,
          active ? 1 : 0,
        ],
        (err, row) => {
          if (err) {
            return res.status(400).json({ message: "Erro ao cadastrar desconto." });
          }
          logAudit({
            action: "discount_created",
            details: { id: row.id, name, type, value },
            performedBy: req.user.id,
          });
          return res.status(201).json({ id: row.id });
        }
      );
    });
  }
);

app.put(
  "/api/discounts/:id",
  authenticateToken,
  requireManager,
  [
    body("type")
      .optional()
      .isIn(["percent", "fixed", "buy_x_get_y", "fixed_bundle"])
      .withMessage("Tipo inválido."),
    body("value").optional().isFloat({ min: 0 }).withMessage("Valor inválido."),
    body("target_type")
      .optional()
      .isIn(["all", "category", "product", "combo"])
      .withMessage("Alvo inválido."),
    body("stacking_rule")
      .optional()
      .isIn(["exclusive", "priority"])
      .withMessage("Regra de empilhamento inválida."),
    body("priority").optional().isInt({ min: 0 }).withMessage("Prioridade inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const discountId = Number(req.params.id);
    if (!discountId) {
      return res.status(400).json({ message: "Desconto inválido." });
    }

    db.get("SELECT * FROM discounts WHERE id = ?", [discountId], (err, discount) => {
      if (err || !discount) {
        return res.status(404).json({ message: "Desconto não encontrado." });
      }

      const payload = req.body;
      const updated = {
        name: payload.name ?? discount.name,
        type: payload.type ?? discount.type,
        value: payload.value ?? discount.value,
        min_quantity: payload.min_quantity ?? discount.min_quantity,
        buy_quantity: payload.buy_quantity ?? discount.buy_quantity,
        get_quantity: payload.get_quantity ?? discount.get_quantity,
        target_type: payload.target_type ?? discount.target_type,
        target_value: payload.target_value ?? discount.target_value,
        days_of_week: payload.days_of_week ?? discount.days_of_week,
        starts_at: payload.starts_at ?? discount.starts_at,
        ends_at: payload.ends_at ?? discount.ends_at,
        starts_time: payload.starts_time ?? discount.starts_time,
        ends_time: payload.ends_time ?? discount.ends_time,
        stacking_rule: payload.stacking_rule ?? discount.stacking_rule,
        criteria: payload.criteria ?? discount.criteria,
        priority: payload.priority ?? discount.priority,
        active:
          typeof payload.active === "undefined" ? discount.active : payload.active ? 1 : 0,
      };

      if (updated.type === "fixed_bundle" && (!updated.buy_quantity || !updated.value)) {
        return res.status(400).json({ message: "Quantidade e preço do combo são obrigatórios." });
      }

      return getSettings(["max_discount"], (settings) => {
        const maxDiscount = Number(settings.max_discount || 0);
        if (updated.type === "percent" && maxDiscount > 0 && Number(updated.value) > maxDiscount) {
          return res.status(403).json({ message: "Desconto acima do limite permitido." });
        }

        db.run(
          `UPDATE discounts
           SET name = ?, type = ?, value = ?, min_quantity = ?, buy_quantity = ?, get_quantity = ?,
               target_type = ?, target_value = ?, days_of_week = ?, starts_at = ?, ends_at = ?,
               starts_time = ?, ends_time = ?, stacking_rule = ?, criteria = ?, priority = ?, active = ?
           WHERE id = ?`,
          [
            updated.name,
            updated.type,
            updated.value,
            updated.min_quantity,
            updated.buy_quantity,
            updated.get_quantity,
            updated.target_type,
            updated.target_value,
            Array.isArray(updated.days_of_week) ? JSON.stringify(updated.days_of_week) : updated.days_of_week,
            updated.starts_at,
            updated.ends_at,
            updated.starts_time,
            updated.ends_time,
            updated.stacking_rule,
            Array.isArray(updated.criteria) ? JSON.stringify(updated.criteria) : updated.criteria,
            updated.priority,
            updated.active,
            discountId,
          ],
          (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ message: "Erro ao atualizar desconto." });
            }
            logAudit({
              action: "discount_updated",
              details: { id: discountId, name: updated.name, type: updated.type, value: updated.value },
              performedBy: req.user.id,
            });
            return res.json({ id: discountId });
          }
        );
      });
    });
  }
);

app.post(
  "/api/sales",
  authenticateToken,
  [
    body("product_id").isInt({ min: 1 }).withMessage("Produto inválido."),
    body("quantity").isInt({ min: 1 }).withMessage("Quantidade inválida."),
    body("payment_method").trim().notEmpty().withMessage("Pagamento é obrigatório."),
    body("discount_id").optional().isInt({ min: 1 }).withMessage("Desconto inválido."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { product_id, quantity, payment_method, discount_id = null } = req.body;
    let responsePayload = null;
    let responseStatus = 201;

    runWithTransaction((tx, finish) => {
      tx.get("SELECT * FROM products WHERE id = ?", [product_id], (err, product) => {
        if (err) {
          finish(err);
          return;
        }
        if (!product) {
          finish({ status: 404, message: "Produto não encontrado." });
          return;
        }
        if (product.current_stock < quantity) {
          finish({ status: 400, message: "Estoque insuficiente." });
          return;
        }

        const total = Number(product.price) * Number(quantity);
        const applySale = (discount, discountAmount) => {
          const nextStock = product.current_stock - quantity;
          const finalTotal = Math.max(total - discountAmount, 0);

          tx.run(
            "UPDATE products SET current_stock = ? WHERE id = ?",
            [nextStock, product_id],
            (updateErr) => {
              if (updateErr) {
                finish(updateErr);
                return;
              }

              tx.get(
                `INSERT INTO sales (product_id, quantity, total, discount_id, discount_amount, final_total, payment_method, sold_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
                [
                  product_id,
                  quantity,
                  total,
                  discount?.id || null,
                  discountAmount,
                  finalTotal,
                  payment_method,
                  req.user.id,
                ],
                (saleErr, row) => {
                  if (saleErr) {
                    finish(saleErr);
                    return;
                  }
                  tx.run(
                    "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
                    [product_id, "sale", -Number(quantity), "Venda PDV", req.user.id],
                    (movementErr) => {
                      if (movementErr) {
                        finish(movementErr);
                        return;
                      }
                      responsePayload = {
                        id: row.id,
                        total,
                        discount_amount: discountAmount,
                        final_total: finalTotal,
                      };
                      finish(null);
                    }
                  );
                }
              );
            }
          );
        };

        if (!discount_id) {
          applySale(null, 0);
          return;
        }

        tx.get("SELECT * FROM discounts WHERE id = ? AND active = 1", [discount_id], (discountErr, discount) => {
          if (discountErr) {
            finish(discountErr);
            return;
          }
          if (!discount) {
            finish({ status: 400, message: "Desconto inválido." });
            return;
          }

          let discountAmount = 0;
          if (discount.type === "percent") {
            discountAmount = total * (Number(discount.value) / 100);
          } else if (discount.type === "fixed") {
            discountAmount = Number(discount.value);
          } else if (discount.type === "buy_x_get_y") {
            const buyQty = Number(discount.buy_quantity);
            const getQty = Number(discount.get_quantity);
            if (buyQty > 0 && quantity >= buyQty) {
              discountAmount = Number(product.price) * getQty;
            }
          } else if (discount.type === "fixed_bundle") {
            const bundleQty = Number(discount.buy_quantity);
            const bundlePrice = Number(discount.value);
            if (bundleQty > 0 && bundlePrice >= 0) {
              const bundles = Math.floor(quantity / bundleQty);
              const remainder = quantity % bundleQty;
              const bundleTotal = bundles * bundlePrice;
              const remainderTotal = remainder * Number(product.price);
              discountAmount = total - (bundleTotal + remainderTotal);
            }
          }

          if (discount.min_quantity && quantity < Number(discount.min_quantity)) {
            discountAmount = 0;
          }

          if (discountAmount < 0) {
            discountAmount = 0;
          }

          getSettings(["max_discount"], (settings) => {
            const maxDiscount = Number(settings.max_discount || 0);
            const discountPercent = total > 0 ? (discountAmount / total) * 100 : 0;
            if (maxDiscount > 0 && discountPercent > maxDiscount) {
              finish({ status: 403, message: "Desconto acima do limite permitido." });
              return;
            }
            applySale(discount, discountAmount);
          });
        });
      });
    }, (transactionErr) => {
      if (transactionErr) {
        if (transactionErr.status) {
          return res.status(transactionErr.status).json({ message: transactionErr.message });
        }
        return res.status(500).json({ message: "Erro ao registrar venda." });
      }
      return res.status(responseStatus).json(responsePayload);
    });
  }
);

app.get("/api/reports/summary", authenticateToken, (req, res) => {
  const range = parseDateRange(req, res);
  if (!range) {
    return;
  }
  const salesFilter = buildDateFilter("sales.created_at", range);
  db.get(
    `SELECT SUM(final_total) AS total_sales FROM sales ${salesFilter.clause}`,
    salesFilter.params,
    (salesErr, salesRow) => {
      if (salesErr) {
        return res.status(500).json({ message: "Erro ao gerar relatório." });
      }

      const lossFilter = buildDateFilter("stock_losses.created_at", range);
      db.get(
        `SELECT SUM(products.price * stock_losses.quantity) AS total_losses
         FROM stock_losses
         JOIN products ON products.id = stock_losses.product_id
         ${lossFilter.clause}`,
        lossFilter.params,
        (lossErr, lossRow) => {
          if (lossErr) {
            return res.status(500).json({ message: "Erro ao gerar relatório." });
          }

          db.all(
            `SELECT id, name, current_stock, min_stock
             FROM products
             WHERE current_stock <= min_stock`,
            [],
            (stockErr, lowStockRows) => {
              if (stockErr) {
                return res.status(500).json({ message: "Erro ao gerar relatório." });
              }

              db.all(
                `SELECT id, name, expires_at
                 FROM products
                 WHERE expires_at IS NOT NULL
                 ORDER BY expires_at ASC
                 LIMIT 10`,
                [],
                (expErr, expRows) => {
                  if (expErr) {
                    return res.status(500).json({ message: "Erro ao gerar relatório." });
                  }

                  return res.json({
                    total_sales: salesRow?.total_sales || 0,
                    total_losses: lossRow?.total_losses || 0,
                    low_stock: lowStockRows,
                    expiring_products: expRows,
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

app.get("/api/audit-logs", authenticateToken, requireManager, (req, res) => {
  db.all(
    `SELECT audit_logs.*, users.name AS performed_by_name, approvers.name AS approved_by_name
     FROM audit_logs
     LEFT JOIN users ON users.id = audit_logs.performed_by
     LEFT JOIN users AS approvers ON approvers.id = audit_logs.approved_by
     ORDER BY audit_logs.created_at DESC
     LIMIT 100`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao buscar logs." });
      }
      return res.json(rows);
    }
  );
});

app.get("/api/reports/by-operator", authenticateToken, requireManager, (req, res) => {
  const range = parseDateRange(req, res);
  if (!range) {
    return;
  }
  const salesFilter = buildDateFilter("sales.created_at", range);
  db.all(
    `SELECT users.id, users.name, SUM(sales.final_total) AS total_sales, SUM(sales.quantity) AS total_items
     FROM sales
     LEFT JOIN users ON users.id = sales.sold_by
     ${salesFilter.clause}
     GROUP BY sales.sold_by
     ORDER BY total_sales DESC`,
    salesFilter.params,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao gerar relatório." });
      }
      return res.json(rows);
    }
  );
});

app.get("/api/reports/by-category", authenticateToken, requireManager, (req, res) => {
  const range = parseDateRange(req, res);
  if (!range) {
    return;
  }
  const salesFilter = buildDateFilter("sales.created_at", range);
  db.all(
    `SELECT categories.name AS category, SUM(sales.final_total) AS total_sales, SUM(sales.quantity) AS total_items
     FROM sales
     JOIN products ON products.id = sales.product_id
     LEFT JOIN categories ON categories.id = products.category_id
     ${salesFilter.clause}
     GROUP BY categories.name
     ORDER BY total_sales DESC`,
    salesFilter.params,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao gerar relatório." });
      }
      return res.json(rows);
    }
  );
});

app.post(
  "/api/approvals",
  [
    body("email").isEmail().withMessage("Email inválido."),
    body("password").notEmpty().withMessage("Senha é obrigatória."),
    body("action")
      .isIn(["remove_item", "discount_override", "cancel_sale", "user_update", "stock_loss", "stock_adjust"])
      .withMessage("Ação inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, action, reason = "", metadata = {} } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ message: "Credenciais inválidas." });
      }
      if (!hasRole(user, "manager")) {
        return res.status(403).json({ message: "Aprovação requer gerente ou admin." });
      }
      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: "Credenciais inválidas." });
      }

      const token = crypto.randomBytes(16).toString("hex");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      db.run(
        `INSERT INTO approvals (token_hash, action, reason, metadata, approved_by, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tokenHash, action, reason, JSON.stringify(metadata), user.id, expiresAt],
        function handleInsert(err) {
          if (err) {
            return res.status(500).json({ message: "Erro ao registrar aprovação." });
          }
          logAudit({
            action: "approval_granted",
            details: { action, reason, metadata },
            performedBy: user.id,
            approvedBy: user.id,
          });
          return res.status(201).json({ token, expires_at: expiresAt });
        }
      );
    });
  }
);

app.post(
  "/api/pos/remove-item",
  authenticateToken,
  requireApproval("remove_item"),
  [
    body("item").trim().notEmpty().withMessage("Item é obrigatório."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { item, reason } = req.body;
    logAudit({
      action: "remove_item",
      details: { item, reason },
      performedBy: req.user.id,
      approvedBy: req.approval?.approved_by,
    });
    return res.json({ status: "ok" });
  }
);

app.post(
  "/api/pos/discount-override",
  authenticateToken,
  [
    body("amount").isFloat({ min: 0 }).withMessage("Valor inválido."),
    body("subtotal").optional().isFloat({ min: 0 }).withMessage("Subtotal inválido."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, reason, subtotal = 0 } = req.body;
    const baseTotal = Number(subtotal) || 0;
    const discountPercent = baseTotal > 0 ? (Number(amount) / baseTotal) * 100 : 0;
    return getSettings(["max_discount", "approval_threshold"], (settings) => {
      const maxDiscount = Number(settings.max_discount || 0);
      if ((maxDiscount > 0 || Number(settings.approval_threshold || 0) > 0) && baseTotal <= 0 && Number(amount) > 0) {
        return res.status(400).json({ message: "Subtotal obrigatório para validar o desconto." });
      }
      if (maxDiscount > 0 && discountPercent > maxDiscount) {
        return res.status(403).json({ message: "Desconto acima do limite permitido." });
      }

      const approvalThreshold = Number(settings.approval_threshold || 0);
      const needsApproval = approvalThreshold > 0 && discountPercent >= approvalThreshold;
      const approvalToken = req.headers["x-approval-token"];

      const finalize = (approval) => {
        logAudit({
          action: "discount_override",
          details: { amount, reason, subtotal: baseTotal, percent: discountPercent },
          performedBy: req.user.id,
          approvedBy: approval?.approved_by,
        });
        return res.json({ status: "ok" });
      };

      if (needsApproval) {
        return verifyApprovalToken(approvalToken, "discount_override", (error, approval) => {
          if (error) {
            return res.status(error.status).json({ message: error.message });
          }
          return finalize(approval);
        });
      }

      return finalize(null);
    });
  }
);

app.post(
  "/api/pos/cancel-sale",
  authenticateToken,
  requireApproval("cancel_sale"),
  [
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
    body("items").isInt({ min: 0 }).withMessage("Itens inválidos."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { reason, items } = req.body;
    logAudit({
      action: "cancel_sale",
      details: { reason, items },
      performedBy: req.user.id,
      approvedBy: req.approval?.approved_by,
    });
    return res.json({ status: "ok" });
  }
);

app.get("/api/pos/devices", authenticateToken, (req, res) => {
  db.all("SELECT * FROM pos_devices ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar dispositivos." });
    }
    return res.json(rows);
  });
});

app.post(
  "/api/pos/devices",
  authenticateToken,
  requireAdmin,
  [
    body("type").isIn(["scanner", "scale"]).withMessage("Tipo inválido."),
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("connection").trim().notEmpty().withMessage("Conexão é obrigatória."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, name, connection, config = "", active = 1 } = req.body;

    db.get(
      "INSERT INTO pos_devices (type, name, connection, config, active) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [type, name, connection, JSON.stringify(config), active ? 1 : 0],
      (err, row) => {
        if (err) {
          return res.status(400).json({ message: "Erro ao cadastrar dispositivo." });
        }
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`GreenStore API rodando na porta ${PORT}`);
  });
}

module.exports = { app, db };
