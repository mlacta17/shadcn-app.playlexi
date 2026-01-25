/**
 * Phonetic Learning Stats API — Debug endpoint for observability.
 *
 * GET /api/phonetic-learning/stats?userId=abc123
 *
 * Returns comprehensive statistics about a user's phonetic learning:
 * - All learned mappings with metadata
 * - Recent recognition logs
 * - Aggregate statistics
 *
 * ## Security Note
 *
 * This endpoint is intended for debugging/development use.
 * In production, consider adding authentication checks.
 *
 * @see lib/phonetic-learning/learning-engine.ts
 * @see hooks/use-phonetic-learning.ts
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import {
  createDb,
  userPhoneticMappings,
  recognitionLogs,
  eq,
  desc,
  sql,
  and,
} from "@/db"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface PhoneticMappingStat {
  id: string
  heard: string
  intended: string
  source: "auto_learned" | "manual" | "support_added"
  confidence: number
  occurrenceCount: number
  timesApplied: number
  createdAt: string // ISO timestamp for JSON serialization
  updatedAt: string // ISO timestamp for JSON serialization
}

interface RecognitionLogEntry {
  id: string
  wordToSpell: string
  googleTranscript: string
  extractedLetters: string
  wasCorrect: boolean
  rejectionReason: string | null
  createdAt: string // ISO timestamp for JSON serialization
}

interface AggregateStats {
  totalMappings: number
  autoLearnedCount: number
  manualCount: number
  avgConfidence: number
  totalLogsLast30Days: number
  successRate: number
  mostUsedMapping: { heard: string; intended: string; timesApplied: number } | null
}

interface SuccessResponse {
  success: true
  userId: string
  stats: AggregateStats
  mappings: PhoneticMappingStat[]
  recentLogs: RecognitionLogEntry[]
}

interface ErrorResponse {
  success: false
  error: string
}

type ApiResponse = SuccessResponse | ErrorResponse

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert Date or timestamp to ISO string for JSON serialization.
 */
function toISOString(value: Date | number | null | undefined): string {
  if (!value) return new Date(0).toISOString()
  if (value instanceof Date) return value.toISOString()
  return new Date(value * 1000).toISOString()
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * GET /api/phonetic-learning/stats
 *
 * Fetches comprehensive phonetic learning statistics for debugging.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const logsLimit = Math.min(
      parseInt(searchParams.get("logsLimit") || "50", 10),
      100
    )

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "userId parameter is required",
        },
        { status: 400 }
      )
    }

    // Get D1 database binding
    const { env } = await getCloudflareContext({ async: true })
    const db = createDb(env.DB)

    // Fetch all user mappings
    const mappingsRows = await db
      .select()
      .from(userPhoneticMappings)
      .where(eq(userPhoneticMappings.userId, userId))
      .orderBy(desc(userPhoneticMappings.timesApplied))

    // Transform to response type (handle Date → ISO string conversion)
    const mappings: PhoneticMappingStat[] = mappingsRows.map((row) => ({
      id: row.id,
      heard: row.heard,
      intended: row.intended,
      source: row.source as PhoneticMappingStat["source"],
      confidence: row.confidence,
      occurrenceCount: row.occurrenceCount,
      timesApplied: row.timesApplied,
      createdAt: toISOString(row.createdAt),
      updatedAt: toISOString(row.updatedAt),
    }))

    // Fetch recent recognition logs (last 30 days)
    // Use raw SQL for date comparison since schema uses mode: "timestamp"
    const thirtyDaysAgoUnix = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
    const logsRows = await db
      .select()
      .from(recognitionLogs)
      .where(
        and(
          eq(recognitionLogs.userId, userId),
          sql`${recognitionLogs.createdAt} >= ${thirtyDaysAgoUnix}`
        )
      )
      .orderBy(desc(recognitionLogs.createdAt))
      .limit(logsLimit)

    // Transform to response type (handle Date → ISO string conversion)
    const recentLogs: RecognitionLogEntry[] = logsRows.map((row) => ({
      id: row.id,
      wordToSpell: row.wordToSpell,
      googleTranscript: row.googleTranscript,
      extractedLetters: row.extractedLetters,
      wasCorrect: row.wasCorrect,
      rejectionReason: row.rejectionReason,
      createdAt: toISOString(row.createdAt),
    }))

    // Calculate aggregate stats
    const totalMappings = mappings.length
    const autoLearnedCount = mappings.filter(
      (m) => m.source === "auto_learned"
    ).length
    const manualCount = mappings.filter((m) => m.source === "manual").length
    const avgConfidence =
      totalMappings > 0
        ? mappings.reduce((sum, m) => sum + m.confidence, 0) / totalMappings
        : 0

    // Calculate success rate from logs (use raw SQL for date comparison)
    const totalLogsResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(recognitionLogs)
      .where(
        and(
          eq(recognitionLogs.userId, userId),
          sql`${recognitionLogs.createdAt} >= ${thirtyDaysAgoUnix}`
        )
      )
    const totalLogsLast30Days = totalLogsResult[0]?.count ?? 0

    const correctLogsResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(recognitionLogs)
      .where(
        and(
          eq(recognitionLogs.userId, userId),
          sql`${recognitionLogs.createdAt} >= ${thirtyDaysAgoUnix}`,
          eq(recognitionLogs.wasCorrect, true)
        )
      )
    const correctCount = correctLogsResult[0]?.count ?? 0
    const successRate =
      totalLogsLast30Days > 0 ? correctCount / totalLogsLast30Days : 0

    // Find most used mapping
    const mostUsedMapping =
      mappings.length > 0 && mappings[0].timesApplied > 0
        ? {
            heard: mappings[0].heard,
            intended: mappings[0].intended,
            timesApplied: mappings[0].timesApplied,
          }
        : null

    const stats: AggregateStats = {
      totalMappings,
      autoLearnedCount,
      manualCount,
      avgConfidence,
      totalLogsLast30Days,
      successRate,
      mostUsedMapping,
    }

    return NextResponse.json({
      success: true,
      userId,
      stats,
      mappings,
      recentLogs,
    })
  } catch (error) {
    console.error("[PhoneticLearningStats] Error:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch phonetic learning stats",
      },
      { status: 500 }
    )
  }
}
