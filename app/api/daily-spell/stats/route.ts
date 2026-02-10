/**
 * Daily Spell Stats API Route — PlayLexi
 *
 * Get user's Daily Spell statistics.
 *
 * ## Endpoints
 *
 * GET /api/daily-spell/stats
 * - Get user's streak and statistics
 * - Returns: { currentStreak, bestStreak, totalGamesPlayed, totalWins, winRate, weekActivity }
 *
 * @see lib/services/daily-spell-service.ts for business logic
 */

import { NextResponse } from "next/server"
import { requireAuth, handleApiError } from "@/lib/api"
import {
  getUserStats,
  getWeekActivity,
} from "@/lib/services/daily-spell-service"

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/daily-spell/stats
 *
 * Get user's Daily Spell statistics.
 */
export async function GET() {
  try {
    const { user, db } = await requireAuth()

    const [stats, weekActivity] = await Promise.all([
      getUserStats(db, user.id),
      getWeekActivity(db, user.id),
    ])

    return NextResponse.json({
      ...stats,
      weekActivity,
    })
  } catch (error) {
    return handleApiError(error, "[GetDailySpellStats]")
  }
}
