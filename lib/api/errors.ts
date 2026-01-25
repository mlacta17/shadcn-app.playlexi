/**
 * API Error Handling — PlayLexi
 *
 * Centralized error handling for all API routes.
 * Provides typed errors, consistent response formats, and proper logging.
 *
 * ## Usage
 *
 * ```typescript
 * import { AppError, handleApiError, ErrorCode } from "@/lib/api/errors"
 *
 * // Throw typed errors
 * throw new AppError("User not found", ErrorCode.NOT_FOUND)
 * throw new AppError("Invalid mode", ErrorCode.VALIDATION_ERROR, { field: "mode" })
 *
 * // Handle errors in catch block
 * catch (error) {
 *   return handleApiError(error, "[CreateGame]")
 * }
 * ```
 *
 * ## Error Codes
 *
 * Error codes help clients handle errors programmatically:
 * - UNAUTHORIZED: User needs to log in
 * - FORBIDDEN: User lacks permission
 * - NOT_FOUND: Resource doesn't exist
 * - VALIDATION_ERROR: Invalid input
 * - CONFLICT: Resource already exists
 * - INTERNAL_ERROR: Unexpected server error
 *
 * @see docs/ARCHITECTURE.md for error handling strategy
 */

import { NextResponse } from "next/server"

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Standardized error codes for client-side handling.
 *
 * Using string enum for better debugging (shows code name in logs).
 */
export enum ErrorCode {
  // Authentication/Authorization
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",

  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",

  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",

  // Rate limiting
  RATE_LIMITED = "RATE_LIMITED",

  // Server errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  DATABASE_ERROR = "DATABASE_ERROR",
}

/**
 * Map error codes to HTTP status codes.
 */
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
}

// =============================================================================
// ERROR RESPONSE TYPES
// =============================================================================

/**
 * Standard error response format.
 */
export interface ApiErrorResponse {
  error: string
  code: ErrorCode
  details?: Record<string, unknown>
}

/**
 * Standard success response wrapper.
 */
export interface ApiSuccessResponse<T> {
  data: T
}

// =============================================================================
// ERROR CLASS
// =============================================================================

/**
 * Application error with code and optional details.
 *
 * Extends Error to work with standard catch blocks while adding
 * structured information for API responses.
 *
 * @example
 * ```typescript
 * // Simple error
 * throw new AppError("Not authenticated", ErrorCode.UNAUTHORIZED)
 *
 * // Error with details
 * throw new AppError("Invalid input", ErrorCode.VALIDATION_ERROR, {
 *   field: "mode",
 *   expected: ["endless", "blitz"],
 *   received: "invalid"
 * })
 *
 * // Custom status code (rare - usually inferred from ErrorCode)
 * throw new AppError("Custom error", ErrorCode.INTERNAL_ERROR, null, 501)
 * ```
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly status: number
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    details?: Record<string, unknown>,
    status?: number
  ) {
    super(message)
    this.name = "AppError"
    this.code = code
    this.status = status ?? ERROR_STATUS_MAP[code]
    this.details = details

    // Maintains proper stack trace in V8 (Node.js, Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  /**
   * Convert to a plain object for JSON serialization.
   */
  toJSON(): ApiErrorResponse {
    const response: ApiErrorResponse = {
      error: this.message,
      code: this.code,
    }
    if (this.details) {
      response.details = this.details
    }
    return response
  }
}

// =============================================================================
// ERROR HANDLER
// =============================================================================

/**
 * Handle errors and return appropriate NextResponse.
 *
 * This is the main error handler for API routes. It:
 * 1. Logs the error with context
 * 2. Converts AppError to structured response
 * 3. Handles unknown errors gracefully
 * 4. Never exposes internal details to clients
 *
 * @param error - The caught error
 * @param context - Context string for logging (e.g., "[CreateGame]")
 * @returns NextResponse with appropriate status and body
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   try {
 *     // ... handler logic
 *   } catch (error) {
 *     return handleApiError(error, "[CreateGame]")
 *   }
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  context: string = "[API]"
): NextResponse<ApiErrorResponse> {
  // Handle AppError (expected errors)
  if (error instanceof AppError) {
    // Log at appropriate level based on error type
    if (error.status >= 500) {
      console.error(`${context} ${error.code}:`, error.message, error.details)
    } else if (process.env.NODE_ENV === "development") {
      console.log(`${context} ${error.code}:`, error.message)
    }

    return NextResponse.json(error.toJSON(), {
      status: error.status,
    })
  }

  // Handle standard Error
  if (error instanceof Error) {
    console.error(`${context} Unhandled error:`, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })

    // Don't expose internal error details to client
    return NextResponse.json(
      {
        error: "An unexpected error occurred",
        code: ErrorCode.INTERNAL_ERROR,
      },
      { status: 500 }
    )
  }

  // Handle non-Error throws (shouldn't happen, but be defensive)
  console.error(`${context} Unknown error type:`, error)

  return NextResponse.json(
    {
      error: "An unexpected error occurred",
      code: ErrorCode.INTERNAL_ERROR,
    },
    { status: 500 }
  )
}

// =============================================================================
// HELPER FACTORIES
// =============================================================================

/**
 * Create common errors with consistent messages.
 *
 * These factories ensure consistent error messages across the codebase.
 */
export const Errors = {
  /**
   * User is not authenticated.
   */
  unauthorized(message: string = "Not authenticated"): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED)
  },

  /**
   * User lacks permission for this action.
   */
  forbidden(message: string = "Permission denied"): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN)
  },

  /**
   * Resource not found.
   */
  notFound(resource: string, id?: string): AppError {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`
    return new AppError(message, ErrorCode.NOT_FOUND, { resource, id })
  },

  /**
   * Validation error with field details.
   */
  validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, details)
  },

  /**
   * Invalid input for a specific field.
   */
  invalidInput(
    field: string,
    message: string,
    expected?: unknown,
    received?: unknown
  ): AppError {
    return new AppError(`Invalid ${field}: ${message}`, ErrorCode.INVALID_INPUT, {
      field,
      ...(expected !== undefined && { expected }),
      ...(received !== undefined && { received }),
    })
  },

  /**
   * Resource already exists (conflict).
   */
  conflict(resource: string, field?: string): AppError {
    const message = field
      ? `${resource} with this ${field} already exists`
      : `${resource} already exists`
    return new AppError(message, ErrorCode.CONFLICT, { resource, field })
  },

  /**
   * Database operation failed.
   */
  database(operation: string, details?: Record<string, unknown>): AppError {
    return new AppError(
      `Database error during ${operation}`,
      ErrorCode.DATABASE_ERROR,
      details
    )
  },
} as const
