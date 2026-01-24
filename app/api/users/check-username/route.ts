/**
 * Username Availability Check API
 *
 * GET /api/users/check-username?username=cool_bee
 *
 * Checks if a username is available for registration.
 * Performs both format validation and uniqueness check.
 *
 * ## Rate Limiting Consideration
 *
 * This endpoint is called on every keystroke (debounced) during
 * profile creation. Consider adding rate limiting in production
 * via Cloudflare or middleware.
 *
 * ## Response
 *
 * Success (200):
 * ```json
 * {
 *   "available": true,
 *   "username": "cool_bee"
 * }
 * ```
 *
 * Taken (200):
 * ```json
 * {
 *   "available": false,
 *   "username": "cool_bee",
 *   "reason": "taken"
 * }
 * ```
 *
 * Invalid format (400):
 * ```json
 * {
 *   "available": false,
 *   "username": "ab",
 *   "reason": "invalid",
 *   "error": "Username must be at least 3 characters"
 * }
 * ```
 *
 * @see lib/username-utils.ts for format validation
 * @see lib/services/user-service.ts for database check
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { validateUsernameFormat, sanitizeUsername } from "@/lib/username-utils"
import { isUsernameAvailable } from "@/lib/services/user-service"

// =============================================================================
// CLOUDFLARE ENV AUGMENTATION
// =============================================================================

declare global {
  interface CloudflareEnv {
    DB: D1Database
  }
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface AvailableResponse {
  available: true
  username: string
}

interface TakenResponse {
  available: false
  username: string
  reason: "taken"
}

interface InvalidResponse {
  available: false
  username: string
  reason: "invalid"
  error: string
}

interface ErrorResponse {
  available: false
  error: string
}

type ApiResponse = AvailableResponse | TakenResponse | InvalidResponse | ErrorResponse

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * GET /api/users/check-username
 *
 * Check if a username is available.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const rawUsername = searchParams.get("username")

    // Validate presence
    if (!rawUsername) {
      return NextResponse.json(
        {
          available: false,
          error: "Missing 'username' query parameter",
        },
        { status: 400 }
      )
    }

    // Sanitize input
    const username = sanitizeUsername(rawUsername)

    // Validate format (client should do this too, but we double-check)
    const formatValidation = validateUsernameFormat(username)
    if (!formatValidation.isValid) {
      return NextResponse.json(
        {
          available: false,
          username,
          reason: "invalid",
          error: formatValidation.error ?? "Invalid username format",
        },
        { status: 400 }
      )
    }

    // Get D1 database binding
    const { env } = await getCloudflareContext({ async: true })

    // Check uniqueness (case-insensitive)
    const available = await isUsernameAvailable(env.DB, username)

    if (available) {
      return NextResponse.json({
        available: true,
        username,
      })
    } else {
      return NextResponse.json({
        available: false,
        username,
        reason: "taken",
      })
    }
  } catch (error) {
    // Log error for debugging
    console.error("[API] Error checking username:", error)

    // Return generic error
    return NextResponse.json(
      {
        available: false,
        error: "Internal server error. Please try again.",
      },
      { status: 500 }
    )
  }
}
