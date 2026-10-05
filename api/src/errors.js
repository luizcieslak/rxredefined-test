// @ts-check

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
