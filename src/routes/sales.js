const express = require("express");
const { body } = require("express-validator");
const db = require("../../db");
const { authenticateToken } = require("./middleware/auth");
const { getSettings } = require("./utils/settings");
const { runWithTransaction } = require("./utils/transactions");
const validate = require("../middleware/validate");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");
const { calculateDiscountAmount } = require("../services/salesCalculator");

const router = express.Router();

router.post(
  "/api/sales",
  authenticateToken,
  [
    body("product_id").isInt({ min: 1 }).withMessage("Produto inválido."),
    body("quantity").isInt({ min: 1 }).withMessage("Quantidade inválida."),
    body("payment_method").trim().notEmpty().withMessage("Pagamento é obrigatório."),
    body("discount_id").optional().isInt({ min: 1 }).withMessage("Desconto inválido."),
  ],
  validate,
  (req, res) => {
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

          const discountAmount = calculateDiscountAmount({
            discount,
            quantity,
            price: product.price,
            total,
          });

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
          return sendError(res, req, {
            status: transactionErr.status,
            code: errorCodes.INVALID_REQUEST,
            message: transactionErr.message,
          });
        }
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao registrar venda.",
        });
      }
      return res.status(responseStatus).json(responsePayload);
    });
  }
);

module.exports = router;
