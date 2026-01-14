const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body } = require("express-validator");
const db = require("../../db");
const config = require("../../config");
const { authenticateToken } = require("./middleware/auth");
const { sendPasswordResetNotification } = require("../services/notifications");
const { logAudit } = require("./utils/audit");
const { getSettings } = require("./utils/settings");
const { hashToken } = require("./utils/tokens");
const { runWithTransaction } = require("./utils/transactions");
const validate = require("../middleware/validate");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

const { JWT_SECRET, ADMIN_BOOTSTRAP_TOKEN, PASSWORD_RESET_TTL_MINUTES } = config;

router.post(
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
  validate,
  (req, res) => {
    const { name, email, password, phone = null } = req.body;
    const passwordHash = bcrypt.hashSync(password, 10);

    db.get(
      "INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?) RETURNING id",
      [name, email, phone, passwordHash],
      (err, row) => {
        if (err) {
          return sendError(res, req, {
            status: 409,
            code: errorCodes.CONFLICT,
            message: "Email já cadastrado.",
          });
        }
        return res.status(201).json({ id: row.id, name, email, phone });
      }
    );
  }
);

router.post(
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
  validate,
  (req, res) => {
    if (!ADMIN_BOOTSTRAP_TOKEN) {
      return sendError(res, req, {
        status: 500,
        code: errorCodes.INTERNAL_ERROR,
        message: "Bootstrap não configurado.",
      });
    }
    const bootstrapToken = req.headers["x-bootstrap-token"];
    if (bootstrapToken !== ADMIN_BOOTSTRAP_TOKEN) {
      return sendError(res, req, {
        status: 403,
        code: errorCodes.FORBIDDEN,
        message: "Token de bootstrap inválido.",
      });
    }

    db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", [], (err, row) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao verificar administradores.",
        });
      }
      if (row) {
        return sendError(res, req, {
          status: 409,
          code: errorCodes.CONFLICT,
          message: "Administrador já configurado.",
        });
      }

      const { name, email, password, phone = null } = req.body;
      const passwordHash = bcrypt.hashSync(password, 10);
      const permissions = ["admin", "logs", "relatorios", "descontos", "estoque", "caixa"];

      db.get(
        "INSERT INTO users (name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
        [name, email, phone, passwordHash, "admin", JSON.stringify(permissions)],
        (insertErr, row) => {
          if (insertErr) {
            return sendError(res, req, {
              status: 500,
              code: errorCodes.INTERNAL_ERROR,
              message: "Erro ao criar administrador.",
            });
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

router.post("/api/auth/logout", authenticateToken, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace("Bearer ", "") : null;
  if (!token) {
    return sendError(res, req, {
      status: 400,
      code: errorCodes.INVALID_REQUEST,
      message: "Token não informado.",
    });
  }
  db.run(
    "UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token = ?",
    [token],
    (err) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao encerrar sessão.",
        });
      }
      return res.json({ status: "ok" });
    }
  );
});

router.post(
  "/api/auth/request-password-reset",
  [body("email").isEmail().withMessage("Email inválido.")],
  validate,
  (req, res) => {
    const { email } = req.body;
    db.get("SELECT id, email, phone FROM users WHERE email = ?", [email], (err, user) => {
      if (err || !user) {
        return res.status(200).json({ status: "ok" });
      }
      const hasEmailChannel = Boolean(config.SMTP_HOST && config.RESET_EMAIL_FROM && user.email);
      const hasSmsChannel = Boolean(config.RESET_SMS_WEBHOOK_URL && user.phone);
      if (!hasEmailChannel && !hasSmsChannel) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Canal de reset não configurado.",
        });
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
            return sendError(res, req, {
              status: 500,
              code: errorCodes.INTERNAL_ERROR,
              message: "Erro ao criar reset.",
            });
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
              return sendError(res, req, {
                status: 500,
                code: errorCodes.INTERNAL_ERROR,
                message: "Erro ao enviar reset.",
                details: { detail: notifyErr.message },
              });
            });
        }
      );
    });
  }
);

router.post(
  "/api/auth/reset-password",
  [
    body("token").trim().notEmpty().withMessage("Token é obrigatório."),
    body("password").isLength({ min: 8 }).withMessage("Senha deve ter 8+ caracteres."),
  ],
  validate,
  (req, res) => {
    const { token, password } = req.body;
    const tokenHash = hashToken(token);
    db.get(
      "SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL",
      [tokenHash],
      (err, reset) => {
        if (err || !reset) {
          return sendError(res, req, {
            status: 400,
            code: errorCodes.INVALID_REQUEST,
            message: "Token inválido.",
          });
        }
        const expiresAt = new Date(reset.expires_at);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
          return sendError(res, req, {
            status: 400,
            code: errorCodes.INVALID_REQUEST,
            message: "Token expirado.",
          });
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
                    (sessionErr) => {
                      if (sessionErr) {
                        finish(sessionErr);
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
            return sendError(res, req, {
              status: 500,
              code: errorCodes.INTERNAL_ERROR,
              message: "Erro ao atualizar senha.",
            });
          }
          logAudit({
            action: "password_reset_completed",
            details: { user_id: reset.user_id },
            performedBy: reset.user_id,
          });
          return res.json({ status: "ok" });
        });
      }
    );
  }
);

router.post(
  "/api/auth/login",
  [
    body("email").isEmail().withMessage("Email inválido."),
    body("password").notEmpty().withMessage("Senha é obrigatória."),
  ],
  validate,
  (req, res) => {
    const { email, password } = req.body;
    const ip = req.ip;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err || !user) {
        return sendError(res, req, {
          status: 401,
          code: errorCodes.UNAUTHORIZED,
          message: "Credenciais inválidas.",
        });
      }
      if (user.locked_until) {
        const lockedUntil = new Date(user.locked_until);
        if (!Number.isNaN(lockedUntil.getTime()) && lockedUntil > new Date()) {
          return sendError(res, req, {
            status: 403,
            code: errorCodes.FORBIDDEN,
            message: "Usuário bloqueado temporariamente.",
          });
        }
      }
      if (!user.is_active) {
        return sendError(res, req, {
          status: 403,
          code: errorCodes.FORBIDDEN,
          message: "Usuário inativo.",
        });
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
                    return sendError(res, req, {
                      status: 403,
                      code: errorCodes.FORBIDDEN,
                      message: "Usuário bloqueado por tentativas.",
                    });
                  }
                  return sendError(res, req, {
                    status: 401,
                    code: errorCodes.UNAUTHORIZED,
                    message: "Credenciais inválidas.",
                  });
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
            return sendError(res, req, {
              status: 500,
              code: errorCodes.INTERNAL_ERROR,
              message: "Erro ao criar sessão.",
            });
          }
          return res.json({ token });
        }
      );
    });
  }
);

module.exports = router;
