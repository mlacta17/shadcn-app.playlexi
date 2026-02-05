/**
 * Game History API Route — PlayLexi
 *
 * Fetches user's game history and statistics.
 *
 * ## Endpoints
 *
 * GET /api/games/history
 * - Query params: mode (required), inputMethod (required), limit (optional, default: 50)
 * - Returns: { games: GameHistoryEntry[], stats: GameStats }
 * - Status: 200 (success), 401 (not authenticated), 400 (invalid params)
 *
 * @see lib/services/game-service.ts for business logic
 */

import { NextResponse } from "next/server"
import { requireAuth, handleApiError, Errors } from "@/lib/api"
import { getGameHistory, getGameStats } from "@/lib/services/game-service"
import type { GameMode, InputMethod } from "@/db/schema"

// =============================================================================
// VALIDATION
// =============================================================================

const VALID_MODES: GameMode[] = ["endless", "blitz"]
const VALID_INPUT_METHODS: InputMethod[] = ["voice", "keyboard"]

function isValidMode(mode: unknown): mode is GameMode {
  return typeof mode === "string" && VALID_MODES.includes(mode as GameMode)
}

function isValidInputMethod(inputMethod: unknown): inputMethod is InputMethod {
  return typeof inputMethod === "string" && VALID_INPUT_METHODS.includes(inputMethod as InputMethod)
}

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/games/history
 *
 * Get user's game history for a specific track.
 */
export async function GET(request: Request) {
  try {
    // Require authentication
    const { user, db } = await requireAuth()

    // Parse query params
    const url = new URL(request.url)
    const mode = url.searchParams.get("mode")
    const inputMethod = url.searchParams.get("inputMethod")
    const limitParam = url.searchParams.get("limit")
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    // Validate params
    if (!isValidMode(mode)) {
      throw Errors.invalidInput("mode", "Must be 'endless' or 'blitz'", VALID_MODES, mode)
    }

    if (!isValidInputMethod(inputMethod)) {
      throw Errors.invalidInput("inputMethod", "Must be 'voice' or 'keyboard'", VALID_INPUT_METHODS, inputMethod)
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw Errors.invalidInput("limit", "Must be between 1 and 100", "1-100", limit)
    }

    // Fetch game history and stats in parallel
    const [games, stats] = await Promise.all([
      getGameHistory(db, user.id, mode, inputMethod, limit),
      getGameStats(db, user.id, mode, inputMethod),
    ])

    return NextResponse.json({ games, stats })
  } catch (error) {
    return handleApiError(error, "[GetGameHistory]")
  }
}
