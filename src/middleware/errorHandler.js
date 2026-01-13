const errorHandler = (logger) => (err, req, res, next) => {
  logger.error({ err, request_id: req.requestId }, "Erro não tratado.");
  res.status(err.status || 500).json({
    message: err.expose ? err.message : "Erro interno do servidor.",
    request_id: req.requestId,
  });
  next();
};

module.exports = errorHandler;
