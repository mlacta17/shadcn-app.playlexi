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
import { headers } from "next/headers"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createAuth } from "@/lib/auth"
import { getUserById } from "@/lib/services/user-service"

export async function GET() {
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

    // Get PlayLexi user profile
    const user = await getUserById(env.DB, session.user.id)

    if (!user) {
      return NextResponse.json(
        { error: "Profile not found", needsProfile: true },
        { status: 404 }
      )
    }

    // Return user profile data needed by client
    return NextResponse.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatarId: user.avatarId,
      bio: user.bio,
      createdAt: user.createdAt,
      // Include ranks if needed for leaderboard display
      ranks: user.ranks,
    })
  } catch (error) {
    console.error("[GetCurrentUser] Error:", error)
    return NextResponse.json(
      { error: "Failed to get user profile" },
      { status: 500 }
    )
  }
}
