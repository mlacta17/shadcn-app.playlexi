/**
 * Game Finish API Route — PlayLexi
 *
 * Finalizes a game session with results.
 *
 * ## Endpoints
 *
 * POST /api/games/:gameId/finish
 * - Records all rounds and awards XP (server-validated)
 * - Body: { rounds: RoundResult[], heartsRemaining: number, blitzScore?: number }
 * - Returns: { success: true, xpEarned: number }
 * - Status: 200 (success), 401 (not authenticated), 404 (game not found), 400 (invalid input)
 *
 * ## Security
 *
 * XP is calculated SERVER-SIDE based on the rounds submitted. The client-sent
 * xpEarned value is logged for debugging but NEVER trusted. This prevents
 * cheating by manipulating client-side XP calculations.
 *
 * @see lib/services/game-service.ts for business logic
 * @see lib/game-constants.ts for XP calculation formula
 */

import { NextResponse } from "next/server"
import { requireAuth, handleApiError, Errors } from "@/lib/api"
import { finalizeGame, getGameById, type RoundResult } from "@/lib/services/game-service"
import { calculateXP } from "@/lib/game-constants"
import { getUserStatus } from "@/lib/services/user-service"

// =============================================================================
// TYPES
// =============================================================================

interface FinishGameRequest {
  rounds: RoundResult[]
  heartsRemaining: number
  /** Blitz score for blitz mode (used in XP calculation) */
  blitzScore?: number
  /**
   * Client-calculated XP (for logging/debugging only, NOT trusted).
   * Server recalculates XP from rounds to prevent cheating.
   * @deprecated Use server-calculated XP instead
   */
  xpEarned?: number
}

// =============================================================================
// VALIDATION
// =============================================================================

function isValidRound(round: unknown): round is RoundResult {
  if (typeof round !== "object" || round === null) return false
  const r = round as Record<string, unknown>
  return (
    typeof r.roundNumber === "number" &&
    typeof r.wordId === "string" &&
    typeof r.answer === "string" &&
    typeof r.isCorrect === "boolean" &&
    typeof r.timeTaken === "number"
  )
}

function isValidRequest(body: unknown): body is FinishGameRequest {
  if (typeof body !== "object" || body === null) return false
  const b = body as Record<string, unknown>
  return (
    Array.isArray(b.rounds) &&
    b.rounds.every(isValidRound) &&
    typeof b.heartsRemaining === "number" &&
    // blitzScore is optional, but must be a number if present
    (b.blitzScore === undefined || typeof b.blitzScore === "number")
  )
}

// =============================================================================
// HANDLERS
// =============================================================================

interface RouteContext {
  params: Promise<{ gameId: string }>
}

/**
 * POST /api/games/:gameId/finish
 *
 * Finalize a game session with results.
 *
 * XP is calculated server-side based on:
 * - Endless mode: correctCount * 5 XP
 * - Blitz mode: blitzScore * 2 XP
 */
export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const { gameId } = await context.params

    // Require authentication
    const { user, db } = await requireAuth()

    // Pre-flight check: Ensure user has a PlayLexi profile
    // This catches the case where user logged in but didn't complete onboarding
    const userStatus = await getUserStatus(db, user.id)
    if (!userStatus.exists) {
      console.error("[FinishGame] User has no PlayLexi profile:", {
        authUserId: user.id,
        authEmail: user.email,
      })
      throw Errors.validation(
        "Profile incomplete. Please complete onboarding first.",
        { needsProfile: true, redirectTo: "/onboarding/profile" }
      )
    }

    // Parse and validate request body
    const body = await request.json()

    if (!isValidRequest(body)) {
      throw Errors.validation("Invalid request body", {
        expected: "{ rounds: RoundResult[], heartsRemaining: number, blitzScore?: number }",
      })
    }

    // Fetch the game to get mode for XP calculation
    const game = await getGameById(db, gameId)
    if (!game) {
      throw Errors.notFound("Game")
    }

    // Verify this is the user's game
    if (game.hostId !== user.id) {
      throw Errors.forbidden("You can only finish your own games")
    }

    // SECURITY: Calculate XP server-side from verified rounds
    const correctCount = body.rounds.filter(r => r.isCorrect).length
    const serverCalculatedXP = calculateXP(
      game.mode,
      correctCount,
      body.blitzScore ?? 0
    )

    // Log discrepancy for debugging (if client sent xpEarned)
    if (body.xpEarned !== undefined && body.xpEarned !== serverCalculatedXP) {
      console.warn(
        `[FinishGame] XP mismatch for game ${gameId}:`,
        `client=${body.xpEarned}, server=${serverCalculatedXP}`,
        `(mode=${game.mode}, correct=${correctCount}, blitzScore=${body.blitzScore ?? 0})`
      )
    }

    // Finalize game with server-calculated XP
    try {
      await finalizeGame(db, {
        gameId,
        userId: user.id,
        rounds: body.rounds,
        xpEarned: serverCalculatedXP,
        heartsRemaining: body.heartsRemaining,
      })
    } catch (finalizeError) {
      // Log detailed error for debugging database issues
      console.error("[FinishGame] finalizeGame failed:", {
        gameId,
        userId: user.id,
        roundCount: body.rounds.length,
        wordIds: body.rounds.map(r => r.wordId),
        error: finalizeError instanceof Error ? {
          name: finalizeError.name,
          message: finalizeError.message,
          stack: finalizeError.stack,
        } : String(finalizeError),
      })
      throw finalizeError
    }

    return NextResponse.json({
      success: true,
      xpEarned: serverCalculatedXP,
    })
  } catch (error) {
    return handleApiError(error, "[FinishGame]")
  }
}
