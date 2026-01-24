/**
 * Next.js Middleware — PlayLexi
 *
 * Handles authentication-based routing:
 * 1. Protects authenticated routes — redirects to /login if not signed in
 * 2. Redirects authenticated users away from /login
 * 3. Routes new users through onboarding flow
 *
 * ## Onboarding Flow (New Users)
 *
 * New users go through this flow:
 * 1. Tutorial → Placement → Rank Result (PUBLIC - before OAuth)
 * 2. OAuth Sign Up (creates Better Auth session)
 * 3. Profile Completion (PROTECTED - after OAuth)
 * 4. Dashboard
 *
 * ## Route Groups & Protection
 *
 * | Route | Auth Required | Purpose |
 * |-------|---------------|---------|
 * | /login | No | Sign in page |
 * | /onboarding/tutorial | No | Pre-auth onboarding |
 * | /onboarding/placement | No | Pre-auth onboarding |
 * | /onboarding/rank-result | No | Pre-auth onboarding (has OAuth buttons) |
 * | /onboarding/profile | Yes | Post-auth profile completion |
 * | /game/* | Yes | Gameplay |
 * | / | Yes | Dashboard |
 *
 * ## Session Detection
 *
 * Better Auth stores the session token in a cookie named `better-auth.session_token`.
 * We check for this cookie's presence as a quick auth check.
 *
 * Note: This is a lightweight check. Full session validation happens server-side
 * in API routes and server components.
 *
 * @see app/(shell)/layout.tsx for full navigation shell
 * @see app/(focused)/layout.tsx for focused experience layout
 * @see lib/auth/index.ts for Better Auth configuration
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Routes that don't require authentication.
 * These patterns are matched using startsWith().
 */
const PUBLIC_ROUTES = [
  "/login",
  "/api/",
  "/_next/",
  "/favicon.ico",
  "/showcase",
  // Pre-auth onboarding (before OAuth)
  "/onboarding/tutorial",
  "/onboarding/placement",
  "/onboarding/rank-result",
]

/**
 * Routes that require authentication but are part of onboarding.
 * Users must be logged in but may not have completed profile setup.
 *
 * Note: Tutorial, placement, and rank-result are PUBLIC (in PUBLIC_ROUTES above)
 * because users complete those BEFORE signing in with OAuth.
 */
const ONBOARDING_ROUTES = [
  "/onboarding/profile",  // Only profile requires auth (post-OAuth)
]

/**
 * The session cookie name used by Better Auth.
 */
const SESSION_COOKIE_NAME = "better-auth.session_token"

// =============================================================================
// MIDDLEWARE
// =============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if user has a session cookie (lightweight auth check)
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)
  const isAuthenticated = !!sessionToken

  // ---------------------------
  // 1. Allow public routes
  // ---------------------------
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  if (isPublicRoute) {
    // Special case: redirect authenticated users away from /login
    if (pathname === "/login" && isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  // ---------------------------
  // 2. Allow onboarding routes (for authenticated users)
  // ---------------------------
  const isOnboardingRoute = ONBOARDING_ROUTES.some((route) => pathname.startsWith(route))
  if (isOnboardingRoute) {
    // Must be authenticated to access onboarding
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return NextResponse.next()
  }

  // ---------------------------
  // 3. Protect all other routes
  // ---------------------------
  if (!isAuthenticated) {
    // Store the original URL to redirect back after login
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // User is authenticated, allow access
  return NextResponse.next()
}

// =============================================================================
// MATCHER CONFIGURATION
// =============================================================================

/**
 * Configure which routes the middleware runs on.
 *
 * We exclude:
 * - Static files (images, fonts, etc.)
 * - API routes starting with /api/auth (Better Auth handles these)
 *
 * This improves performance by not running middleware on every request.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, audio, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg|m4a)$).*)",
  ],
}
