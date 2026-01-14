const express = require("express");
const bcrypt = require("bcryptjs");
const { body } = require("express-validator");
const db = require("../../db");
const { authenticateToken, requireAdmin } = require("./middleware/auth");
const { logAudit } = require("./utils/audit");
const validate = require("../middleware/validate");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.get("/api/users", authenticateToken, requireAdmin, (req, res) => {
  db.all(
    "SELECT id, name, email, phone, role, is_active, permissions, created_at FROM users",
    [],
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar usuários.",
        });
      }
      const users = rows.map((row) => ({
        ...row,
        permissions: row.permissions ? JSON.parse(row.permissions) : [],
      }));
      return res.json(users);
    }
  );
});

router.post(
  "/api/users",
  authenticateToken,
  requireAdmin,
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("email").isEmail().withMessage("Email inválido."),
    body("password").isLength({ min: 8 }).withMessage("Senha deve ter 8+ caracteres."),
    body("role").isIn(["operator", "supervisor", "manager", "admin"]).withMessage("Perfil inválido."),
  ],
  validate,
  (req, res) => {
    const { name, email, phone = "", password, role, permissions = [] } = req.body;
    const passwordHash = bcrypt.hashSync(password, 10);

    db.get(
      "INSERT INTO users (name, email, phone, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
      [name, email, phone, passwordHash, role, JSON.stringify(permissions)],
      (err, row) => {
        if (err) {
          return sendError(res, req, {
            status: 409,
            code: errorCodes.CONFLICT,
            message: "Email já cadastrado.",
          });
        }
        logAudit({ action: "user_created", details: { id: row.id, email }, performedBy: req.user.id });
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

router.put(
  "/api/users/:id",
  authenticateToken,
  requireAdmin,
  [
    body("name").optional().trim().notEmpty().withMessage("Nome inválido."),
    body("email").optional().isEmail().withMessage("Email inválido."),
    body("role").optional().isIn(["operator", "supervisor", "manager", "admin"]).withMessage("Perfil inválido."),
    body("password").optional().isLength({ min: 8 }).withMessage("Senha inválida."),
  ],
  validate,
  (req, res) => {
    const userId = Number(req.params.id);
    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
      if (err || !user) {
        return sendError(res, req, {
          status: 404,
          code: errorCodes.NOT_FOUND,
          message: "Usuário não encontrado.",
        });
      }

      const payload = req.body || {};
      const updated = {
        name: payload.name ?? user.name,
        email: payload.email ?? user.email,
        phone: payload.phone ?? user.phone,
        role: payload.role ?? user.role,
        is_active: typeof payload.is_active === "undefined" ? user.is_active : payload.is_active ? 1 : 0,
        password_hash: payload.password ? bcrypt.hashSync(payload.password, 10) : user.password_hash,
        permissions: Array.isArray(payload.permissions) ? JSON.stringify(payload.permissions) : user.permissions,
      };

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
            return sendError(res, req, {
              status: 500,
              code: errorCodes.INTERNAL_ERROR,
              message: "Erro ao atualizar usuário.",
            });
          }
          logAudit({
            action: "user_update",
            details: { id: userId, email: updated.email, role: updated.role },
            performedBy: req.user.id,
          });
          return res.json({ id: userId });
        }
      );
    });
  }
);

module.exports = router;
