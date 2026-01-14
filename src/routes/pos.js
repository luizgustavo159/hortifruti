const express = require("express");
const { body } = require("express-validator");
const db = require("../../db");
const { authenticateToken, requireAdmin } = require("./middleware/auth");
const { requireApproval, verifyApprovalToken } = require("./middleware/approvals");
const { getSettings } = require("./utils/settings");
const { logAudit } = require("./utils/audit");
const validate = require("../middleware/validate");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.post(
  "/api/pos/remove-item",
  authenticateToken,
  requireApproval("remove_item"),
  [
    body("item").trim().notEmpty().withMessage("Item é obrigatório."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  validate,
  (req, res) => {
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

router.post(
  "/api/pos/discount-override",
  authenticateToken,
  [
    body("amount").isFloat({ min: 0 }).withMessage("Valor inválido."),
    body("subtotal").optional().isFloat({ min: 0 }).withMessage("Subtotal inválido."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  validate,
  (req, res) => {
    const { amount, reason, subtotal = 0 } = req.body;
    const baseTotal = Number(subtotal) || 0;
    const discountPercent = baseTotal > 0 ? (Number(amount) / baseTotal) * 100 : 0;
    return getSettings(["max_discount", "approval_threshold"], (settings) => {
      const maxDiscount = Number(settings.max_discount || 0);
      if ((maxDiscount > 0 || Number(settings.approval_threshold || 0) > 0) && baseTotal <= 0 && Number(amount) > 0) {
        return sendError(res, req, {
          status: 400,
          code: errorCodes.INVALID_REQUEST,
          message: "Subtotal obrigatório para validar o desconto.",
        });
      }
      if (maxDiscount > 0 && discountPercent > maxDiscount) {
        return sendError(res, req, {
          status: 403,
          code: errorCodes.FORBIDDEN,
          message: "Desconto acima do limite permitido.",
        });
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
            return sendError(res, req, {
              status: error.status,
              code: error.status === 401 ? errorCodes.UNAUTHORIZED : errorCodes.FORBIDDEN,
              message: error.message,
            });
          }
          return finalize(approval);
        });
      }

      return finalize(null);
    });
  }
);

router.post(
  "/api/pos/cancel-sale",
  authenticateToken,
  requireApproval("cancel_sale"),
  [
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
    body("items").isInt({ min: 0 }).withMessage("Itens inválidos."),
  ],
  validate,
  (req, res) => {
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

router.get("/api/pos/devices", authenticateToken, (req, res) => {
  db.all("SELECT * FROM pos_devices ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      return sendError(res, req, {
        status: 500,
        code: errorCodes.INTERNAL_ERROR,
        message: "Erro ao buscar dispositivos.",
      });
    }
    return res.json(rows);
  });
});

router.post(
  "/api/pos/devices",
  authenticateToken,
  requireAdmin,
  [
    body("type").isIn(["scanner", "scale"]).withMessage("Tipo inválido."),
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("connection").trim().notEmpty().withMessage("Conexão é obrigatória."),
  ],
  validate,
  (req, res) => {
    const { type, name, connection, config: deviceConfig = "", active = 1 } = req.body;

    db.get(
      "INSERT INTO pos_devices (type, name, connection, config, active) VALUES (?, ?, ?, ?, ?) RETURNING id",
      [type, name, connection, JSON.stringify(deviceConfig), active ? 1 : 0],
      (err, row) => {
        if (err) {
          return sendError(res, req, {
            status: 400,
            code: errorCodes.INVALID_REQUEST,
            message: "Erro ao cadastrar dispositivo.",
          });
        }
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

module.exports = router;
