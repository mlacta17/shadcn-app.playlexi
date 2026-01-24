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
import { headers } from "next/headers"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createAuth } from "@/lib/auth"
import {
  createUser,
  isUsernameAvailable,
  type PlacementResult,
} from "@/lib/services/user-service"
import { validateUsernameFormat } from "@/lib/username-utils"

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
    // Get Cloudflare context
    const { env } = await getCloudflareContext({ async: true })

    // Verify authentication
    const auth = createAuth(env.DB)
    const requestHeaders = await headers()
    const session = await auth.api.getSession({ headers: requestHeaders })

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json() as CompleteProfileRequest
    const { username, birthYear, avatarId, placement } = body

    // Validate username format
    const formatValidation = validateUsernameFormat(username)
    if (!formatValidation.isValid) {
      return NextResponse.json(
        { error: formatValidation.error ?? "Invalid username format" },
        { status: 400 }
      )
    }

    // Check username availability
    const available = await isUsernameAvailable(env.DB, username)
    if (!available) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      )
    }

    // Validate avatarId
    if (avatarId !== undefined && (avatarId < 1 || avatarId > 3)) {
      return NextResponse.json(
        { error: "Invalid avatar ID (must be 1, 2, or 3)" },
        { status: 400 }
      )
    }

    // Create the PlayLexi user
    const user = await createUser(
      env.DB,
      {
        authUserId: session.user.id,
        email: session.user.email,
        username: username.trim(),
        birthYear,
        authProvider: "google", // TODO: Detect from session when Apple is added
        avatarId: avatarId ?? 1,
      },
      placement
    )

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          avatarId: user.avatarId,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[CompleteProfile] Error:", error)

    // Handle unique constraint violation (race condition)
    if (error instanceof Error && error.message.includes("UNIQUE")) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create user profile" },
      { status: 500 }
    )
  }
}
