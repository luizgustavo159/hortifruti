const express = require("express");
const config = require("../../config");
const { sendAlertNotification } = require("../services/notifications");
const { authenticateToken } = require("./middleware/auth");

const systemRoutes = require("./system");
const authRoutes = require("./auth");
const catalogRoutes = require("./catalog");
const inventoryRoutes = require("./inventory");
const purchaseOrderRoutes = require("./purchaseOrders");
const discountRoutes = require("./discounts");
const salesRoutes = require("./sales");
const reportRoutes = require("./reports");
const approvalRoutes = require("./approvals");
const posRoutes = require("./pos");
const userRoutes = require("./users");
const sessionRoutes = require("./sessions");
const settingsRoutes = require("./settings");

const router = express.Router();

router.use(systemRoutes);
router.use(authRoutes);
router.use(catalogRoutes);
router.use(inventoryRoutes);
router.use(purchaseOrderRoutes);
router.use(discountRoutes);
router.use(salesRoutes);
router.use(reportRoutes);
router.use(approvalRoutes);
router.use(posRoutes);
router.use(userRoutes);
router.use(sessionRoutes);
router.use(settingsRoutes);

module.exports = {
  router,
  sendAlertNotification,
  ALERT_SLOW_THRESHOLD_MS: config.ALERT_SLOW_THRESHOLD_MS,
  METRICS_ENABLED: config.METRICS_ENABLED,
  authenticateToken,
};
