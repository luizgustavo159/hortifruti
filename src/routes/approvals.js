const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { body } = require("express-validator");
const db = require("../../db");
const { hasRole } = require("./middleware/auth");
const { hashToken } = require("./utils/tokens");
const { logAudit } = require("./utils/audit");
const validate = require("../middleware/validate");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.post(
  "/api/approvals",
  [
    body("email").isEmail().withMessage("Email inválido."),
    body("password").notEmpty().withMessage("Senha é obrigatória."),
    body("action")
      .isIn(["remove_item", "discount_override", "cancel_sale", "user_update", "stock_loss", "stock_adjust"])
      .withMessage("Ação inválida."),
  ],
  validate,
  (req, res) => {
    const { email, password, action, reason = "", metadata = {} } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
      if (err || !user) {
        return sendError(res, req, {
          status: 401,
          code: errorCodes.UNAUTHORIZED,
          message: "Credenciais inválidas.",
        });
      }
      if (!hasRole(user, "manager")) {
        return sendError(res, req, {
          status: 403,
          code: errorCodes.FORBIDDEN,
          message: "Aprovação requer gerente ou admin.",
        });
      }
      const valid = bcrypt.compareSync(password, user.password_hash);
      if (!valid) {
        return sendError(res, req, {
          status: 401,
          code: errorCodes.UNAUTHORIZED,
          message: "Credenciais inválidas.",
        });
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
            return sendError(res, req, {
              status: 500,
              code: errorCodes.INTERNAL_ERROR,
              message: "Erro ao registrar aprovação.",
            });
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

module.exports = router;
