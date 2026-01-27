/**
 * User-Friendly Error Messages — PlayLexi
 *
 * Maps technical errors to human-readable messages that help users
 * understand what went wrong and what they can do about it.
 *
 * ## Design Principles
 *
 * 1. **No jargon**: Users shouldn't see DNS, gRPC codes, HTTP status, etc.
 * 2. **Actionable**: Tell users what they can do (retry, check connection, etc.)
 * 3. **Reassuring**: Don't create anxiety — be calm and helpful
 * 4. **Honest**: Don't lie about what happened, just simplify
 *
 * ## Error Classification
 *
 * Errors are classified by their root cause:
 * - `network`: No internet, DNS failure, timeout
 * - `microphone`: Permission denied, device not found, in use
 * - `server`: API errors, rate limits, service unavailable
 * - `auth`: Session expired, unauthorized
 * - `unknown`: Catch-all for unclassified errors
 *
 * @see lib/toast-utils.ts for toast display
 * @see hooks/use-speech-recognition.ts for speech errors
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Error categories for classification.
 */
export type ErrorCategory =
  | "network"
  | "microphone"
  | "server"
  | "auth"
  | "unknown"

/**
 * User-friendly error with metadata.
 */
export interface FriendlyError {
  /** User-facing message (shown in toast) */
  message: string
  /** Error category for styling/icons */
  category: ErrorCategory
  /** Whether retry is likely to help */
  canRetry: boolean
  /** Suggested action text (for button) */
  actionLabel?: string
  /** Original technical error (for logging) */
  technicalDetails?: string
}

// =============================================================================
// ERROR PATTERNS
// =============================================================================

/**
 * Patterns to detect network-related errors.
 * These indicate the user should check their internet connection.
 */
const NETWORK_ERROR_PATTERNS = [
  // DNS failures
  /name resolution failed/i,
  /dns/i,
  /ENOTFOUND/i,
  // Connection failures
  /network error/i,
  /failed to fetch/i,
  /net::ERR_/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /timeout/i,
  // Offline detection
  /offline/i,
  /no internet/i,
  // gRPC unavailable (often network)
  /UNAVAILABLE/i,
  /14 UNAVAILABLE/i,
  // WebSocket failures
  /websocket.*closed/i,
  /websocket.*error/i,
  /websocket.*failed/i,
]

/**
 * Patterns to detect microphone-related errors.
 */
const MICROPHONE_ERROR_PATTERNS = [
  /permission denied/i,
  /not allowed/i,
  /notallowederror/i,
  /notfounderror/i,
  /no microphone/i,
  /microphone.*not found/i,
  /device not found/i,
  /mediadevices/i,
  /getusermedia/i,
  /audio.*unavailable/i,
  /microphone.*in use/i,
  /overconstrained/i,
]

/**
 * Patterns to detect server-side errors.
 */
const SERVER_ERROR_PATTERNS = [
  /500/i,
  /502/i,
  /503/i,
  /504/i,
  /internal server error/i,
  /service unavailable/i,
  /bad gateway/i,
  /rate limit/i,
  /too many requests/i,
  /quota exceeded/i,
]

/**
 * Patterns to detect authentication errors.
 */
const AUTH_ERROR_PATTERNS = [
  /401/i,
  /403/i,
  /unauthorized/i,
  /forbidden/i,
  /session expired/i,
  /not authenticated/i,
  /login required/i,
]

// =============================================================================
// USER-FRIENDLY MESSAGES
// =============================================================================

/**
 * User-friendly messages by category.
 * Each category has a primary message and optional variants.
 */
export const FRIENDLY_MESSAGES: Record<
  ErrorCategory,
  { message: string; canRetry: boolean; actionLabel?: string }
> = {
  network: {
    message: "Can't connect. Please check your internet connection.",
    canRetry: true,
    actionLabel: "Try again",
  },
  microphone: {
    message: "Microphone access needed. Please allow microphone permissions.",
    canRetry: true,
    actionLabel: "Try again",
  },
  server: {
    message: "Something went wrong on our end. Please try again.",
    canRetry: true,
    actionLabel: "Retry",
  },
  auth: {
    message: "Your session has expired. Please sign in again.",
    canRetry: false,
    actionLabel: "Sign in",
  },
  unknown: {
    message: "Something went wrong. Please try again.",
    canRetry: true,
    actionLabel: "Retry",
  },
}

// =============================================================================
// CLASSIFICATION FUNCTIONS
// =============================================================================

/**
 * Classify an error into a category based on its message.
 *
 * @param error - Error message or Error object
 * @returns Error category
 */
export function classifyError(error: string | Error): ErrorCategory {
  const message = typeof error === "string" ? error : error.message

  // Check patterns in order of specificity
  if (MICROPHONE_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "microphone"
  }
  if (AUTH_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "auth"
  }
  if (NETWORK_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "network"
  }
  if (SERVER_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "server"
  }

  return "unknown"
}

/**
 * Convert a technical error to a user-friendly error.
 *
 * This is the main function to use throughout the app.
 * It classifies the error and returns a user-friendly message.
 *
 * @param error - Technical error (string or Error object)
 * @returns FriendlyError with user-facing message
 *
 * @example
 * ```typescript
 * // In a catch block or error handler:
 * const friendly = toFriendlyError(error)
 * showErrorToast(friendly.message, {
 *   action: friendly.canRetry ? {
 *     label: friendly.actionLabel,
 *     onClick: () => retry()
 *   } : undefined
 * })
 *
 * // Log technical details for debugging
 * console.error("[Technical]", friendly.technicalDetails)
 * ```
 */
export function toFriendlyError(error: string | Error): FriendlyError {
  const technicalMessage = typeof error === "string" ? error : error.message
  const category = classifyError(error)
  const friendly = FRIENDLY_MESSAGES[category]

  return {
    message: friendly.message,
    category,
    canRetry: friendly.canRetry,
    actionLabel: friendly.actionLabel,
    technicalDetails: technicalMessage,
  }
}

/**
 * Get a user-friendly message for an error.
 *
 * Convenience function that just returns the message string.
 * Use `toFriendlyError` if you need the full error object.
 *
 * @param error - Technical error
 * @returns User-friendly message string
 */
export function getFriendlyMessage(error: string | Error): string {
  return toFriendlyError(error).message
}

// =============================================================================
// SPEECH-SPECIFIC ERRORS
// =============================================================================

/**
 * Speech recognition specific error messages.
 *
 * These provide more context for speech-related failures.
 */
export const SPEECH_ERRORS = {
  /** WebSocket connection to speech server failed */
  connectionFailed: {
    message: "Can't connect to voice service. Please check your connection.",
    category: "network" as ErrorCategory,
    canRetry: true,
    actionLabel: "Try again",
  },
  /** Microphone permission was denied */
  microphoneDenied: {
    message: "Microphone access needed to play. Please allow microphone in your browser settings.",
    category: "microphone" as ErrorCategory,
    canRetry: true,
    actionLabel: "Try again",
  },
  /** No microphone found on device */
  microphoneNotFound: {
    message: "No microphone found. Please connect a microphone and try again.",
    category: "microphone" as ErrorCategory,
    canRetry: true,
    actionLabel: "Try again",
  },
  /** Speech recognition failed to process audio */
  recognitionFailed: {
    message: "Couldn't understand that. Please try speaking more clearly.",
    category: "unknown" as ErrorCategory,
    canRetry: true,
    actionLabel: "Try again",
  },
  /** Speech server is unavailable */
  serverUnavailable: {
    message: "Voice service is temporarily unavailable. Please try again.",
    category: "server" as ErrorCategory,
    canRetry: true,
    actionLabel: "Retry",
  },
} as const

/**
 * Get a speech-specific friendly error.
 *
 * @param error - Technical error from speech recognition
 * @returns FriendlyError appropriate for speech context
 */
export function toSpeechFriendlyError(error: string | Error): FriendlyError {
  const technicalMessage = typeof error === "string" ? error : error.message

  // Check for specific speech error patterns
  if (/permission denied|not allowed|notallowederror/i.test(technicalMessage)) {
    return { ...SPEECH_ERRORS.microphoneDenied, technicalDetails: technicalMessage }
  }
  if (/notfounderror|no microphone|device not found/i.test(technicalMessage)) {
    return { ...SPEECH_ERRORS.microphoneNotFound, technicalDetails: technicalMessage }
  }
  if (/websocket|connection.*closed|UNAVAILABLE|dns/i.test(technicalMessage)) {
    return { ...SPEECH_ERRORS.connectionFailed, technicalDetails: technicalMessage }
  }
  if (/503|service unavailable/i.test(technicalMessage)) {
    return { ...SPEECH_ERRORS.serverUnavailable, technicalDetails: technicalMessage }
  }

  // Fall back to generic classification
  return toFriendlyError(error)
}

// =============================================================================
// WORD FETCHING ERRORS
// =============================================================================

/**
 * Word fetching specific error messages.
 */
export const WORD_ERRORS = {
  /** Network error fetching word */
  networkError: {
    message: "Can't load word. Please check your connection.",
    category: "network" as ErrorCategory,
    canRetry: true,
    actionLabel: "Retry",
  },
  /** No words available for the tier */
  noWordsAvailable: {
    message: "No words available. Please try a different difficulty.",
    category: "server" as ErrorCategory,
    canRetry: false,
  },
  /** Generic fetch failure */
  fetchFailed: {
    message: "Couldn't load the next word. Please try again.",
    category: "unknown" as ErrorCategory,
    canRetry: true,
    actionLabel: "Retry",
  },
} as const

/**
 * Get a word-fetch-specific friendly error.
 *
 * @param error - Technical error from word fetching
 * @returns FriendlyError appropriate for word context
 */
export function toWordFriendlyError(error: string | Error): FriendlyError {
  const technicalMessage = typeof error === "string" ? error : error.message

  // Check for specific patterns
  if (/no words|empty|not found for tier/i.test(technicalMessage)) {
    return { ...WORD_ERRORS.noWordsAvailable, technicalDetails: technicalMessage }
  }
  if (NETWORK_ERROR_PATTERNS.some((p) => p.test(technicalMessage))) {
    return { ...WORD_ERRORS.networkError, technicalDetails: technicalMessage }
  }

  // Fall back to generic word error
  return { ...WORD_ERRORS.fetchFailed, technicalDetails: technicalMessage }
}
