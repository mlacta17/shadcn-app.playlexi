/**
 * Better Auth Client — PlayLexi
 *
 * This module provides the client-side auth utilities for React components.
 * Use these hooks and functions to:
 * - Check if user is logged in
 * - Get current user data
 * - Trigger sign in/out flows
 *
 * ## Usage
 *
 * ```tsx
 * import { useSession, signIn, signOut } from "@/lib/auth/client"
 *
 * function LoginButton() {
 *   const { data: session, isPending } = useSession()
 *
 *   if (isPending) return <div>Loading...</div>
 *
 *   if (session) {
 *     return (
 *       <div>
 *         <span>Welcome, {session.user.name}</span>
 *         <button onClick={() => signOut()}>Sign Out</button>
 *       </div>
 *     )
 *   }
 *
 *   return (
 *     <button onClick={() => signIn.social({ provider: "google" })}>
 *       Sign in with Google
 *     </button>
 *   )
 * }
 * ```
 *
 * @see lib/auth/index.ts for server-side auth
 */

import { createAuthClient } from "better-auth/react"

// =============================================================================
// AUTH CLIENT INSTANCE
// =============================================================================

/**
 * Better Auth client configured for PlayLexi.
 *
 * The baseURL should match BETTER_AUTH_URL in your environment.
 * In production, this would be your deployed domain.
 */
const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
})

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * React hook to get the current session.
 *
 * Returns { data, isPending, error } where data contains the session
 * if the user is logged in, or null if not.
 *
 * @example
 * ```tsx
 * const { data: session, isPending } = useSession()
 *
 * if (isPending) return <Spinner />
 * if (!session) return <LoginButton />
 * return <div>Hello, {session.user.name}</div>
 * ```
 */
export const useSession = authClient.useSession

/**
 * Sign in with an OAuth provider.
 *
 * @example
 * ```tsx
 * // Sign in with Google
 * await signIn.social({
 *   provider: "google",
 *   callbackURL: "/game/endless"
 * })
 * ```
 */
export const signIn = authClient.signIn

/**
 * Sign out the current user.
 *
 * @example
 * ```tsx
 * await signOut()
 * // User is now logged out
 * ```
 */
export const signOut = authClient.signOut

/**
 * Get the current session on the server side.
 * Use this in Server Components or API routes.
 */
export const getSession = authClient.getSession

/**
 * The raw auth client for advanced use cases.
 */
export { authClient }
