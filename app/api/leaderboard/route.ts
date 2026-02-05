/**
 * Leaderboard API Route — PlayLexi
 *
 * Fetches ranked player listings for leaderboard display.
 *
 * ## Endpoints
 *
 * GET /api/leaderboard
 * - Query params:
 *   - mode: "endless" | "blitz" (required)
 *   - inputMethod: "voice" | "keyboard" (required)
 *   - page: number (optional, default: 1)
 *   - limit: number (optional, default: 20, max: 100)
 *   - search: string (optional, username search filter)
 * - Returns: LeaderboardResponse
 * - Status: 200 (success), 400 (invalid params)
 *
 * ## Authentication
 *
 * This endpoint works for both authenticated and unauthenticated users:
 * - Unauthenticated: Returns leaderboard without current user position
 * - Authenticated: Includes current user's position and highlights their entry
 *
 * @see lib/services/leaderboard-service.ts for business logic
 */

import { NextResponse } from "next/server"
import { handleApiError, Errors, optionalAuth } from "@/lib/api"
import { getLeaderboard, getUserLeaderboardRank } from "@/lib/services/leaderboard-service"
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
 * GET /api/leaderboard
 *
 * Get ranked player list for a specific track.
 */
export async function GET(request: Request) {
  try {
    // Get database and optionally authenticated user
    const { user, db } = await optionalAuth()
    const currentUserId = user?.id

    // Parse query params
    const url = new URL(request.url)
    const mode = url.searchParams.get("mode")
    const inputMethod = url.searchParams.get("inputMethod")
    const pageParam = url.searchParams.get("page")
    const limitParam = url.searchParams.get("limit")
    const search = url.searchParams.get("search") || undefined

    const page = pageParam ? parseInt(pageParam, 10) : 1
    const limit = limitParam ? parseInt(limitParam, 10) : 20

    // Validate required params
    if (!isValidMode(mode)) {
      throw Errors.invalidInput("mode", "Must be 'endless' or 'blitz'", VALID_MODES, mode)
    }

    if (!isValidInputMethod(inputMethod)) {
      throw Errors.invalidInput("inputMethod", "Must be 'voice' or 'keyboard'", VALID_INPUT_METHODS, inputMethod)
    }

    // Validate optional params
    if (isNaN(page) || page < 1) {
      throw Errors.invalidInput("page", "Must be a positive integer", ">=1", page)
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw Errors.invalidInput("limit", "Must be between 1 and 100", "1-100", limit)
    }

    // Fetch leaderboard data
    const leaderboard = await getLeaderboard(db, {
      mode,
      inputMethod,
      page,
      limit,
      search,
      currentUserId,
    })

    // If authenticated, also fetch user's rank header data
    let userRank = null
    if (currentUserId) {
      userRank = await getUserLeaderboardRank(db, currentUserId, mode, inputMethod)
    }

    return NextResponse.json({
      ...leaderboard,
      userRank,
    })
  } catch (error) {
    return handleApiError(error, "[GetLeaderboard]")
  }
}
