const { errorCodes } = require("./errors");

const sendError = (res, req, { status, code, message, details = null }) =>
  res.status(status).json({
    error: {
      code: code || errorCodes.INTERNAL_ERROR,
      message,
      details,
    },
    request_id: req.requestId,
  });

module.exports = {
  sendError,
};
