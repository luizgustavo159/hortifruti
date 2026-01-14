const express = require("express");
const { body } = require("express-validator");
const db = require("../../db");
const { authenticateToken, requireManager } = require("./middleware/auth");
const validate = require("../middleware/validate");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.get("/api/categories", authenticateToken, (req, res) => {
  db.all("SELECT * FROM categories ORDER BY name", [], (err, rows) => {
    if (err) {
      return sendError(res, req, {
        status: 500,
        code: errorCodes.INTERNAL_ERROR,
        message: "Erro ao buscar categorias.",
      });
    }
    return res.json(rows);
  });
});

router.post(
  "/api/categories",
  authenticateToken,
  requireManager,
  [body("name").trim().notEmpty().withMessage("Nome é obrigatório.")],
  validate,
  (req, res) => {
    const { name, description = "" } = req.body;
    db.get(
      "INSERT INTO categories (name, description) VALUES (?, ?) RETURNING id",
      [name, description],
      (err, row) => {
        if (err) {
          return sendError(res, req, {
            status: 409,
            code: errorCodes.CONFLICT,
            message: "Categoria já cadastrada.",
          });
        }
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

router.get("/api/suppliers", authenticateToken, requireManager, (req, res) => {
  db.all("SELECT * FROM suppliers ORDER BY name", [], (err, rows) => {
    if (err) {
      return sendError(res, req, {
        status: 500,
        code: errorCodes.INTERNAL_ERROR,
        message: "Erro ao buscar fornecedores.",
      });
    }
    return res.json(rows);
  });
});

router.post(
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
  validate,
  (req, res) => {
    const { name, contact = "", phone = "", email = "" } = req.body;

    db.get(
      "INSERT INTO suppliers (name, contact, phone, email) VALUES (?, ?, ?, ?) RETURNING id",
      [name, contact, phone, email],
      (err, row) => {
        if (err) {
          return sendError(res, req, {
            status: 400,
            code: errorCodes.INVALID_REQUEST,
            message: "Erro ao cadastrar fornecedor.",
          });
        }
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

module.exports = router;
