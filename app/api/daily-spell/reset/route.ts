/**
 * Daily Spell Reset API — Development Only
 *
 * Resets the current user's daily spell progress for debugging.
 * This endpoint is ONLY available in development mode.
 *
 * ## Usage
 *
 * ```bash
 * # Reset today's result only
 * curl -X DELETE http://localhost:3000/api/daily-spell/reset
 *
 * # Reset today's result + streak
 * curl -X DELETE "http://localhost:3000/api/daily-spell/reset?streak=true"
 *
 * # Full reset (all history + streak)
 * curl -X DELETE "http://localhost:3000/api/daily-spell/reset?all=true"
 * ```
 *
 * ## What Gets Reset
 *
 * - Today's puzzle result (from daily_spell_results)
 * - Optionally: streak data (with ?streak=true query param)
 * - Optionally: all history (with ?all=true query param)
 *
 * ## Security
 *
 * - Only works in development (NODE_ENV !== 'production')
 * - Requires authentication (uses requireAuth from @/lib/api)
 *
 * @see /lib/services/daily-spell-service.ts for data model
 */

import { NextRequest, NextResponse } from "next/server"
import { drizzle } from "drizzle-orm/d1"
import { and, eq } from "drizzle-orm"

import { requireAuth, handleApiError, Errors } from "@/lib/api"
import { dailySpellResults, dailySpellPuzzles, dailySpellStreaks } from "@/db/schema"
import { getTodayDate } from "@/lib/services/daily-spell-service"

// =============================================================================
// DELETE — Reset Daily Spell Progress
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // Security: Only allow in development
    // -------------------------------------------------------------------------
    if (process.env.NODE_ENV === "production") {
      throw Errors.forbidden("This endpoint is only available in development mode")
    }

    // -------------------------------------------------------------------------
    // Auth: Require authenticated user (uses centralized auth pattern)
    // -------------------------------------------------------------------------
    const { user, db: d1 } = await requireAuth()
    const userId = user.id

    // -------------------------------------------------------------------------
    // Parse Options
    // -------------------------------------------------------------------------
    const { searchParams } = new URL(request.url)
    const resetStreak = searchParams.get("streak") === "true"
    const resetAll = searchParams.get("all") === "true"

    // -------------------------------------------------------------------------
    // Database Connection (use Drizzle ORM for type safety)
    // -------------------------------------------------------------------------
    const db = drizzle(d1)
    const today = getTodayDate()

    const results: Record<string, number> = {}

    // -----------------------------------------------------------------------
    // Get today's puzzle
    // -----------------------------------------------------------------------
    const todayPuzzle = await db
      .select({ id: dailySpellPuzzles.id, puzzleNumber: dailySpellPuzzles.puzzleNumber })
      .from(dailySpellPuzzles)
      .where(eq(dailySpellPuzzles.puzzleDate, today))
      .get()

    if (!todayPuzzle) {
      throw Errors.notFound(`No puzzle found for today (${today})`)
    }

    // -----------------------------------------------------------------------
    // Delete results
    // -----------------------------------------------------------------------
    if (resetAll) {
      // Delete ALL results for this user (useful for full reset)
      const allResults = await db
        .delete(dailySpellResults)
        .where(eq(dailySpellResults.userId, userId))
        .returning({ id: dailySpellResults.id })

      results.deletedResults = allResults.length
    } else {
      // Delete only today's result
      const todayResult = await db
        .delete(dailySpellResults)
        .where(
          and(
            eq(dailySpellResults.puzzleId, todayPuzzle.id),
            eq(dailySpellResults.userId, userId)
          )
        )
        .returning({ id: dailySpellResults.id })

      results.deletedTodayResult = todayResult.length
    }

    // -----------------------------------------------------------------------
    // Reset streak if requested
    // -----------------------------------------------------------------------
    if (resetStreak || resetAll) {
      const streakResult = await db
        .delete(dailySpellStreaks)
        .where(eq(dailySpellStreaks.userId, userId))
        .returning({ id: dailySpellStreaks.id })

      results.deletedStreak = streakResult.length
    }

    // -----------------------------------------------------------------------
    // Success Response
    // -----------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      message: "Daily Spell progress reset successfully",
      userId,
      userEmail: user.email,
      puzzleDate: today,
      puzzleNumber: todayPuzzle.puzzleNumber,
      options: {
        resetStreak: resetStreak || resetAll,
        resetAll,
      },
      ...results,
    })
  } catch (error) {
    return handleApiError(error, "[DailySpellReset]")
  }
}
