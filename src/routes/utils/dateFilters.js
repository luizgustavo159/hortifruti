const { sendError } = require("../../utils/responses");
const { errorCodes } = require("../../utils/errors");

const parseDateRange = (req, res) => {
  const { start, end } = req.query;
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (start && Number.isNaN(startDate?.getTime())) {
    sendError(res, req, {
      status: 400,
      code: errorCodes.INVALID_REQUEST,
      message: "Data inicial inválida.",
    });
    return null;
  }
  if (end && Number.isNaN(endDate?.getTime())) {
    sendError(res, req, {
      status: 400,
      code: errorCodes.INVALID_REQUEST,
      message: "Data final inválida.",
    });
    return null;
  }
  if (startDate && endDate && startDate > endDate) {
    sendError(res, req, {
      status: 400,
      code: errorCodes.INVALID_REQUEST,
      message: "Intervalo de datas inválido.",
    });
    return null;
  }
  return { start: start || null, end: end || null };
};

const buildDateFilter = (field, range) => {
  const conditions = [];
  const params = [];
  if (range?.start) {
    conditions.push(`date(${field}) >= date(?)`);
    params.push(range.start);
  }
  if (range?.end) {
    conditions.push(`date(${field}) <= date(?)`);
    params.push(range.end);
  }
  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

module.exports = {
  parseDateRange,
  buildDateFilter,
};
