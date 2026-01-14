const { validationResult } = require("express-validator");
const { AppError, errorCodes } = require("../utils/errors");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  return next(
    new AppError({
      code: errorCodes.VALIDATION_ERROR,
      message: "Falha de validação.",
      status: 400,
      details: errors.array(),
    })
  );
};

module.exports = validate;
