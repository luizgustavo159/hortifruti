const { formatError } = require("../utils/errors");

const errorHandler = (logger) => (err, req, res, next) => {
  const formatted = formatError(err);
  logger.error({ err, request_id: req.requestId }, "Erro não tratado.");
  res.status(formatted.status).json({
    error: formatted.error,
    request_id: req.requestId,
  });
  next();
};

module.exports = errorHandler;
