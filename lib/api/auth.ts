/**
 * API Authentication Middleware — PlayLexi
 *
 * Centralized authentication for API routes.
 * Eliminates duplicated auth code across all protected endpoints.
 *
 * ## Usage
 *
 * ```typescript
 * import { requireAuth, optionalAuth } from "@/lib/api/auth"
 *
 * // Require authentication (throws if not authenticated)
 * export async function POST(request: Request) {
 *   const { user, db } = await requireAuth()
 *   // user is guaranteed to exist
 * }
 *
 * // Optional authentication (returns null if not authenticated)
 * export async function GET(request: Request) {
 *   const { user, db } = await optionalAuth()
 *   if (user) {
 *     // Authenticated user
 *   } else {
 *     // Anonymous user
 *   }
 * }
 * ```
 *
 * ## Why Centralized Auth?
 *
 * Before: Each route had 10+ lines of duplicated auth code:
 * ```typescript
 * const { env } = await getCloudflareContext({ async: true })
 * const auth = createAuth(env.DB)
 * const requestHeaders = await headers()
 * const session = await auth.api.getSession({ headers: requestHeaders })
 * if (!session?.user) {
 *   return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
 * }
 * ```
 *
 * After: Single line that handles everything:
 * ```typescript
 * const { user, db } = await requireAuth()
 * ```
 *
 * @see lib/api/errors.ts for error handling
 */

import { headers } from "next/headers"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createAuth } from "@/lib/auth"
import { AppError, ErrorCode } from "./errors"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Authenticated user from Better Auth session.
 */
export interface AuthUser {
  id: string
  email: string
  name?: string
  image?: string
}

/**
 * Result of successful authentication.
 */
export interface AuthResult {
  /** The authenticated user */
  user: AuthUser
  /** Database connection */
  db: D1Database
}

/**
 * Result of optional authentication.
 */
export interface OptionalAuthResult {
  /** The authenticated user, or null if not authenticated */
  user: AuthUser | null
  /** Database connection */
  db: D1Database
}

// =============================================================================
// MIDDLEWARE FUNCTIONS
// =============================================================================

/**
 * Require authentication for an API route.
 *
 * Use this at the start of any protected endpoint. It will:
 * 1. Get the Cloudflare context (database binding)
 * 2. Verify the user's session
 * 3. Throw an AppError if not authenticated
 * 4. Return the user and database if authenticated
 *
 * @throws {AppError} With code UNAUTHORIZED if not authenticated
 * @returns The authenticated user and database connection
 *
 * @example
 * ```typescript
 * export async function POST(request: Request) {
 *   try {
 *     const { user, db } = await requireAuth()
 *
 *     // user.id is the authenticated user's ID
 *     const result = await createGame(db, { userId: user.id, ... })
 *
 *     return NextResponse.json(result, { status: 201 })
 *   } catch (error) {
 *     return handleApiError(error, "[CreateGame]")
 *   }
 * }
 * ```
 */
export async function requireAuth(): Promise<AuthResult> {
  // Get Cloudflare context (includes D1 database binding)
  const { env } = await getCloudflareContext({ async: true })

  // Get request headers for session lookup
  const requestHeaders = await headers()

  // Create auth instance and get session
  // Note: disableCookieCache forces DB lookup, avoiding Better Auth 1.4.x cookie cache issues
  const auth = createAuth(env.DB)
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  })

  // Check authentication
  if (!session?.user) {
    throw new AppError("Not authenticated", ErrorCode.UNAUTHORIZED)
  }

  return {
    user: session.user as AuthUser,
    db: env.DB,
  }
}

/**
 * Optional authentication for an API route.
 *
 * Use this for endpoints that work differently for authenticated
 * vs anonymous users. Does NOT throw if not authenticated.
 *
 * @returns The user (or null) and database connection
 *
 * @example
 * ```typescript
 * export async function GET(request: Request) {
 *   try {
 *     const { user, db } = await optionalAuth()
 *
 *     if (user) {
 *       // Return personalized data
 *       return NextResponse.json(await getUserWords(db, user.id))
 *     } else {
 *       // Return generic data
 *       return NextResponse.json(await getPublicWords(db))
 *     }
 *   } catch (error) {
 *     return handleApiError(error, "[GetWords]")
 *   }
 * }
 * ```
 */
export async function optionalAuth(): Promise<OptionalAuthResult> {
  // Get Cloudflare context
  const { env } = await getCloudflareContext({ async: true })

  // Get request headers
  const requestHeaders = await headers()

  // Create auth instance and get session
  // Note: disableCookieCache forces DB lookup, avoiding Better Auth 1.4.x cookie cache issues
  const auth = createAuth(env.DB)
  const session = await auth.api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  })

  return {
    user: session?.user ? (session.user as AuthUser) : null,
    db: env.DB,
  }
}

/**
 * Get database connection without authentication check.
 *
 * Use this for public endpoints that don't need user context.
 *
 * @returns Database connection
 *
 * @example
 * ```typescript
 * export async function GET(request: Request) {
 *   try {
 *     const db = await getDatabase()
 *     const words = await getPublicWords(db)
 *     return NextResponse.json(words)
 *   } catch (error) {
 *     return handleApiError(error, "[GetPublicWords]")
 *   }
 * }
 * ```
 */
export async function getDatabase(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true })
  return env.DB
}
