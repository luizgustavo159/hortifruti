const db = require("../../../db");
const { hashToken } = require("../utils/tokens");
const { sendError } = require("../utils/responses");
const { errorCodes } = require("../utils/errors");

const verifyApprovalToken = (token, action, callback) => {
  if (!token) {
    callback({ status: 401, message: "Aprovação necessária." });
    return;
  }
  const tokenHash = hashToken(token);
  db.get(
    "SELECT * FROM approvals WHERE token_hash = ? AND action = ? AND used_at IS NULL",
    [tokenHash, action],
    (err, approval) => {
      if (err || !approval) {
        callback({ status: 403, message: "Aprovação inválida." });
        return;
      }
      const expiresAt = new Date(approval.expires_at);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
        callback({ status: 403, message: "Aprovação expirada." });
        return;
      }
      db.run("UPDATE approvals SET used_at = CURRENT_TIMESTAMP WHERE id = ?", [approval.id]);
      callback(null, approval);
    }
  );
};

const requireApproval = (action) => (req, res, next) => {
  const token = req.headers["x-approval-token"];
  verifyApprovalToken(token, action, (error, approval) => {
    if (error) {
      return sendError(res, req, {
        status: error.status,
        code: error.status === 401 ? errorCodes.UNAUTHORIZED : errorCodes.FORBIDDEN,
        message: error.message,
      });
    }
    req.approval = approval;
    return next();
  });
};

module.exports = {
  requireApproval,
  verifyApprovalToken,
};
