const { AppError, errorCodes } = require("../utils/errors");

const notFound = (req, res, next) => {
  next(
    new AppError({
      code: errorCodes.NOT_FOUND,
      message: "Rota não encontrada.",
      status: 404,
    })
  );
};

module.exports = notFound;
