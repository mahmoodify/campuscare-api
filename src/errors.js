'use strict';

//An error that is safe to show to API clients 
//Anything that is NOT an ApiError is treated as an unexpected failure and is reported as a generic 500, so stack traces and internal details never reach the client
class ApiError extends Error {
  constructor(status, code, message, details, headers) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers || {};
  }
}

const E = {
  validation: (details, message = 'The request contains invalid or missing fields.') =>
    new ApiError(400, 'VALIDATION_ERROR', message, details),
  invalidJson: () => new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.'),
  unauthorized: (message) =>
    new ApiError(401, 'UNAUTHORIZED', message, undefined, { 'WWW-Authenticate': 'Bearer' }),
  forbidden: (message) => new ApiError(403, 'FORBIDDEN', message),
  notFound: (message) => new ApiError(404, 'NOT_FOUND', message),
  methodNotAllowed: (allowed) =>
    new ApiError(
      405,
      'METHOD_NOT_ALLOWED',
      `This endpoint does not support this HTTP method. Allowed methods: ${allowed.join(', ')}.`,
      undefined,
      { Allow: allowed.join(', ') }
    ),
  conflict: (message) => new ApiError(409, 'CONFLICT', message),
  tooLarge: (limit) =>
    new ApiError(413, 'PAYLOAD_TOO_LARGE', `The request body must not exceed ${limit} bytes.`, undefined, {
      Connection: 'close',
    }),
};

module.exports = { ApiError, E };
