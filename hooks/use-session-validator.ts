"use client"

import * as React from "react"
import { useSession } from "@/lib/auth/client"

/**
 * Session validation result.
 */
interface SessionValidationResult {
  /** Whether the session is valid and active */
  isValid: boolean
  /** Error message if validation failed */
  error?: string
  /** Whether validation is in progress */
  isValidating: boolean
}

/**
 * Hook for proactive session validation.
 *
 * Better Auth uses cookie caching (5 minutes by default), which means the client-side
 * session data can become stale. This hook provides a way to validate the session
 * against the server before critical operations.
 *
 * ## Why This Matters
 *
 * Scenario without validation:
 * 1. User logs in, session cached for 5 minutes
 * 2. User goes idle, session expires on server
 * 3. User starts playing a game (UI still shows logged in)
 * 4. Game ends, save fails with 401 (confusing!)
 *
 * Scenario with validation:
 * 1. User logs in, session cached
 * 2. User goes idle, session expires on server
 * 3. Before starting game, we validate session
 * 4. Validation fails, user is prompted to re-login BEFORE playing
 *
 * ## Usage
 *
 * ```tsx
 * const { validateSession, isValidating } = useSessionValidator()
 *
 * const handleStartGame = async () => {
 *   const result = await validateSession()
 *   if (!result.isValid) {
 *     // Show re-login prompt
 *     return
 *   }
 *   // Proceed with game
 * }
 * ```
 *
 * @see lib/auth/index.ts for session configuration
 */
export function useSessionValidator() {
  const { data: session, isPending } = useSession()
  const [isValidating, setIsValidating] = React.useState(false)

  /**
   * Validate the session against the server.
   *
   * This bypasses the cookie cache and makes a direct API call to verify
   * the session is still valid on the server.
   *
   * @returns Validation result with isValid flag
   */
  const validateSession = React.useCallback(async (): Promise<SessionValidationResult> => {
    // If session is pending, wait for it
    if (isPending) {
      return { isValid: false, isValidating: true, error: "Session loading..." }
    }

    // If no session in cache, definitely not valid
    if (!session?.user) {
      return { isValid: false, isValidating: false, error: "Not logged in" }
    }

    setIsValidating(true)

    try {
      // Make a lightweight API call to validate the session
      // The /api/users/me endpoint requires auth and returns user data
      const response = await fetch("/api/users/me", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        // Important: include credentials to send session cookie
        credentials: "include",
      })

      if (response.status === 401) {
        return {
          isValid: false,
          isValidating: false,
          error: "Session expired. Please sign in again.",
        }
      }

      if (!response.ok) {
        // Other errors (network, server issues)
        return {
          isValid: false,
          isValidating: false,
          error: `Server error (${response.status})`,
        }
      }

      // Session is valid
      return { isValid: true, isValidating: false }
    } catch (err) {
      // Network error
      return {
        isValid: false,
        isValidating: false,
        error: "Network error. Please check your connection.",
      }
    } finally {
      setIsValidating(false)
    }
  }, [session, isPending])

  /**
   * Check if the user appears to be logged in (based on cached session).
   * Note: This may be stale! Use validateSession() for accurate check.
   */
  const isLoggedIn = React.useMemo(() => {
    return !isPending && !!session?.user
  }, [session, isPending])

  return {
    /** Validate the session against the server */
    validateSession,
    /** Whether validation is in progress */
    isValidating,
    /** Whether the user appears logged in (may be stale) */
    isLoggedIn,
    /** The current session (may be stale) */
    session,
    /** Whether the session is loading */
    isSessionLoading: isPending,
  }
}
