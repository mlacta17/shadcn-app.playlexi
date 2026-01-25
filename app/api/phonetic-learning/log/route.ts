/**
 * Recognition Logging API — Phase 4.1: Data Collection
 *
 * POST /api/phonetic-learning/log
 *
 * Logs a speech recognition event for pattern analysis.
 * Called after every voice answer submission to enable learning.
 *
 * ## Request Body
 *
 * ```json
 * {
 *   "userId": "abc123",
 *   "wordToSpell": "to",
 *   "googleTranscript": "tee ohs",
 *   "extractedLetters": "tos",
 *   "wasCorrect": false,
 *   "rejectionReason": null,
 *   "inputMethod": "voice"
 * }
 * ```
 *
 * ## Response
 *
 * Success (201):
 * ```json
 * { "success": true, "id": "log-123" }
 * ```
 *
 * Error (400/500):
 * ```json
 * { "success": false, "error": "Error message" }
 * ```
 *
 * @see lib/phonetic-learning/recognition-logger.ts
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createDb, recognitionLogs } from "@/db"
import {
  validateRecognitionEvent,
  createLogRecord,
} from "@/lib/phonetic-learning"
import { handleApiError, Errors, type ApiErrorResponse } from "@/lib/api"

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
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse request body
    const body = await request.json()

    // Validate the event
    const validation = validateRecognitionEvent(body)
    if (!validation.isValid) {
      throw Errors.validation(validation.error || "Invalid event data")
    }

    // Create log record (body is validated above)
    const record = createLogRecord(body as Parameters<typeof createLogRecord>[0])

    // Get D1 database binding from Cloudflare context
    const { env } = await getCloudflareContext({ async: true })
    const db = createDb(env.DB)

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
