const express = require("express");
const { body, validationResult } = require("express-validator");
const db = require("../../db");
const { authenticateToken } = require("./middleware/auth");
const { getSettings } = require("./utils/settings");
const { runWithTransaction } = require("./utils/transactions");

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

module.exports = router;
