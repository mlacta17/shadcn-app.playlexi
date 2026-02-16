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
 * 1. See dashboard → Tap a game → Tutorial (first time only)
 * 2. Sign up via OAuth (creates Better Auth session)
 * 3. Profile Completion (username + avatar, PROTECTED)
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
 * | /game/daily* | No | Daily game (anonymous play) |
 * | /game/* | Yes | Other gameplay |
 * | / | No | Dashboard (public landing) |
 *
 * ## Session Detection
 *
 * Better Auth stores the session token in a cookie. The cookie name depends
 * on the environment:
 * - Development: `better-auth.session_token`
 * - Production:  `__Secure-better-auth.session_token` (useSecureCookies adds prefix)
 *
 * We check for both cookie names as a quick auth check.
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
 * Routes that don't require authentication (prefix match via startsWith).
 */
const PUBLIC_ROUTES = [
  "/login",
  "/api/",
  "/_next/",
  "/favicon.ico",
  "/showcase",
  // OAuth callback — this page handles its own session check and redirects
  // to /login if no session exists. Must be public so the middleware doesn't
  // block the first request after OAuth (before the cookie is fully available).
  "/auth/callback",
  // Pre-auth onboarding (before OAuth)
  "/onboarding/tutorial",
  "/onboarding/placement",
  "/onboarding/rank-result",
  // Daily game is playable without an account (anonymous via localStorage)
  "/game/daily",
]

/**
 * Routes that don't require authentication (exact match).
 * These use === instead of startsWith() to avoid matching sub-routes.
 */
const PUBLIC_EXACT_ROUTES = [
  "/",            // Dashboard is the public landing page
  "/leaderboard", // Leaderboard is viewable by everyone
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
 *
 * When useSecureCookies is enabled (production), Better Auth prefixes all
 * cookie names with "__Secure-". We must check for both names so the
 * middleware works correctly in all environments.
 *
 * @see lib/auth/index.ts — useSecureCookies is true when NODE_ENV === "production"
 * @see https://www.better-auth.com/docs/concepts/cookies
 */
const SESSION_COOKIE_NAME = "better-auth.session_token"
const SECURE_SESSION_COOKIE_NAME = "__Secure-better-auth.session_token"

// =============================================================================
// MIDDLEWARE
// =============================================================================

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if user has a session cookie (lightweight auth check)
  // Better Auth uses "__Secure-" prefix in production, so check both names
  const sessionToken =
    request.cookies.get(SECURE_SESSION_COOKIE_NAME) ||
    request.cookies.get(SESSION_COOKIE_NAME)
  const isAuthenticated = !!sessionToken

  // ---------------------------
  // 1. Allow public routes
  // ---------------------------
  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    PUBLIC_EXACT_ROUTES.some((route) => pathname === route)
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
