/**
 * Better Auth API Routes — PlayLexi
 *
 * This catch-all route handles all authentication endpoints:
 * - GET/POST /api/auth/signin/google — Start Google OAuth flow
 * - GET /api/auth/callback/google — OAuth callback
 * - GET /api/auth/session — Get current session
 * - POST /api/auth/signout — Sign out
 *
 * Better Auth handles all the OAuth complexity internally.
 * We just need to forward requests to the auth handler.
 *
 * @see lib/auth/index.ts for auth configuration
 */

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createAuth } from "@/lib/auth"

// Extend CloudflareEnv for TypeScript
declare global {
  interface CloudflareEnv {
    DB: D1Database
  }
}

/**
 * Handle all auth GET requests.
 * - /api/auth/session — Get current session
 * - /api/auth/callback/* — OAuth callbacks
 */
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)
  return auth.handler(request)
}

/**
 * Handle all auth POST requests.
 * - /api/auth/signin/* — Start OAuth flow
 * - /api/auth/signout — Sign out
 */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true })
  const auth = createAuth(env.DB)
  return auth.handler(request)
}
