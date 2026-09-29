/*
 * What this file does:
 * Defines structured API errors so routes, services, and tests agree on status codes.
 * What calls it:
 * Route handlers in src/app/api/.../route.ts and services in src/services/*.ts.
 * What it calls:
 * No local modules; it only extends the built-in Error type.
 * One thing a junior engineer would likely get wrong:
 * Throwing plain Error objects and then scattering status-code mapping in every route.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    // ⚠️ SENIOR NOTE: Error codes become an API contract too, so changing them casually can break clients and dashboards.
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const unauthorized = (message = "Authentication required") =>
  new ApiError(message, 401, "UNAUTHORIZED");

export const forbidden = (message = "You do not have access to this resource") =>
  new ApiError(message, 403, "FORBIDDEN");

export const notFound = (message = "Resource not found") =>
  new ApiError(message, 404, "NOT_FOUND");

export const badRequest = (message = "Bad request", details?: unknown) =>
  new ApiError(message, 400, "BAD_REQUEST", details);

export const conflict = (message = "Conflict", details?: unknown) =>
  new ApiError(message, 409, "CONFLICT", details);
