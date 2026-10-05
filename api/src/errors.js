// @ts-check
// Errors raised by the business layers. They carry a stable, machine-readable
// `code`; mapping codes to HTTP statuses is the endpoint layer's job.

const ERROR_CODES = /** @type {const} */ ({
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_ORDER_ID: 'INVALID_ORDER_ID',
  INVALID_STATUS_FILTER: 'INVALID_STATUS_FILTER',
});

/** @typedef {keyof typeof ERROR_CODES} ErrorCode */

class DomainError extends Error {
  /**
   * @param {ErrorCode} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

module.exports = { ERROR_CODES, DomainError };
