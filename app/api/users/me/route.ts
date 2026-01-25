/**
 * Current User API Route — PlayLexi
 *
 * Returns the current user's PlayLexi profile data.
 * Used by the navbar and other components that need user-specific data.
 *
 * ## Response
 * - 200: User profile (username, avatarId, etc.)
 * - 401: Not authenticated
 * - 404: Authenticated but no PlayLexi profile (new user)
 *
 * @see lib/services/user-service.ts for getUserById
 */

import { NextResponse } from "next/server"
import { requireAuth, handleApiError, AppError, ErrorCode } from "@/lib/api"
import { getUserById } from "@/lib/services/user-service"

export async function GET() {
  try {
    // Require authentication
    const { user, db } = await requireAuth()

    // Get PlayLexi user profile
    const profile = await getUserById(db, user.id)

    if (!profile) {
      // Special case: authenticated but no profile yet (new user)
      throw new AppError(
        "Profile not found",
        ErrorCode.NOT_FOUND,
        { needsProfile: true }
      )
    }

    // Return user profile data needed by client
    return NextResponse.json({
      id: profile.id,
      username: profile.username,
      email: profile.email,
      avatarId: profile.avatarId,
      bio: profile.bio,
      createdAt: profile.createdAt,
      // Include ranks for leaderboard display (XP-based)
      ranks: profile.ranks,
      // Include skill ratings for game difficulty matching (Glicko-2)
      skillRatings: profile.skillRatings,
    })
  } catch (error) {
    return handleApiError(error, "[GetCurrentUser]")
  }
}
