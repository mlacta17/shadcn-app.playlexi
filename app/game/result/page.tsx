"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { TopNavbar } from "@/components/ui/top-navbar"
import { Progress } from "@/components/ui/progress"
import { SearchInput } from "@/components/ui/search-input"
import { Button } from "@/components/ui/button"
import {
  LeaderboardTable,
  type LeaderboardPlayer,
} from "@/components/game/leaderboard-table"
import { RankBadge, type RankTier, RANK_LABELS } from "@/components/game/rank-badge"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Game mode type for result screen.
 */
type GameMode = "endless" | "blitz"

/**
 * League/rank information for the header section.
 */
interface LeagueInfo {
  /** Current rank tier */
  rank: RankTier
  /** Current rank rating (XP towards next tier) */
  rating: number
  /** Rating required for next tier */
  maxRating: number
}

// =============================================================================
// MOCK DATA
// =============================================================================

/**
 * Mock leaderboard data for development.
 *
 * In production, this will come from the game session results
 * and/or the user's game history stored in Cloudflare D1.
 */
const MOCK_LEADERBOARD: LeaderboardPlayer[] = [
  {
    id: "1",
    name: "Luffy",
    description: "Description Text",
    round: 11,
    accuracy: 99,
    points: 25,
  },
  {
    id: "2",
    name: "felicia.reid@example.com",
    description: "Description Text",
    round: 11,
    accuracy: 99,
    points: 25,
  },
  {
    id: "3",
    name: "georgia.young@example.com",
    description: "Description Text",
    round: 11,
    accuracy: 99,
    points: 25,
  },
  {
    id: "4",
    name: "alma.lawson@example.com",
    description: "Description Text",
    round: 11,
    accuracy: 99,
    points: 25,
  },
  {
    id: "5",
    name: "dolores.chambers@example.com",
    description: "Description Text",
    round: 11,
    accuracy: 99,
    points: 25,
  },
  {
    id: "6",
    name: "alma.lawson@example.com",
    description: "Description Text",
    round: 11,
    accuracy: 99,
    points: 25,
  },
  {
    id: "7",
    name: "dolores.chambers@example.com",
    description: "Description Text",
    round: 11,
    accuracy: 99,
    points: 25,
  },
]

// Generate more mock data for pagination demo
const EXTENDED_LEADERBOARD: LeaderboardPlayer[] = Array.from(
  { length: 120 },
  (_, i) => ({
    ...MOCK_LEADERBOARD[i % MOCK_LEADERBOARD.length],
    id: `player-${i + 1}`,
    round: Math.max(1, 11 - Math.floor(i / 10)),
    accuracy: Math.max(70, 99 - Math.floor(i / 5)),
    points: Math.max(5, 25 - Math.floor(i / 8)),
  })
)

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Inner component that uses useSearchParams.
 * Must be wrapped in Suspense boundary.
 */
function GameResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [searchQuery, setSearchQuery] = React.useState("")

  // ---------------------------------------------------------------------------
  // Derived Data
  // ---------------------------------------------------------------------------

  // Get game mode from URL params (default: endless)
  const mode: GameMode =
    (searchParams.get("mode") as GameMode) || "endless"

  // Mock league info - will come from user profile in Phase 2
  const leagueInfo: LeagueInfo = {
    rank: "busy-bee", // "Bronze League" equivalent
    rating: 57,
    maxRating: 100,
  }

  // Filter leaderboard based on search query
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return EXTENDED_LEADERBOARD

    const query = searchQuery.toLowerCase()
    return EXTENDED_LEADERBOARD.filter(
      (player) =>
        player.name.toLowerCase().includes(query) ||
        player.description?.toLowerCase().includes(query)
    )
  }, [searchQuery])

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    router.push("/")
  }

  const handlePlayAgain = () => {
    router.push(`/game/${mode}`)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Get display name for the league (using rank label)
  const leagueName = `${RANK_LABELS[leagueInfo.rank]} League`
  const progressPercentage = (leagueInfo.rating / leagueInfo.maxRating) * 100

  return (
    <div
      data-slot="game-result-page"
      className="bg-background flex min-h-screen flex-col"
    >
      {/* Top Navigation */}
      <TopNavbar
        onClose={handleClose}
        centerContent={`Game mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
        hideSkip
      />

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6">
        <div className="flex w-full max-w-3xl flex-col gap-6">
          {/* League Header Section */}
          <section
            data-slot="league-header"
            className="flex flex-col items-center gap-4 text-center"
          >
            {/* Rank Badge */}
            <RankBadge rank={leagueInfo.rank} size="xl" />

            {/* League Title */}
            <h1 className="text-2xl font-bold text-foreground">{leagueName}</h1>

            {/* Rank Progress */}
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Progress value={progressPercentage} />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>RANK RATING</span>
                <span>
                  {leagueInfo.rating}/{leagueInfo.maxRating}
                </span>
              </div>
            </div>
          </section>

          {/* Search Input */}
          <SearchInput
            placeholder="Search players"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            containerClassName="max-w-sm"
          />

          {/* Leaderboard Table */}
          <LeaderboardTable data={filteredData} pageSize={7} />

          {/* Play Again Button - Fixed at bottom on mobile */}
          <div className="sticky bottom-4 mt-4 flex justify-center sm:relative sm:bottom-auto">
            <Button onClick={handlePlayAgain} size="lg" className="w-full sm:w-auto">
              Play Again
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

/**
 * Solo Game Result Screen
 *
 * Displays the player's game results in the context of their historical
 * performance. Shows their current league/rank, rank progress, and a
 * leaderboard of their past games.
 *
 * ## Layout (per Figma design node 2389:32405)
 * - TopNavbar with close button and game mode indicator
 * - League header with rank badge, title, and progress bar
 * - Search input for filtering games
 * - LeaderboardTable showing Rank, Player, Rounds, Accuracy, Points
 * - Pagination at the bottom
 *
 * ## Data Flow (Phase 1 - Mock Data)
 * Currently uses mock data. In Phase 2+, will:
 * - Read game session results from URL params or session storage
 * - Fetch user's game history from Cloudflare D1
 * - Calculate and display rank progression
 *
 * @see PRD Section 5.5.4 — Elimination Flow
 * @see Figma node 2389:32405
 */
export default function GameResultPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading results...</div>
        </div>
      }
    >
      <GameResultContent />
    </Suspense>
  )
}
