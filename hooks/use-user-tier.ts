/**
 * useUserTier Hook — PlayLexi
 *
 * Fetches the user's skill rating (derivedTier) for a specific track.
 * Used by game pages to select appropriate word difficulty.
 *
 * ## Usage
 * ```tsx
 * const { tier, isLoading } = useUserTier("endless_voice")
 * // tier is 1-7 based on user's skill rating, or 1 if not logged in
 * ```
 *
 * ## Track Format
 * Tracks are: "endless_voice" | "endless_keyboard" | "blitz_voice" | "blitz_keyboard"
 * Built from: `${mode}_${inputMethod}`
 *
 * @see lib/word-service.ts for WordTier type (1-7)
 * @see db/schema.ts for RankTrack type
 */

import * as React from "react"
import type { WordTier } from "@/lib/word-service"
import type { RankTrack } from "@/db/schema"
import type { GameMode, InputMethod } from "@/db/schema"

interface UserSkillRating {
  track: string
  derivedTier: number
}

interface UserMeResponse {
  skillRatings?: UserSkillRating[]
}

interface UseUserTierReturn {
  /** User's tier for the specified track (1-7) */
  tier: WordTier
  /** Whether the tier is still being fetched */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
}

/**
 * Get the user's skill tier for a specific game track.
 *
 * @param track - The rank track (e.g., "endless_voice", "blitz_keyboard")
 * @returns Tier (1-7), loading state, and any error
 */
export function useUserTier(track: RankTrack): UseUserTierReturn {
  const [tier, setTier] = React.useState<WordTier>(1)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function fetchTier() {
      try {
        const response = await fetch("/api/users/me")

        if (!response.ok) {
          // User might not be logged in - use default tier 1
          if (response.status === 401 || response.status === 404) {
            if (!cancelled) {
              setTier(1)
              setIsLoading(false)
            }
            return
          }
          throw new Error("Failed to fetch user data")
        }

        const data = (await response.json()) as UserMeResponse

        if (!cancelled) {
          // Find the skill rating for this track
          const trackRating = data.skillRatings?.find(
            (rating) => rating.track === track
          )

          if (trackRating?.derivedTier) {
            // Clamp to valid WordTier range (1-7)
            const clampedTier = Math.max(1, Math.min(7, trackRating.derivedTier)) as WordTier
            setTier(clampedTier)
          } else {
            // No rating found, use default
            setTier(1)
          }
          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useUserTier] Error fetching tier:", err)
          setError(err instanceof Error ? err.message : "Unknown error")
          setTier(1) // Fall back to tier 1 on error
          setIsLoading(false)
        }
      }
    }

    fetchTier()

    return () => {
      cancelled = true
    }
  }, [track])

  return { tier, isLoading, error }
}

/**
 * Build a RankTrack from game mode and input method.
 * Helper for game pages that have separate mode/inputMethod values.
 *
 * @param mode - "endless" or "blitz"
 * @param inputMethod - "voice" or "keyboard"
 * @returns RankTrack string
 */
export function buildTrack(mode: GameMode, inputMethod: InputMethod): RankTrack {
  return `${mode}_${inputMethod}` as RankTrack
}
