const express = require("express");
const { body } = require("express-validator");
const db = require("../../db");
const { authenticateToken, requireManager } = require("./middleware/auth");
const { logAudit } = require("./utils/audit");
const { runWithTransaction } = require("./utils/transactions");
const validate = require("../middleware/validate");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.post(
  "/api/purchase-orders",
  authenticateToken,
  requireManager,
  [
    body("supplier_id").isInt({ min: 1 }).withMessage("Fornecedor inválido."),
    body("items").isArray({ min: 1 }).withMessage("Itens inválidos."),
  ],
  validate,
  (req, res) => {
    const { supplier_id, items } = req.body;

    runWithTransaction((tx, finish) => {
      tx.get(
        "INSERT INTO purchase_orders (supplier_id, created_by) VALUES (?, ?) RETURNING id",
        [supplier_id, req.user.id],
        (err, row) => {
          if (err) {
            finish(err);
            return;
          }
          const orderId = row.id;
          let processed = 0;
          items.forEach((item) => {
            tx.run(
              "INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity) VALUES (?, ?, ?)",
              [orderId, item.product_id, item.quantity],
              (itemErr) => {
                if (itemErr) {
                  finish(itemErr);
                  return;
                }
                processed += 1;
                if (processed === items.length) {
                  finish(null);
                }
              }
            );
          });
        }
      );
    }, (transactionErr) => {
      if (transactionErr) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao criar pedido.",
        });
      }
      return res.status(201).json({ status: "ok" });
    });
  }
);

router.get("/api/purchase-orders", authenticateToken, requireManager, (req, res) => {
  db.all(
    `SELECT purchase_orders.*, suppliers.name AS supplier_name
     FROM purchase_orders
     LEFT JOIN suppliers ON suppliers.id = purchase_orders.supplier_id
     ORDER BY purchase_orders.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar pedidos.",
        });
      }
      return res.json(rows);
    }
  );
});

router.get("/api/purchase-orders/:id/items", authenticateToken, requireManager, (req, res) => {
  const orderId = Number(req.params.id);
  db.all(
    `SELECT purchase_order_items.*, products.name AS product_name
     FROM purchase_order_items
     JOIN products ON products.id = purchase_order_items.product_id
     WHERE purchase_order_items.purchase_order_id = ?`,
    [orderId],
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar itens.",
        });
      }
      return res.json(rows);
    }
  );
});

router.post(
  "/api/purchase-orders/:id/receive",
  authenticateToken,
  requireManager,
  (req, res) => {
    const orderId = Number(req.params.id);
    runWithTransaction((tx, finish) => {
      tx.get("SELECT * FROM purchase_orders WHERE id = ?", [orderId], (err, order) => {
        if (err || !order) {
          finish({ status: 404, message: "Pedido não encontrado." });
          return;
        }
        if (order.status === "received") {
          finish({ status: 400, message: "Pedido já recebido." });
          return;
        }
        tx.all(
          "SELECT * FROM purchase_order_items WHERE purchase_order_id = ?",
          [orderId],
          (itemsErr, items) => {
            if (itemsErr) {
              finish(itemsErr);
              return;
            }
            let processed = 0;
            items.forEach((item) => {
              tx.run(
                "UPDATE products SET current_stock = current_stock + ? WHERE id = ?",
                [item.quantity, item.product_id],
                (updateErr) => {
                  if (updateErr) {
                    finish(updateErr);
                    return;
                  }
                  tx.run(
                    "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
                    [item.product_id, "inbound", item.quantity, "Recebimento de pedido", req.user.id],
                    (movementErr) => {
                      if (movementErr) {
                        finish(movementErr);
                        return;
                      }
                      processed += 1;
                      if (processed === items.length) {
                        tx.run(
                          "UPDATE purchase_orders SET status = 'received', received_at = CURRENT_TIMESTAMP WHERE id = ?",
                          [orderId],
                          (finalErr) => {
                            if (finalErr) {
                              finish(finalErr);
                              return;
                            }
                            finish(null);
                          }
                        );
                      }
                    }
                  );
                }
              );
            });
          }
        );
      });
    }, (transactionErr) => {
      if (transactionErr) {
        return sendError(res, req, {
          status: transactionErr.status || 500,
          code: transactionErr.status ? errorCodes.INVALID_REQUEST : errorCodes.INTERNAL_ERROR,
          message: transactionErr.message || "Erro ao receber pedido.",
        });
      }
      logAudit({
        action: "purchase_order_received",
        details: { id: orderId },
        performedBy: req.user.id,
      });
      return res.json({ status: "ok" });
    });
  }
);

module.exports = router;
