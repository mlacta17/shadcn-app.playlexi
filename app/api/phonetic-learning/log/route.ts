/**
 * Recognition Logging API — Phase 4.1: Data Collection
 *
 * POST /api/phonetic-learning/log
 *
 * Logs a speech recognition event for pattern analysis.
 * Called after every voice answer submission to enable learning.
 *
 * ## Authentication
 *
 * This endpoint requires authentication. The user ID is extracted from
 * the authenticated session, NOT from the request body. This prevents
 * malicious users from logging fake data for other users.
 *
 * ## Request Body
 *
 * ```json
 * {
 *   "wordToSpell": "to",
 *   "googleTranscript": "tee ohs",
 *   "extractedLetters": "tos",
 *   "wasCorrect": false,
 *   "rejectionReason": null,
 *   "inputMethod": "voice"
 * }
 * ```
 *
 * Note: userId is no longer accepted in the body — it's taken from auth session.
 *
 * ## Response
 *
 * Success (201):
 * ```json
 * { "success": true, "id": "log-123" }
 * ```
 *
 * Error (400/401/500):
 * ```json
 * { "success": false, "error": "Error message" }
 * ```
 *
 * @see lib/phonetic-learning/recognition-logger.ts
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */

import { NextRequest, NextResponse } from "next/server"
import { createDb, recognitionLogs } from "@/db"
import {
  validateRecognitionEvent,
  createLogRecord,
} from "@/lib/phonetic-learning"
import { requireAuth, handleApiError, Errors, type ApiErrorResponse } from "@/lib/api"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SuccessResponse {
  success: true
  id: string
}

interface ErrorResponse {
  success: false
  error: string
}

type ApiResponse = SuccessResponse | ApiErrorResponse

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /api/phonetic-learning/log
 *
 * Logs a recognition event to the database.
 * Requires authentication — user ID comes from session, not request body.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    // Require authentication — user can only log their own data
    const { user, db: d1Binding } = await requireAuth()
    const db = createDb(d1Binding)

    // Parse request body (typed as Record for spreading)
    const body = (await request.json()) as Record<string, unknown>

    // Inject authenticated user's ID (override any userId in body for security)
    const eventWithUserId = { ...body, userId: user.id }

    // Validate the event
    const validation = validateRecognitionEvent(eventWithUserId)
    if (!validation.isValid) {
      throw Errors.validation(validation.error || "Invalid event data")
    }

    // Create log record (body is validated above)
    const record = createLogRecord(eventWithUserId as Parameters<typeof createLogRecord>[0])

    // Insert the log record
    const result = await db
      .insert(recognitionLogs)
      .values(record)
      .returning({ id: recognitionLogs.id })

    const insertedId = result[0]?.id

    if (!insertedId) {
      throw Errors.database("insert", { table: "recognitionLogs" })
    }

    return NextResponse.json(
      {
        success: true,
        id: insertedId,
      },
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error, "[LogRecognitionEvent]")
  }
}
