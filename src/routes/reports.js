const express = require("express");
const db = require("../../db");
const { authenticateToken, requireManager } = require("./middleware/auth");
const { parseDateRange, buildDateFilter } = require("./utils/dateFilters");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const router = express.Router();

router.get("/api/reports/summary", authenticateToken, (req, res) => {
  const range = parseDateRange(req, res);
  if (!range) {
    return;
  }
  const salesFilter = buildDateFilter("sales.created_at", range);
  db.get(
    `SELECT SUM(final_total) AS total_sales FROM sales ${salesFilter.clause}`,
    salesFilter.params,
    (salesErr, salesRow) => {
      if (salesErr) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao gerar relatório.",
        });
      }

      const lossFilter = buildDateFilter("stock_losses.created_at", range);
      db.get(
        `SELECT SUM(products.price * stock_losses.quantity) AS total_losses
         FROM stock_losses
         JOIN products ON products.id = stock_losses.product_id
         ${lossFilter.clause}`,
        lossFilter.params,
        (lossErr, lossRow) => {
          if (lossErr) {
            return sendError(res, req, {
              status: 500,
              code: errorCodes.INTERNAL_ERROR,
              message: "Erro ao gerar relatório.",
            });
          }

          db.all(
            `SELECT id, name, current_stock, min_stock
             FROM products
             WHERE current_stock <= min_stock`,
            [],
            (stockErr, lowStockRows) => {
              if (stockErr) {
                return sendError(res, req, {
                  status: 500,
                  code: errorCodes.INTERNAL_ERROR,
                  message: "Erro ao gerar relatório.",
                });
              }

              db.all(
                `SELECT id, name, expires_at
                 FROM products
                 WHERE expires_at IS NOT NULL
                 ORDER BY expires_at ASC
                 LIMIT 10`,
                [],
                (expErr, expRows) => {
                  if (expErr) {
                    return sendError(res, req, {
                      status: 500,
                      code: errorCodes.INTERNAL_ERROR,
                      message: "Erro ao gerar relatório.",
                    });
                  }

                  return res.json({
                    total_sales: salesRow?.total_sales || 0,
                    total_losses: lossRow?.total_losses || 0,
                    low_stock: lowStockRows,
                    expiring_products: expRows,
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

router.get("/api/audit-logs", authenticateToken, requireManager, (req, res) => {
  db.all(
    `SELECT audit_logs.*, users.name AS performed_by_name, approvers.name AS approved_by_name
     FROM audit_logs
     LEFT JOIN users ON users.id = audit_logs.performed_by
     LEFT JOIN users AS approvers ON approvers.id = audit_logs.approved_by
     ORDER BY audit_logs.created_at DESC
     LIMIT 100`,
    [],
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao buscar logs.",
        });
      }
      return res.json(rows);
    }
  );
});

router.get("/api/reports/by-operator", authenticateToken, requireManager, (req, res) => {
  const range = parseDateRange(req, res);
  if (!range) {
    return;
  }
  const salesFilter = buildDateFilter("sales.created_at", range);
  db.all(
    `SELECT users.id, users.name, SUM(sales.final_total) AS total_sales, SUM(sales.quantity) AS total_items
     FROM sales
     LEFT JOIN users ON users.id = sales.sold_by
     ${salesFilter.clause}
     GROUP BY sales.sold_by
     ORDER BY total_sales DESC`,
    salesFilter.params,
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao gerar relatório.",
        });
      }
      return res.json(rows);
    }
  );
});

router.get("/api/reports/by-category", authenticateToken, requireManager, (req, res) => {
  const range = parseDateRange(req, res);
  if (!range) {
    return;
  }
  const salesFilter = buildDateFilter("sales.created_at", range);
  db.all(
    `SELECT categories.name AS category, SUM(sales.final_total) AS total_sales, SUM(sales.quantity) AS total_items
     FROM sales
     JOIN products ON products.id = sales.product_id
     LEFT JOIN categories ON categories.id = products.category_id
     ${salesFilter.clause}
     GROUP BY categories.name
     ORDER BY total_sales DESC`,
    salesFilter.params,
    (err, rows) => {
      if (err) {
        return sendError(res, req, {
          status: 500,
          code: errorCodes.INTERNAL_ERROR,
          message: "Erro ao gerar relatório.",
        });
      }
      return res.json(rows);
    }
  );
});

module.exports = router;
