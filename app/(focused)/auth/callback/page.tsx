/**
 * Auth Callback Page — PlayLexi
 *
 * Handles post-OAuth routing based on user status.
 *
 * ## Flow
 * 1. User completes OAuth (Google/Apple)
 * 2. Better Auth redirects here (via callbackURL)
 * 3. We check if a PlayLexi user record exists
 * 4. Route accordingly:
 *    - User exists → Dashboard (/)
 *    - No user record → Profile completion (/onboarding/profile)
 *
 * ## Why a Dedicated Page?
 * - Better Auth's callbackURL is static per sign-in button
 * - We need dynamic routing based on user status
 * - This page handles that logic server-side
 *
 * @see lib/services/user-service.ts for getUserStatus
 * @see docs/PRD.md Section 2.1 for user flows
 */

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createAuth } from "@/lib/auth"
import { getUserStatus } from "@/lib/services/user-service"

export default async function AuthCallbackPage() {
  // Get Cloudflare context and create auth instance
  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)

  // Get current session from Better Auth
  // Note: disableCookieCache forces DB lookup, avoiding Better Auth 1.4.x cookie cache issues
  const requestHeaders = await headers()
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  })

  // If no session, redirect to login
  if (!session?.user) {
    redirect("/login")
  }

  // Check if user has a PlayLexi profile
  const status = await getUserStatus(env.DB, session.user.id)

  if (status.exists) {
    // Returning user - go to dashboard with welcome back indicator
    // This allows the dashboard to show a "Welcome back!" message
    const username = status.user?.username || ""
    redirect(`/?welcome=back&user=${encodeURIComponent(username)}`)
  } else {
    // New user - needs profile completion
    // Note: Placement data should already be in sessionStorage from onboarding
    redirect("/onboarding/profile")
  }
}
