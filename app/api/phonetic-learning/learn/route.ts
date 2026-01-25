/**
 * Learning Trigger API — Phase 4.2: Auto-Learning
 *
 * POST /api/phonetic-learning/learn
 *
 * Analyzes a user's recognition logs and creates learned mappings.
 * This can be called:
 * 1. After a game session ends
 * 2. Periodically via a cron job
 * 3. Manually from admin tools
 *
 * ## Request Body
 *
 * ```json
 * {
 *   "userId": "abc123"
 * }
 * ```
 *
 * ## Response
 *
 * Success (200):
 * ```json
 * {
 *   "success": true,
 *   "logsAnalyzed": 47,
 *   "patternsFound": 3,
 *   "mappingsCreated": 2,
 *   "newMappings": [
 *     { "heard": "ohs", "intended": "o" },
 *     { "heard": "tio", "intended": "t" }
 *   ]
 * }
 * ```
 *
 * @see lib/phonetic-learning/learning-engine.ts
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import {
  createDb,
  recognitionLogs,
  userPhoneticMappings,
  eq,
  and,
  gt,
  sql,
} from "@/db"
import {
  findLearnablePatterns,
  createMappingFromPattern,
  DEFAULT_LEARNING_CONFIG,
  type RecognitionEvent,
} from "@/lib/phonetic-learning"
import { SPOKEN_LETTER_NAMES } from "@/lib/answer-validation"
import { handleApiError, Errors, type ApiErrorResponse } from "@/lib/api"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SuccessResponse {
  success: true
  logsAnalyzed: number
  patternsFound: number
  mappingsCreated: number
  newMappings: Array<{ heard: string; intended: string }>
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
 * POST /api/phonetic-learning/learn
 *
 * Triggers learning for a specific user.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    const body = (await request.json()) as { userId?: string }

    // Validate user ID
    if (!body.userId || typeof body.userId !== "string") {
      throw Errors.invalidInput("userId", "Required field missing or invalid type")
    }

    const userId = body.userId

    // Get D1 database binding
    const { env } = await getCloudflareContext({ async: true })
    const db = createDb(env.DB)

    // Fetch user's existing mappings
    const existingMappings = await db
      .select()
      .from(userPhoneticMappings)
      .where(eq(userPhoneticMappings.userId, userId))

    // Convert to Map for learning engine
    const userMappingsMap = new Map<string, string>(
      existingMappings.map((m) => [m.heard, m.intended])
    )

    // Fetch recent incorrect recognition logs (last 30 days)
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
    const logs = await db
      .select()
      .from(recognitionLogs)
      .where(
        and(
          eq(recognitionLogs.userId, userId),
          eq(recognitionLogs.wasCorrect, false),
          gt(recognitionLogs.createdAt, new Date(thirtyDaysAgo * 1000))
        )
      )
      .limit(500) // Limit to prevent memory issues

    if (logs.length === 0) {
      return NextResponse.json({
        success: true,
        logsAnalyzed: 0,
        patternsFound: 0,
        mappingsCreated: 0,
        newMappings: [],
      })
    }

    // Convert database rows to RecognitionEvent format
    const events: Array<RecognitionEvent & { id: string }> = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      wordToSpell: log.wordToSpell,
      googleTranscript: log.googleTranscript,
      extractedLetters: log.extractedLetters,
      wasCorrect: log.wasCorrect,
      rejectionReason: log.rejectionReason ?? undefined,
      inputMethod: log.inputMethod ?? undefined,
    }))

    // Find learnable patterns
    const patterns = findLearnablePatterns(
      events,
      SPOKEN_LETTER_NAMES,
      userMappingsMap,
      DEFAULT_LEARNING_CONFIG
    )

    // Create mappings for new patterns
    const newMappings: Array<{ heard: string; intended: string }> = []
    let mappingsCreated = 0

    for (const pattern of patterns) {
      // Skip if we already have this mapping
      if (userMappingsMap.has(pattern.heard)) {
        continue
      }

      // Create the mapping
      const mapping = createMappingFromPattern(
        pattern,
        userId,
        DEFAULT_LEARNING_CONFIG
      )

      // Insert into database
      try {
        await db
          .insert(userPhoneticMappings)
          .values({
            userId: mapping.userId,
            heard: mapping.heard,
            intended: mapping.intended,
            source: mapping.source,
            confidence: mapping.confidence,
            occurrenceCount: mapping.occurrenceCount,
            timesApplied: 0,
          })
          .onConflictDoUpdate({
            target: [userPhoneticMappings.userId, userPhoneticMappings.heard],
            set: {
              confidence: mapping.confidence,
              occurrenceCount: sql`${userPhoneticMappings.occurrenceCount} + ${mapping.occurrenceCount}`,
              updatedAt: sql`(unixepoch())`,
            },
          })

        newMappings.push({
          heard: mapping.heard,
          intended: mapping.intended,
        })
        mappingsCreated++

        // Log for debugging
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[PhoneticLearning] Created mapping for user ${userId}: "${mapping.heard}" → "${mapping.intended}" (confidence: ${mapping.confidence.toFixed(2)})`
          )
        }
      } catch (insertError) {
        console.error(
          `[PhoneticLearning] Failed to insert mapping for "${pattern.heard}":`,
          insertError
        )
      }
    }

    return NextResponse.json({
      success: true,
      logsAnalyzed: logs.length,
      patternsFound: patterns.length,
      mappingsCreated,
      newMappings,
    })
  } catch (error) {
    return handleApiError(error, "[TriggerLearning]")
  }
}
