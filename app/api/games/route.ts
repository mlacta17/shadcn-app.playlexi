/**
 * Games API Route — PlayLexi
 *
 * Handles game session creation.
 *
 * ## Endpoints
 *
 * POST /api/games
 * - Creates a new game session
 * - Body: { mode: "endless" | "blitz", inputMethod: "voice" | "keyboard" }
 * - Returns: { gameId, gamePlayerId }
 * - Status: 201 (created), 401 (not authenticated), 400 (invalid input)
 *
 * @see lib/services/game-service.ts for business logic
 */

import { NextResponse } from "next/server"
import { requireAuth, handleApiError, Errors } from "@/lib/api"
import { createGame } from "@/lib/services/game-service"
import { getUserStatus } from "@/lib/services/user-service"
import type { GameMode, InputMethod } from "@/db/schema"

// =============================================================================
// TYPES
// =============================================================================

interface CreateGameRequest {
  mode: GameMode
  inputMethod: InputMethod
}

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
 * POST /api/games
 *
 * Create a new game session.
 */
export async function POST(request: Request) {
  try {
    // Require authentication
    const { user, db } = await requireAuth()

    // Pre-flight check: Ensure user has a PlayLexi profile
    // Games require user_ranks records which are created during profile completion
    const userStatus = await getUserStatus(db, user.id)
    if (!userStatus.exists) {
      console.warn("[CreateGame] User has no PlayLexi profile:", user.id)
      throw Errors.validation(
        "Profile incomplete. Please complete onboarding first.",
        { needsProfile: true, redirectTo: "/onboarding/profile" }
      )
    }

    // Parse and validate request body
    const body = await request.json() as CreateGameRequest

    if (!isValidMode(body.mode)) {
      throw Errors.invalidInput("mode", "Must be 'endless' or 'blitz'", VALID_MODES, body.mode)
    }

    if (!isValidInputMethod(body.inputMethod)) {
      throw Errors.invalidInput("inputMethod", "Must be 'voice' or 'keyboard'", VALID_INPUT_METHODS, body.inputMethod)
    }

    // Create game session
    const result = await createGame(db, {
      userId: user.id,
      mode: body.mode,
      inputMethod: body.inputMethod,
      type: "single", // Single-player for now
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleApiError(error, "[CreateGame]")
  }
}
