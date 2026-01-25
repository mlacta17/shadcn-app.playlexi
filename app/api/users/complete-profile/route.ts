/**
 * Complete Profile API Route — PlayLexi
 *
 * Creates a PlayLexi user record after OAuth authentication and profile completion.
 * Called from the profile completion page after user enters username and selects avatar.
 *
 * ## Request Body
 * - username: string (required, validated for availability)
 * - birthYear: number (optional)
 * - avatarId: number (1, 2, or 3)
 * - placement: PlacementResult (optional, from placement test)
 *
 * ## Response
 * - 201: User created successfully
 * - 400: Validation error (username taken, invalid input)
 * - 401: Not authenticated
 * - 500: Server error
 *
 * @see lib/services/user-service.ts for createUser function
 */

import { NextResponse } from "next/server"
import { requireAuth, handleApiError, Errors } from "@/lib/api"
import {
  createUser,
  isUsernameAvailable,
  type PlacementResult,
} from "@/lib/services/user-service"
import { validateUsernameFormat } from "@/lib/username-utils"
import { isValidPlacementTier, GLICKO2_CONSTANTS } from "@/lib/game-constants"

// =============================================================================
// TYPES
// =============================================================================

interface CompleteProfileRequest {
  username: string
  birthYear?: number
  avatarId?: number
  placement?: PlacementResult
}

// =============================================================================
// POST HANDLER
// =============================================================================

export async function POST(request: Request) {
  try {
    // Require authentication
    const { user, db } = await requireAuth()

    // Parse request body
    const body = await request.json() as CompleteProfileRequest
    const { username, birthYear, avatarId, placement } = body

    // Validate username format
    const formatValidation = validateUsernameFormat(username)
    if (!formatValidation.isValid) {
      throw Errors.validation(formatValidation.error ?? "Invalid username format", {
        field: "username",
      })
    }

    // Check username availability
    const available = await isUsernameAvailable(db, username)
    if (!available) {
      throw Errors.conflict("Username", "username")
    }

    // Validate avatarId
    if (avatarId !== undefined && (avatarId < 1 || avatarId > 3)) {
      throw Errors.invalidInput("avatarId", "Must be 1, 2, or 3", [1, 2, 3], avatarId)
    }

    // Validate placement data (SECURITY: Prevent users from claiming any tier)
    let validatedPlacement: PlacementResult | undefined
    if (placement) {
      // Validate derivedTier is in valid range (1-7)
      if (!isValidPlacementTier(placement.derivedTier)) {
        throw Errors.validation("Invalid placement tier", {
          field: "placement.derivedTier",
          expected: "integer between 1 and 7",
          received: placement.derivedTier,
        })
      }

      // Validate rating is within reasonable bounds
      const minRating = GLICKO2_CONSTANTS.TIER_RATING_RANGES[1].min
      const maxRating = GLICKO2_CONSTANTS.TIER_RATING_RANGES[7].min + 200 // Slightly above tier 7 min
      if (
        typeof placement.rating !== "number" ||
        placement.rating < minRating ||
        placement.rating > maxRating
      ) {
        throw Errors.validation("Invalid placement rating", {
          field: "placement.rating",
          expected: `number between ${minRating} and ${maxRating}`,
          received: placement.rating,
        })
      }

      // Validate rating deviation is within bounds
      if (
        typeof placement.ratingDeviation !== "number" ||
        placement.ratingDeviation < GLICKO2_CONSTANTS.MIN_RD ||
        placement.ratingDeviation > GLICKO2_CONSTANTS.INITIAL_RD
      ) {
        throw Errors.validation("Invalid placement rating deviation", {
          field: "placement.ratingDeviation",
          expected: `number between ${GLICKO2_CONSTANTS.MIN_RD} and ${GLICKO2_CONSTANTS.INITIAL_RD}`,
          received: placement.ratingDeviation,
        })
      }

      // Verify tier matches rating (prevent tier/rating mismatch cheating)
      // Allow some tolerance since tier is derived from rating
      const expectedTierRange = GLICKO2_CONSTANTS.TIER_RATING_RANGES[
        placement.derivedTier as keyof typeof GLICKO2_CONSTANTS.TIER_RATING_RANGES
      ]
      if (
        placement.rating < expectedTierRange.min - 50 ||
        placement.rating > (expectedTierRange.max === Infinity ? 2100 : expectedTierRange.max) + 50
      ) {
        console.warn(
          `[CompleteProfile] Tier/rating mismatch: tier=${placement.derivedTier}, rating=${placement.rating}. Using defaults.`
        )
        // Don't throw - just ignore suspect placement data
        validatedPlacement = undefined
      } else {
        validatedPlacement = placement
      }
    }

    // Create the PlayLexi user (using validated placement or undefined)
    const newUser = await createUser(
      db,
      {
        authUserId: user.id,
        email: user.email,
        username: username.trim(),
        birthYear,
        authProvider: "google", // TODO: Detect from session when Apple is added
        avatarId: avatarId ?? 1,
      },
      validatedPlacement
    )

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          avatarId: newUser.avatarId,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return handleApiError(Errors.conflict("Username", "username"), "[CompleteProfile]")
    }

    return handleApiError(error, "[CompleteProfile]")
  }
}
