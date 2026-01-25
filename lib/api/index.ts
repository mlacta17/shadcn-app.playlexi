/**
 * API Utilities — PlayLexi
 *
 * Centralized exports for API route utilities.
 *
 * @example
 * ```typescript
 * import { requireAuth, handleApiError, Errors, ErrorCode } from "@/lib/api"
 *
 * export async function POST(request: Request) {
 *   try {
 *     const { user, db } = await requireAuth()
 *     // ... handler logic
 *   } catch (error) {
 *     return handleApiError(error, "[MyRoute]")
 *   }
 * }
 * ```
 */

// Re-export everything from errors
export {
  AppError,
  ErrorCode,
  Errors,
  handleApiError,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from "./errors"

// Re-export everything from auth
export {
  requireAuth,
  optionalAuth,
  getDatabase,
  type AuthUser,
  type AuthResult,
  type OptionalAuthResult,
} from "./auth"
