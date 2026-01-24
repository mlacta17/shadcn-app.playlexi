/**
 * Username Validation Utilities — PlayLexi
 *
 * Client-side validation for usernames.
 * These checks are performed instantly in the browser before
 * making an API call to check uniqueness.
 *
 * ## Validation Flow
 *
 * 1. User types in username field
 * 2. Client-side format validation (instant, no API)
 * 3. If format valid → Debounced API call for uniqueness
 * 4. Show appropriate error/success message
 *
 * ## Username Rules (Industry Standard)
 *
 * - 3-20 characters
 * - Alphanumeric and underscores only
 * - Cannot start or end with underscore
 * - No consecutive underscores
 * - Case-insensitive uniqueness (stored as-is, compared lowercase)
 *
 * @see app/api/users/check-username/route.ts for uniqueness check
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum username length */
export const USERNAME_MIN_LENGTH = 3

/** Maximum username length */
export const USERNAME_MAX_LENGTH = 20

/** Regex for allowed characters (alphanumeric + underscore) */
const ALLOWED_CHARS_REGEX = /^[a-zA-Z0-9_]+$/

/** Regex for consecutive underscores */
const CONSECUTIVE_UNDERSCORES_REGEX = /__/

// =============================================================================
// VALIDATION RESULT TYPE
// =============================================================================

export interface UsernameValidationResult {
  /** Whether the username passes format validation */
  isValid: boolean
  /** Error message if invalid (null if valid) */
  error: string | null
}

// =============================================================================
// VALIDATION FUNCTION
// =============================================================================

/**
 * Validate username format (client-side, synchronous).
 *
 * This does NOT check uniqueness — that requires an API call.
 * Use this to provide instant feedback while the user types.
 *
 * @param username - Username to validate
 * @returns Validation result with isValid flag and error message
 *
 * @example
 * const result = validateUsernameFormat("cool_bee")
 * if (!result.isValid) {
 *   showError(result.error)
 * } else {
 *   // Now safe to check uniqueness via API
 *   checkUsernameAvailability(username)
 * }
 */
export function validateUsernameFormat(username: string): UsernameValidationResult {
  // Trim whitespace for validation (we'll also trim on submit)
  const trimmed = username.trim()

  // Check if empty
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: "Username is required",
    }
  }

  // Check minimum length
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return {
      isValid: false,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    }
  }

  // Check maximum length
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return {
      isValid: false,
      error: `Username must be ${USERNAME_MAX_LENGTH} characters or less`,
    }
  }

  // Check for allowed characters only
  if (!ALLOWED_CHARS_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: "Username can only contain letters, numbers, and underscores",
    }
  }

  // Check for underscore at start
  if (trimmed.startsWith("_")) {
    return {
      isValid: false,
      error: "Username cannot start with an underscore",
    }
  }

  // Check for underscore at end
  if (trimmed.endsWith("_")) {
    return {
      isValid: false,
      error: "Username cannot end with an underscore",
    }
  }

  // Check for consecutive underscores
  if (CONSECUTIVE_UNDERSCORES_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: "Username cannot have consecutive underscores",
    }
  }

  // All checks passed
  return {
    isValid: true,
    error: null,
  }
}

/**
 * Sanitize username before storage.
 *
 * Trims whitespace. Does NOT change case — we store the user's
 * preferred casing but compare case-insensitively for uniqueness.
 *
 * @param username - Raw username input
 * @returns Sanitized username
 */
export function sanitizeUsername(username: string): string {
  return username.trim()
}
