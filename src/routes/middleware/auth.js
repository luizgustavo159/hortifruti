const jwt = require("jsonwebtoken");
const db = require("../../../db");
const config = require("../../../config");
const { sendError } = require("../../utils/responses");
const { errorCodes } = require("../../utils/errors");

const { JWT_SECRET } = config;

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return sendError(res, req, {
      status: 401,
      code: errorCodes.UNAUTHORIZED,
      message: "Token não informado.",
    });
  }
  const token = authHeader.replace("Bearer ", "");
  return jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return sendError(res, req, {
        status: 403,
        code: errorCodes.FORBIDDEN,
        message: "Token inválido.",
      });
    }
    db.get(
      "SELECT * FROM sessions WHERE token = ? AND revoked_at IS NULL",
      [token],
      (sessionErr, session) => {
        if (sessionErr || !session) {
          return sendError(res, req, {
            status: 401,
            code: errorCodes.UNAUTHORIZED,
            message: "Sessão expirada.",
          });
        }
        req.user = user;
        return next();
      }
    );
  });
};

const roleLevels = {
  operator: 1,
  supervisor: 2,
  manager: 3,
  admin: 4,
};

const hasRole = (user, role) => {
  const current = roleLevels[user?.role] || 0;
  return current >= roleLevels[role];
};

const requireRole = (role) => (req, res, next) => {
  if (!hasRole(req.user, role)) {
    return sendError(res, req, {
      status: 403,
      code: errorCodes.FORBIDDEN,
      message: "Acesso não autorizado.",
    });
  }
  return next();
};

const requireAdmin = requireRole("admin");
const requireManager = requireRole("manager");
const requireSupervisor = requireRole("supervisor");

module.exports = {
  authenticateToken,
  hasRole,
  requireRole,
  requireAdmin,
  requireManager,
  requireSupervisor,
};
