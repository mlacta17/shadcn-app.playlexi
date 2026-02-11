/**
 * Better Auth Server Configuration — PlayLexi
 *
 * This module configures Better Auth for server-side authentication.
 * It handles Google OAuth login, session management, and database persistence.
 *
 * ## Architecture Notes
 *
 * Better Auth creates its own tables (user, session, account, verification) that are
 * separate from our existing `users` table. After authentication, we create/link
 * PlayLexi user records to Better Auth accounts.
 *
 * ## Environment Variables Required
 *
 * - GOOGLE_CLIENT_ID: OAuth client ID from Google Cloud Console
 * - GOOGLE_CLIENT_SECRET: OAuth client secret
 * - BETTER_AUTH_SECRET: 32+ char random string for session encryption
 * - BETTER_AUTH_URL: Base URL (http://localhost:3000 in dev)
 *
 * @see https://www.better-auth.com/docs
 */

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import type { D1Database } from "@cloudflare/workers-types"
import { drizzle } from "drizzle-orm/d1"
import * as authSchema from "./schema"

// =============================================================================
// AUTH FACTORY
// =============================================================================

/**
 * Create a Better Auth instance with D1 database.
 *
 * This is called per-request because Cloudflare D1 bindings are request-scoped.
 * The auth instance handles:
 * - Google OAuth flow
 * - Session creation/validation
 * - Token refresh
 *
 * @param d1 - The D1 database binding from Cloudflare context
 * @returns Configured Better Auth instance
 *
 * @example
 * ```typescript
 * // In API route
 * import { getCloudflareContext } from "@opennextjs/cloudflare"
 * import { createAuth } from "@/lib/auth"
 *
 * export async function GET(request: Request) {
 *   const { env } = await getCloudflareContext({ async: true })
 *   const auth = createAuth(env.DB)
 *   const session = await auth.api.getSession({ headers: request.headers })
 * }
 * ```
 */
export function createAuth(d1: D1Database) {
  const db = drizzle(d1, { schema: authSchema })

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),

    // Email and password disabled - OAuth only
    emailAndPassword: {
      enabled: false,
    },

    // OAuth providers
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    },

    // Session configuration
    session: {
      // 7 days session duration
      expiresIn: 60 * 60 * 24 * 7,
      // Refresh session if more than 1 day old
      updateAge: 60 * 60 * 24,
      // Cookie cache disabled - caused issues with Better Auth 1.4.x encrypted strategy
      // Sessions are looked up from D1 database on each request
      // This is fine for our use case since D1 queries are fast
      cookieCache: {
        enabled: false,
      },
    },

    // Advanced cookie configuration for production
    advanced: {
      // Use secure cookies in production (required for HTTPS)
      useSecureCookies: process.env.NODE_ENV === "production",
      // Cross-site cookie settings
      crossSubDomainCookies: {
        enabled: false, // app.playlexi.com only, not *.playlexi.com
      },
    },

    // Base URL for OAuth callbacks
    baseURL: process.env.BETTER_AUTH_URL,

    // Secret for signing tokens
    secret: process.env.BETTER_AUTH_SECRET,

    // Trust proxy headers (for Cloudflare)
    trustedOrigins: [
      process.env.BETTER_AUTH_URL || "http://localhost:3000",
    ],
  })
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Auth instance type for function parameters.
 */
export type Auth = ReturnType<typeof createAuth>

/**
 * Session type from Better Auth.
 * Contains user info and session metadata.
 */
export type Session = Awaited<ReturnType<Auth["api"]["getSession"]>>
