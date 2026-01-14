class AppError extends Error {
  constructor({ code, message, status = 500, details = null, expose = true }) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.expose = expose;
  }
}

const errorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
};

const formatError = (err) => {
  if (err instanceof AppError) {
    return {
      status: err.status,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      expose: err.expose,
    };
  }
  return {
    status: 500,
    error: {
      code: errorCodes.INTERNAL_ERROR,
      message: "Erro interno do servidor.",
      details: null,
    },
    expose: false,
  };
};

module.exports = {
  AppError,
  errorCodes,
  formatError,
};
