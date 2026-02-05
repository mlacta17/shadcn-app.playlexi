"use client"

/**
 * Leaderboard Hook — PlayLexi
 *
 * Fetches and manages leaderboard data with pagination, search, and filtering.
 * Handles both authenticated and unauthenticated users.
 *
 * ## Features
 *
 * - Automatic refetch on mode/inputMethod/page changes
 * - Current user position tracking (when authenticated)
 * - Search filtering with debounce
 * - Pagination state management
 *
 * ## Usage
 *
 * ```tsx
 * const {
 *   players,
 *   isLoading,
 *   currentUser,
 *   userRank,
 *   page,
 *   totalPages,
 *   setPage,
 *   setSearch,
 * } = useLeaderboard({
 *   mode: "endless",
 *   inputMethod: "voice",
 * })
 * ```
 *
 * @see lib/services/leaderboard-service.ts for backend logic
 * @see app/api/leaderboard/route.ts for API endpoint
 */

import * as React from "react"
import type { GameMode, InputMethod, RankTier } from "@/db/schema"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Player entry in the leaderboard.
 * Matches the LeaderboardPlayer interface from the UI components.
 */
export interface LeaderboardPlayer {
  id: string
  name: string
  description?: string
  /** PlayLexi avatar ID (1=dog, 2=person, 3=cat) */
  avatarId?: number
  round: number
  delta: number
  accuracy: number
  points: number
  rank: number
  tier: RankTier
  isCurrentUser?: boolean
}

/**
 * User's rank data for the header display.
 */
export interface UserRankData {
  tier: RankTier
  xp: number
  xpForNextTier: number
  position: number
  totalPlayers: number
}

/**
 * Options for the useLeaderboard hook.
 */
export interface UseLeaderboardOptions {
  /** Game mode to show */
  mode: GameMode
  /** Input method to show */
  inputMethod: InputMethod
  /** Results per page */
  pageSize?: number
}

/**
 * Return value from useLeaderboard hook.
 */
export interface UseLeaderboardReturn {
  /** List of players for current page */
  players: LeaderboardPlayer[]
  /** Whether data is loading */
  isLoading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Current page (1-indexed) */
  page: number
  /** Total pages available */
  totalPages: number
  /** Total player count on this track */
  totalPlayers: number
  /** Current user's position (if authenticated) */
  currentUserPosition: number | undefined
  /** Current user's entry (if authenticated) */
  currentUser: LeaderboardPlayer | undefined
  /** User's rank header data (if authenticated) */
  userRank: UserRankData | null
  /** Current search query */
  search: string
  /** Navigate to a specific page */
  setPage: (page: number) => void
  /** Update search query */
  setSearch: (search: string) => void
  /** Refetch data */
  refetch: () => Promise<void>
}

// =============================================================================
// API RESPONSE TYPE
// =============================================================================

interface LeaderboardApiResponse {
  players: LeaderboardPlayer[]
  totalPlayers: number
  page: number
  totalPages: number
  currentUserPosition?: number
  currentUser?: LeaderboardPlayer
  userRank: UserRankData | null
}

// =============================================================================
// HOOK
// =============================================================================

export function useLeaderboard(options: UseLeaderboardOptions): UseLeaderboardReturn {
  const { mode, inputMethod, pageSize = 20 } = options

  // State
  const [players, setPlayers] = React.useState<LeaderboardPlayer[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [totalPlayers, setTotalPlayers] = React.useState(0)
  const [currentUserPosition, setCurrentUserPosition] = React.useState<number | undefined>()
  const [currentUser, setCurrentUser] = React.useState<LeaderboardPlayer | undefined>()
  const [userRank, setUserRank] = React.useState<UserRankData | null>(null)
  const [search, setSearchState] = React.useState("")

  // Debounced search to avoid too many API calls
  const [debouncedSearch, setDebouncedSearch] = React.useState("")

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      // Reset to page 1 when search changes
      if (search !== debouncedSearch) {
        setPage(1)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, debouncedSearch])

  // Fetch leaderboard data
  const fetchLeaderboard = React.useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams({
        mode,
        inputMethod,
        page: String(page),
        limit: String(pageSize),
      })

      if (debouncedSearch) {
        params.set("search", debouncedSearch)
      }

      const response = await fetch(`/api/leaderboard?${params}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(errorData.error || `Failed to fetch leaderboard (${response.status})`)
      }

      const data = await response.json() as LeaderboardApiResponse

      setPlayers(data.players)
      setTotalPages(data.totalPages)
      setTotalPlayers(data.totalPlayers)
      setCurrentUserPosition(data.currentUserPosition)
      setCurrentUser(data.currentUser)
      setUserRank(data.userRank)
    } catch (err) {
      console.error("[useLeaderboard] Error:", err)
      setError(err instanceof Error ? err.message : "Unknown error")
      setPlayers([])
    } finally {
      setIsLoading(false)
    }
  }, [mode, inputMethod, page, pageSize, debouncedSearch])

  // Refetch when dependencies change
  React.useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Reset page when mode/inputMethod changes
  React.useEffect(() => {
    setPage(1)
  }, [mode, inputMethod])

  // Wrap setSearch to handle state
  const setSearch = React.useCallback((value: string) => {
    setSearchState(value)
  }, [])

  return {
    players,
    isLoading,
    error,
    page,
    totalPages,
    totalPlayers,
    currentUserPosition,
    currentUser,
    userRank,
    search,
    setPage,
    setSearch,
    refetch: fetchLeaderboard,
  }
}
