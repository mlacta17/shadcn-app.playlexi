/**
 * Daily Spell API Route — PlayLexi
 *
 * Main endpoint for Daily Spell operations.
 *
 * ## Endpoints
 *
 * GET /api/daily-spell
 * - Get today's puzzle with user's status
 * - Query params: userId (optional, for anonymous users)
 * - Returns: { puzzle, userResult, stats }
 *
 * POST /api/daily-spell
 * - Submit daily spell result
 * - Body: { puzzleId, wordResults, visitorId? }
 * - Returns: { score, emojiRow, percentile }
 *
 * @see lib/services/daily-spell-service.ts for business logic
 */

import { NextResponse } from "next/server"
import { optionalAuth, handleApiError, Errors } from "@/lib/api"
import {
  getTodayPuzzle,
  submitResult,
  getUserStats,
  hasPlayedToday,
  markReferralAsPlayed,
  type WordResult,
} from "@/lib/services/daily-spell-service"

// =============================================================================
// TYPES
// =============================================================================

interface SubmitRequest {
  puzzleId: string
  wordResults: WordResult[]
  visitorId?: string // For anonymous users
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/daily-spell
 *
 * Get today's puzzle and user's status.
 */
export async function GET(request: Request) {
  try {
    const { user, db } = await optionalAuth()
    const { searchParams } = new URL(request.url)

    // For anonymous users, they can pass a visitorId
    const visitorId = searchParams.get("visitorId")
    const userId = user?.id || visitorId

    // Get today's puzzle
    const puzzle = await getTodayPuzzle(db, userId || null)

    if (!puzzle) {
      return NextResponse.json(
        { error: "No puzzle available for today" },
        { status: 404 }
      )
    }

    // Get user stats if authenticated
    let stats = null
    if (user) {
      stats = await getUserStats(db, user.id)
    }

    // Check if already played (for any user type)
    const hasPlayed = userId ? await hasPlayedToday(db, userId) : false

    return NextResponse.json({
      puzzle: {
        id: puzzle.puzzleId,
        number: puzzle.puzzleNumber,
        date: puzzle.puzzleDate,
        // Only include word data if not played yet
        // (hide words from someone who might try to cheat)
        words: hasPlayed
          ? puzzle.words.map((w) => ({
              id: w.id,
              word: w.word,
              definition: w.definition,
              difficultyTier: w.difficultyTier,
            }))
          : puzzle.words,
      },
      userResult: puzzle.userResult,
      stats,
      hasPlayed,
      isAuthenticated: !!user,
    })
  } catch (error) {
    return handleApiError(error, "[GetDailySpell]")
  }
}

/**
 * POST /api/daily-spell
 *
 * Submit daily spell result.
 */
export async function POST(request: Request) {
  try {
    const { user, db } = await optionalAuth()
    const body = (await request.json()) as SubmitRequest

    // Validate input
    if (!body.puzzleId) {
      throw Errors.validation("puzzleId is required")
    }

    if (
      !body.wordResults ||
      !Array.isArray(body.wordResults) ||
      body.wordResults.length !== 5
    ) {
      throw Errors.validation("wordResults must be an array of 5 results")
    }

    // Determine user ID (authenticated or anonymous)
    const userId = user?.id || body.visitorId
    if (!userId) {
      throw Errors.validation(
        "Either authentication or visitorId is required"
      )
    }

    // Check if already played
    const alreadyPlayed = await hasPlayedToday(db, userId)
    if (alreadyPlayed) {
      throw Errors.validation("You have already played today's Daily Spell")
    }

    // Submit result
    const result = await submitResult(db, {
      puzzleId: body.puzzleId,
      userId,
      isAuthenticated: !!user,
      wordResults: body.wordResults,
    })

    // If anonymous user with visitorId, mark their referral as played
    if (!user && body.visitorId) {
      await markReferralAsPlayed(db, body.visitorId)
    }

    // Get updated stats if authenticated
    let stats = null
    if (user) {
      stats = await getUserStats(db, user.id)
    }

    return NextResponse.json({
      ...result,
      stats,
    })
  } catch (error) {
    return handleApiError(error, "[SubmitDailySpell]")
  }
}
