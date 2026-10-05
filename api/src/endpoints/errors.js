// @ts-check
// The only place that maps error codes to HTTP statuses.

const { DomainError } = require('../errors');

/** @type {Record<import('../errors').ErrorCode, number>} */
const HTTP_STATUS_BY_CODE = {
  INVALID_ORDER_ID: 400,
  INVALID_STATUS_FILTER: 400,
  ORDER_NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
};

/** @type {import('express').RequestHandler} */
const notFoundHandler = (req, res) =>
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });

/** @type {import('express').ErrorRequestHandler} */
const errorHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    res.status(HTTP_STATUS_BY_CODE[err.code]).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  // Malformed JSON body, raised by express.json().
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
};

module.exports = { HTTP_STATUS_BY_CODE, notFoundHandler, errorHandler };
