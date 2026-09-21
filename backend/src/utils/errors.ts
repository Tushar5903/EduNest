/** HTTP error with status code. Thrown in services, rendered by error middleware. */
export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(message = "Bad request", details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Unauthenticated"): ApiError {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden"): ApiError {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found"): ApiError {
    return new ApiError(404, message);
  }
  static conflict(message = "Conflict", details?: unknown): ApiError {
    return new ApiError(409, message, details);
  }
}
