const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../../db");
const { authenticateToken, requireManager } = require("./middleware/auth");

const router = express.Router();

router.get("/api/categories", authenticateToken, (req, res) => {
  db.all("SELECT * FROM categories ORDER BY name", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar categorias." });
    }
    return res.json(rows);
  });
});

router.post(
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

router.get("/api/suppliers", authenticateToken, requireManager, (req, res) => {
  db.all("SELECT * FROM suppliers ORDER BY name", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar fornecedores." });
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
          return res.status(400).json({ message: "Erro ao cadastrar fornecedor." });
        }
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

module.exports = router;
