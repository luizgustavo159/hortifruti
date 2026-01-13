const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../../db");
const { authenticateToken, requireManager } = require("./middleware/auth");
const { getSettings } = require("./utils/settings");
const { logAudit } = require("./utils/audit");

const router = express.Router();

router.get("/api/discounts", authenticateToken, requireManager, (req, res) => {
  db.all("SELECT * FROM discounts ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Erro ao buscar descontos." });
    }
    return res.json(rows);
  });
});

router.post(
  "/api/discounts",
  authenticateToken,
  requireManager,
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("type").isIn(["percent", "fixed", "buy_x_get_y", "fixed_bundle"]).withMessage("Tipo inválido."),
    body("value").optional().isFloat({ min: 0 }).withMessage("Valor inválido."),
    body("min_quantity").optional().isInt({ min: 0 }).withMessage("Quantidade inválida."),
    body("buy_quantity").optional().isInt({ min: 0 }).withMessage("Quantidade inválida."),
    body("get_quantity").optional().isInt({ min: 0 }).withMessage("Quantidade inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const payload = req.body;
    if (payload.type === "fixed_bundle" && (!payload.buy_quantity || !payload.value)) {
      return res.status(400).json({ message: "Quantidade e preço do combo são obrigatórios." });
    }

    return getSettings(["max_discount"], (settings) => {
      const maxDiscount = Number(settings.max_discount || 0);
      if (payload.type === "percent" && maxDiscount > 0 && Number(payload.value) > maxDiscount) {
        return res.status(403).json({ message: "Desconto acima do limite permitido." });
      }

      db.get(
        `INSERT INTO discounts (
           name, type, value, min_quantity, buy_quantity, get_quantity, target_type, target_value,
           days_of_week, starts_at, ends_at, starts_time, ends_time, stacking_rule, criteria, priority, active
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          payload.name,
          payload.type,
          payload.value,
          payload.min_quantity || null,
          payload.buy_quantity || null,
          payload.get_quantity || null,
          payload.target_type || "all",
          payload.target_value || null,
          Array.isArray(payload.days_of_week) ? JSON.stringify(payload.days_of_week) : payload.days_of_week,
          payload.starts_at || null,
          payload.ends_at || null,
          payload.starts_time || null,
          payload.ends_time || null,
          payload.stacking_rule || "exclusive",
          Array.isArray(payload.criteria) ? JSON.stringify(payload.criteria) : payload.criteria,
          payload.priority || 0,
          payload.active ? 1 : 0,
        ],
        (err, row) => {
          if (err) {
            return res.status(500).json({ message: "Erro ao cadastrar desconto." });
          }
          logAudit({
            action: "discount_created",
            details: { id: row.id, name: payload.name, type: payload.type, value: payload.value },
            performedBy: req.user.id,
          });
          return res.status(201).json({ id: row.id });
        }
      );
    });
  }
);

router.put(
  "/api/discounts/:id",
  authenticateToken,
  requireManager,
  [
    body("name").optional().trim().notEmpty().withMessage("Nome inválido."),
    body("type").optional().isIn(["percent", "fixed", "buy_x_get_y", "fixed_bundle"]).withMessage("Tipo inválido."),
    body("value").optional().isFloat({ min: 0 }).withMessage("Valor inválido."),
    body("min_quantity").optional().isInt({ min: 0 }).withMessage("Quantidade inválida."),
    body("buy_quantity").optional().isInt({ min: 0 }).withMessage("Quantidade inválida."),
    body("get_quantity").optional().isInt({ min: 0 }).withMessage("Quantidade inválida."),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const discountId = Number(req.params.id);

    db.get("SELECT * FROM discounts WHERE id = ?", [discountId], (err, discount) => {
      if (err || !discount) {
        return res.status(404).json({ message: "Desconto não encontrado." });
      }

      const payload = req.body || {};
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
        active: typeof payload.active === "undefined" ? discount.active : payload.active ? 1 : 0,
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

module.exports = router;
