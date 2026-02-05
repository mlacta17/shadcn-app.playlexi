/**
 * Recognition Logger — Phase 4.1: Data Collection
 *
 * This module logs speech recognition events during gameplay.
 * Every voice answer submission is recorded for:
 *
 * 1. Pattern detection (finding learnable phonetic variations)
 * 2. Analytics (understanding where recognition fails)
 * 3. Debugging (investigating user-reported issues)
 *
 * ## Usage
 *
 * ```typescript
 * import { logRecognitionEvent } from "@/lib/phonetic-learning"
 *
 * // In game session hook after answer validation
 * await logRecognitionEvent({
 *   userId: currentUser.id,
 *   wordToSpell: "book",
 *   googleTranscript: "bee ohs ohs kay",
 *   extractedLetters: "book",
 *   wasCorrect: true,
 *   inputMethod: "voice",
 * })
 * ```
 *
 * ## Privacy Considerations
 *
 * - Logs are per-user and never shared between users
 * - Logs older than 30 days should be purged
 * - No audio is stored, only text transcripts
 *
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */

import type { RecognitionEvent, RecognitionLogRecord } from "./types"

// =============================================================================
// CLIENT-SIDE LOGGING (calls API)
// =============================================================================

/**
 * Log a recognition event to the server.
 *
 * This should be called after every voice answer submission,
 * regardless of whether the answer was correct.
 *
 * The function is fire-and-forget — errors are logged but don't
 * affect gameplay. We don't want logging failures to break the game.
 *
 * @param event - The recognition event to log
 * @returns Promise that resolves when the event is logged (or fails silently)
 *
 * @example
 * ```typescript
 * // After validating an answer
 * logRecognitionEvent({
 *   userId: user.id,
 *   wordToSpell: currentWord.word,
 *   googleTranscript: rawTranscript,
 *   extractedLetters: validationResult.normalizedAnswer,
 *   wasCorrect: validationResult.isCorrect,
 *   rejectionReason: validationResult.rejectionReason,
 *   inputMethod: "voice",
 * }).catch(() => {
 *   // Silently ignore - logging shouldn't break the game
 * })
 * ```
 */
export async function logRecognitionEvent(
  event: RecognitionEvent
): Promise<void> {
  // Skip if no user ID (anonymous/guest users)
  if (!event.userId) {
    if (process.env.NODE_ENV === "development") {
      console.log("[PhoneticLearning] Skipping log: no userId")
    }
    return
  }

  // Skip keyboard input (we only learn from voice)
  if (event.inputMethod === "keyboard") {
    return
  }

  try {
    const response = await fetch("/api/phonetic-learning/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      // Log warning but don't throw - logging shouldn't break gameplay
      console.warn(
        `[PhoneticLearning] Failed to log event: ${response.status}`
      )
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[PhoneticLearning] Logged event:", {
        word: event.wordToSpell,
        transcript: event.googleTranscript,
        extracted: event.extractedLetters,
        correct: event.wasCorrect,
      })
    }
  } catch (error) {
    // Fire-and-forget: don't let logging errors affect gameplay
    console.warn("[PhoneticLearning] Error logging event:", error)
  }
}

// =============================================================================
// SERVER-SIDE OPERATIONS (for API routes)
// =============================================================================

/**
 * Create a recognition log record for database insertion.
 *
 * Used by the API route handler. Validates the event and
 * transforms it into a database-ready format.
 *
 * @param event - The recognition event from the client
 * @returns Record ready for database insertion
 */
export function createLogRecord(
  event: RecognitionEvent
): Omit<RecognitionLogRecord, "id" | "createdAt"> {
  return {
    userId: event.userId,
    wordToSpell: event.wordToSpell.toLowerCase().trim(),
    googleTranscript: event.googleTranscript.toLowerCase().trim(),
    extractedLetters: event.extractedLetters.toLowerCase().trim(),
    wasCorrect: event.wasCorrect,
    rejectionReason: event.rejectionReason,
    inputMethod: event.inputMethod,
  }
}

/**
 * Validate a recognition event before logging.
 *
 * @param event - Event to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateRecognitionEvent(event: unknown): {
  isValid: boolean
  error?: string
} {
  if (!event || typeof event !== "object") {
    return { isValid: false, error: "Event must be an object" }
  }

  const e = event as Record<string, unknown>

  if (typeof e.userId !== "string" || !e.userId) {
    return { isValid: false, error: "userId is required" }
  }

  if (typeof e.wordToSpell !== "string" || !e.wordToSpell) {
    return { isValid: false, error: "wordToSpell is required" }
  }

  if (typeof e.googleTranscript !== "string") {
    return { isValid: false, error: "googleTranscript is required" }
  }

  if (typeof e.extractedLetters !== "string") {
    return { isValid: false, error: "extractedLetters is required" }
  }

  if (typeof e.wasCorrect !== "boolean") {
    return { isValid: false, error: "wasCorrect must be a boolean" }
  }

  return { isValid: true }
}

// =============================================================================
// QUERY HELPERS (for learning engine)
// =============================================================================

/**
 * Query parameters for fetching recognition logs.
 */
export interface RecognitionLogQuery {
  /** Filter by user ID (required) */
  userId: string

  /** Only include incorrect answers (for learning) */
  incorrectOnly?: boolean

  /** Limit number of results */
  limit?: number

  /** Only include logs newer than this date */
  since?: Date
}

/**
 * Build a description of what logs to fetch.
 *
 * The actual database query is implemented in the API route.
 * This helper standardizes the query format.
 *
 * @param query - Query parameters
 * @returns Standardized query object
 */
export function buildLogQuery(query: RecognitionLogQuery): RecognitionLogQuery {
  return {
    userId: query.userId,
    incorrectOnly: query.incorrectOnly ?? true, // Default: only incorrect for learning
    limit: query.limit ?? 100, // Default: last 100 logs
    since: query.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
  }
}
