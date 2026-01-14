const express = require("express");
const { body } = require("express-validator");
const db = require("../../db");
const { authenticateToken, requireManager, requireSupervisor } = require("./middleware/auth");
const { verifyApprovalToken } = require("./middleware/approvals");
const { getSettings } = require("./utils/settings");
const { logAudit } = require("./utils/audit");
const { runWithTransaction } = require("./utils/transactions");
const validate = require("../middleware/validate");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.get("/api/products", authenticateToken, (req, res) => {
  db.all(
    `SELECT products.*, categories.name AS category_name, suppliers.name AS supplier_name
     FROM products
     LEFT JOIN categories ON categories.id = products.category_id
     LEFT JOIN suppliers ON suppliers.id = products.supplier_id
     ORDER BY products.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar produtos.",
        });
      }
      return res.json(rows);
    }
  );
});

router.post(
  "/api/products",
  authenticateToken,
  requireManager,
  [
    body("name").trim().notEmpty().withMessage("Nome é obrigatório."),
    body("sku").trim().notEmpty().withMessage("SKU é obrigatório."),
    body("unit_type").trim().notEmpty().withMessage("Unidade é obrigatória."),
    body("price").isFloat({ min: 0 }).withMessage("Preço inválido."),
  ],
  validate,
  (req, res) => {
    const payload = req.body;
    db.get(
      `INSERT INTO products
       (name, sku, unit_type, price, current_stock, min_stock, max_stock, category_id, supplier_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        payload.name,
        payload.sku,
        payload.unit_type,
        payload.price,
        payload.current_stock || 0,
        payload.min_stock || 0,
        payload.max_stock || 0,
        payload.category_id || null,
        payload.supplier_id || null,
        payload.expires_at || null,
      ],
      (err, row) => {
        if (err) {
          return sendError(res, req, {
            status: 400,
            code: errorCodes.INVALID_REQUEST,
            message: "Erro ao cadastrar produto.",
          });
        }
        return res.status(201).json({ id: row.id });
      }
    );
  }
);

router.post(
  "/api/stock/loss",
  authenticateToken,
  [
    body("product_id").isInt({ min: 1 }).withMessage("Produto inválido."),
    body("quantity").isInt({ min: 1 }).withMessage("Quantidade inválida."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  validate,
  (req, res) => {
    const { product_id, quantity, reason } = req.body;

    return getSettings(["max_losses"], (settings) => {
      const maxLosses = Number(settings.max_losses || 0);
      if (maxLosses > 0 && quantity > maxLosses) {
        return verifyApprovalToken(req.headers["x-approval-token"], "stock_loss", (error) => {
          if (error) {
            return sendError(res, req, {
              status: error.status,
              code: error.status === 401 ? errorCodes.UNAUTHORIZED : errorCodes.FORBIDDEN,
              message: error.message,
            });
          }
          return saveLoss();
        });
      }
      return saveLoss();
    });

    function saveLoss() {
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

          const nextStock = product.current_stock - quantity;
          tx.run(
            "UPDATE products SET current_stock = ? WHERE id = ?",
            [nextStock, product_id],
            (updateErr) => {
              if (updateErr) {
                finish(updateErr);
                return;
              }
              tx.run(
                "INSERT INTO stock_losses (product_id, quantity, reason, reported_by) VALUES (?, ?, ?, ?)",
                [product_id, quantity, reason, req.user.id],
                (lossErr) => {
                  if (lossErr) {
                    finish(lossErr);
                    return;
                  }
                  tx.run(
                    "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
                    [product_id, "loss", -Number(quantity), reason, req.user.id],
                    (movementErr) => {
                      if (movementErr) {
                        finish(movementErr);
                        return;
                      }
                      finish(null);
                    }
                  );
                }
              );
            }
          );
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
            message: "Erro ao registrar perda.",
          });
        }
        logAudit({
          action: "stock_loss",
          details: { product_id, quantity, reason },
          performedBy: req.user.id,
        });
        return res.status(201).json({ status: "ok" });
      });
    }
  }
);

router.post(
  "/api/stock/adjust",
  authenticateToken,
  requireSupervisor,
  [
    body("product_id").isInt({ min: 1 }).withMessage("Produto inválido."),
    body("delta").isInt().withMessage("Delta inválido."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  validate,
  (req, res) => {
    const { product_id, delta, reason } = req.body;

    return getSettings(["max_stock_adjust"], (settings) => {
      const maxStockAdjust = Number(settings.max_stock_adjust || 0);
      if (maxStockAdjust > 0 && Math.abs(Number(delta)) > maxStockAdjust) {
        return verifyApprovalToken(req.headers["x-approval-token"], "stock_adjust", (error) => {
          if (error) {
            return sendError(res, req, {
              status: error.status,
              code: error.status === 401 ? errorCodes.UNAUTHORIZED : errorCodes.FORBIDDEN,
              message: error.message,
            });
          }
          return saveAdjustment();
        });
      }
      return saveAdjustment();
    });

    function saveAdjustment() {
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

          const nextStock = product.current_stock + Number(delta);
          if (nextStock < 0) {
            finish({ status: 400, message: "Estoque não pode ficar negativo." });
            return;
          }

          tx.run(
            "UPDATE products SET current_stock = ? WHERE id = ?",
            [nextStock, product_id],
            (updateErr) => {
              if (updateErr) {
                finish(updateErr);
                return;
              }
              tx.run(
                "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
                [product_id, "adjustment", delta, reason, req.user.id],
                (movementErr) => {
                  if (movementErr) {
                    finish(movementErr);
                    return;
                  }
                  finish(null);
                }
              );
            }
          );
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
            message: "Erro ao ajustar estoque.",
          });
        }
        logAudit({
          action: "stock_adjust",
          details: { product_id, delta, reason },
          performedBy: req.user.id,
        });
        return res.status(201).json({ status: "ok" });
      });
    }
  }
);

router.post(
  "/api/stock/move",
  authenticateToken,
  [
    body("product_id").isInt({ min: 1 }).withMessage("Produto inválido."),
    body("quantity").isInt({ min: 1 }).withMessage("Quantidade inválida."),
    body("type").isIn(["inbound", "outbound"]).withMessage("Tipo inválido."),
    body("reason").trim().notEmpty().withMessage("Motivo é obrigatório."),
  ],
  validate,
  (req, res) => {
    const { product_id, quantity, type, reason } = req.body;

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

        const delta = type === "inbound" ? Number(quantity) : -Number(quantity);
        const nextStock = product.current_stock + delta;
        if (nextStock < 0) {
          finish({ status: 400, message: "Estoque não pode ficar negativo." });
          return;
        }
        tx.run(
          "UPDATE products SET current_stock = ? WHERE id = ?",
          [nextStock, product_id],
          (updateErr) => {
            if (updateErr) {
              finish(updateErr);
              return;
            }
            tx.run(
              "INSERT INTO stock_movements (product_id, type, delta, reason, performed_by) VALUES (?, ?, ?, ?, ?)",
              [product_id, type, delta, reason, req.user.id],
              (movementErr) => {
                if (movementErr) {
                  finish(movementErr);
                  return;
                }
                finish(null);
              }
            );
          }
        );
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
          message: "Erro ao registrar movimentação.",
        });
      }
      logAudit({
        action: "stock_move",
        details: { product_id, quantity, type, reason },
        performedBy: req.user.id,
      });
      return res.status(201).json({ status: "ok" });
    });
  }
);

router.get("/api/stock/loss", authenticateToken, (req, res) => {
  const limit = Number(req.query.limit || 50);
  const safeLimit = Number.isNaN(limit) ? 50 : Math.min(Math.max(limit, 1), 200);
  db.all(
    `SELECT stock_losses.*, products.name AS product_name
     FROM stock_losses
     JOIN products ON products.id = stock_losses.product_id
     ORDER BY stock_losses.created_at DESC
     LIMIT ?`,
    [safeLimit],
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar perdas.",
        });
      }
      return res.json(rows);
    }
  );
});

router.get("/api/stock/movements", authenticateToken, (req, res) => {
  const limit = Number(req.query.limit || 50);
  const safeLimit = Number.isNaN(limit) ? 50 : Math.min(Math.max(limit, 1), 200);
  const productId = req.query.product_id ? Number(req.query.product_id) : null;

  const where = productId ? "WHERE stock_movements.product_id = ?" : "";
  const params = productId ? [productId, safeLimit] : [safeLimit];

  db.all(
    `SELECT stock_movements.*, products.name AS product_name
     FROM stock_movements
     JOIN products ON products.id = stock_movements.product_id
     ${where}
     ORDER BY stock_movements.created_at DESC
     LIMIT ?`,
    params,
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar movimentações.",
        });
      }
      return res.json(rows);
    }
  );
});

router.get("/api/stock/restock-suggestions", authenticateToken, (req, res) => {
  db.all(
    `SELECT products.*, categories.name AS category_name,
            suppliers.name AS supplier_name, suppliers.id AS supplier_id
     FROM products
     LEFT JOIN categories ON categories.id = products.category_id
     LEFT JOIN suppliers ON suppliers.id = products.supplier_id
     WHERE products.current_stock <= products.min_stock
     ORDER BY products.current_stock ASC`,
    [],
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar sugestões.",
        });
      }
      return res.json(rows);
    }
  );
});

module.exports = router;
