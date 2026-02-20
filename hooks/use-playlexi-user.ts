/**
 * PlayLexi User Hook
 *
 * Fetches and caches the current user's PlayLexi profile data.
 * Used by components that need PlayLexi-specific data (avatarId, username, etc.)
 * that isn't available in the Better Auth session.
 *
 * ## Why This Hook Exists
 *
 * Better Auth stores only OAuth data (name, email, image from Google).
 * PlayLexi has its own user table with additional fields:
 * - username (user-chosen, not Google name)
 * - avatarId (1=dog, 2=person, 3=cat)
 * - birthYear, ranks, etc.
 *
 * This hook bridges that gap by fetching PlayLexi user data separately.
 *
 * ## Usage
 *
 * ```tsx
 * const { user, isLoading, error, refetch } = usePlayLexiUser()
 *
 * if (isLoading) return <Skeleton />
 * if (!user) return <NeedsProfileCompletion />
 *
 * return <PlayerAvatar avatarId={user.avatarId} />
 * ```
 *
 * @see app/api/users/me/route.ts for the API endpoint
 */

"use client"

import * as React from "react"
import { useSession } from "@/lib/auth/client"

// =============================================================================
// TYPES
// =============================================================================

export interface PlayLexiUser {
  id: string
  username: string
  email: string
  avatarId: number
  bio: string | null
  createdAt: string
  ranks: Array<{
    track: string
    tier: string
    xp: number
    crownPoints: number
  }>
}

interface UsePlayLexiUserReturn {
  /** PlayLexi user data, null if not fetched or user has no profile */
  user: PlayLexiUser | null
  /** Whether the initial fetch is in progress */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Whether the user needs to complete their profile */
  needsProfile: boolean
  /** Refetch user data (call after profile completion) */
  refetch: () => Promise<void>
}

// =============================================================================
// HOOK
// =============================================================================

export function usePlayLexiUser(): UsePlayLexiUserReturn {
  const { data: session, isPending: isSessionPending } = useSession()

  const [user, setUser] = React.useState<PlayLexiUser | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [needsProfile, setNeedsProfile] = React.useState(false)

  /**
   * Initial fetch — shows loading skeleton while data loads.
   * Used on mount and when the session changes.
   */
  const fetchUser = React.useCallback(async () => {
    // Don't fetch if no session
    if (!session?.user) {
      setUser(null)
      setIsLoading(false)
      setNeedsProfile(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/users/me")

      if (response.status === 404) {
        // User has auth session but no PlayLexi profile
        const data = await response.json() as { needsProfile?: boolean }
        if (data.needsProfile) {
          setNeedsProfile(true)
          setUser(null)
        }
        return
      }

      if (!response.ok) {
        throw new Error("Failed to fetch user profile")
      }

      const data = await response.json() as PlayLexiUser
      setUser(data)
      setNeedsProfile(false)
    } catch (err) {
      console.error("[usePlayLexiUser] Error:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user])

  /**
   * Background refetch — silently updates user data without showing loading state.
   * Used after saves (e.g., avatar change in settings dialog) so the UI
   * updates in-place without unmounting components that depend on isLoading.
   */
  const refetch = React.useCallback(async () => {
    if (!session?.user) return

    try {
      const response = await fetch("/api/users/me")
      if (!response.ok) return
      const data = await response.json() as PlayLexiUser
      setUser(data)
    } catch {
      // Silent failure — don't disrupt UI for a background refresh
    }
  }, [session?.user])

  // Fetch user data when session changes
  React.useEffect(() => {
    // Wait for session to load first
    if (isSessionPending) return

    fetchUser()
  }, [session?.user, isSessionPending, fetchUser])

  return {
    user,
    isLoading: isSessionPending || isLoading,
    error,
    needsProfile,
    refetch,
  }
}
