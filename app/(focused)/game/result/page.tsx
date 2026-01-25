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
import type { RankTrack, GameMode, InputMethod } from "@/db/schema"
import { XP_THRESHOLDS, TIER_ORDER, getTierProgress } from "@/lib/game-constants"

// =============================================================================
// TYPES
// =============================================================================

/**
 * League/rank information for the header section.
 */
interface LeagueInfo {
  /** Current rank tier */
  rank: RankTier
  /** XP earned within current tier (not total XP) */
  xpInTier: number
  /** XP required to reach next tier (from current tier threshold) */
  xpForNextTier: number
  /** Progress percentage (0-100) */
  progress: number
}

/**
 * User rank data from API.
 */
interface UserRank {
  track: string
  tier: string
  xp: number
}

/**
 * User API response type.
 */
interface UserMeResponse {
  username?: string
  ranks?: UserRank[]
}

/**
 * Game history entry from API.
 */
interface GameHistoryEntry {
  id: string
  playedAt: string
  roundsCompleted: number
  correctAnswers: number
  wrongAnswers: number
  accuracy: number
  xpEarned: number
}

/**
 * Game statistics from API.
 */
interface GameStats {
  totalGames: number
  totalRounds: number
  totalCorrect: number
  totalXp: number
  averageAccuracy: number
  bestRound: number
}

/**
 * Game history API response.
 */
interface GameHistoryResponse {
  games: GameHistoryEntry[]
  stats: GameStats
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get XP progress within the current tier.
 *
 * Uses the centralized getTierProgress() from game-constants.ts.
 *
 * @param totalXp - Player's total accumulated XP
 * @returns Object with xpInTier (earned within tier) and xpForNextTier (needed for promotion)
 */
function getXpProgressForDisplay(totalXp: number): { xpInTier: number; xpForNextTier: number; progress: number } {
  const { tier, progress, xpToNext } = getTierProgress(totalXp)
  const tierIndex = TIER_ORDER.indexOf(tier)

  // Calculate XP needed for next tier (gap between thresholds)
  let xpForNextTier = 100 // Default for max tier
  if (tierIndex >= 0 && tierIndex < TIER_ORDER.length - 1) {
    const currentThreshold = XP_THRESHOLDS[tier]
    const nextTier = TIER_ORDER[tierIndex + 1]
    const nextThreshold = XP_THRESHOLDS[nextTier]
    xpForNextTier = nextThreshold - currentThreshold
  }

  // XP earned within current tier
  const currentThreshold = XP_THRESHOLDS[tier] || 0
  const xpInTier = totalXp - currentThreshold

  return { xpInTier, xpForNextTier, progress }
}

/**
 * Convert tier name to RankTier type (with hyphen format).
 */
function tierToRankTier(tier: string): RankTier {
  return tier.replace(/_/g, "-") as RankTier
}

/**
 * Format a date string for display.
 */
function formatGameDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString()
}

/**
 * Convert game history entries to leaderboard display format.
 */
function historyToLeaderboard(
  games: GameHistoryEntry[],
  username: string
): LeaderboardPlayer[] {
  return games.map((game, index) => ({
    id: game.id,
    name: username || "You",
    description: formatGameDate(game.playedAt),
    round: game.roundsCompleted,
    accuracy: game.accuracy,
    points: game.xpEarned,
  }))
}

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
  const [leagueInfo, setLeagueInfo] = React.useState<LeagueInfo | null>(null)
  const [gameHistory, setGameHistory] = React.useState<LeaderboardPlayer[]>([])
  const [stats, setStats] = React.useState<GameStats | null>(null)
  const [username, setUsername] = React.useState<string>("")
  const [isLoading, setIsLoading] = React.useState(true)

  // ---------------------------------------------------------------------------
  // Derived Data
  // ---------------------------------------------------------------------------

  // Get game mode from URL params (default: endless)
  const mode = (searchParams.get("mode") as GameMode) || "endless"

  // Get input method from URL params (default: voice)
  const inputMethod = (searchParams.get("input") as InputMethod) || "voice"

  // Build track name for looking up user rank
  const track: RankTrack = `${mode}_${inputMethod}` as RankTrack

  // ---------------------------------------------------------------------------
  // Fetch Data
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    async function fetchData() {
      try {
        // Fetch user data and game history in parallel
        const [userResponse, historyResponse] = await Promise.all([
          fetch("/api/users/me"),
          fetch(`/api/games/history?mode=${mode}&inputMethod=${inputMethod}`),
        ])

        // Process user data
        if (userResponse.ok) {
          const userData = (await userResponse.json()) as UserMeResponse
          setUsername(userData.username || "")

          const trackRank = userData.ranks?.find((r) => r.track === track)
          if (trackRank) {
            const { xpInTier, xpForNextTier, progress } = getXpProgressForDisplay(trackRank.xp)
            setLeagueInfo({
              rank: tierToRankTier(trackRank.tier),
              xpInTier,
              xpForNextTier,
              progress,
            })
          } else {
            setLeagueInfo({
              rank: "new-bee",
              xpInTier: 0,
              xpForNextTier: 100,
              progress: 0,
            })
          }
        } else {
          // User not logged in - use defaults
          setLeagueInfo({
            rank: "new-bee",
            xpInTier: 0,
            xpForNextTier: 100,
            progress: 0,
          })
        }

        // Process game history
        if (historyResponse.ok) {
          const historyData = (await historyResponse.json()) as GameHistoryResponse
          setGameHistory(historyToLeaderboard(historyData.games, username))
          setStats(historyData.stats)
        } else {
          // No history available (not logged in or no games)
          setGameHistory([])
          setStats(null)
        }
      } catch (err) {
        console.error("[GameResult] Error fetching data:", err)
        setLeagueInfo({
          rank: "new-bee",
          xpInTier: 0,
          xpForNextTier: 100,
          progress: 0,
        })
        setGameHistory([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [mode, inputMethod, track, username])

  // Filter history based on search query
  const filteredHistory = React.useMemo(() => {
    if (!searchQuery.trim()) return gameHistory

    const query = searchQuery.toLowerCase()
    return gameHistory.filter(
      (entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.description?.toLowerCase().includes(query)
    )
  }, [searchQuery, gameHistory])

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

  // Show loading state while fetching data
  if (isLoading || !leagueInfo) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading your results...</div>
      </div>
    )
  }

  // Get display name for the league (using rank label)
  const leagueName = `${RANK_LABELS[leagueInfo.rank]} League`

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
              <Progress value={leagueInfo.progress} />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>XP PROGRESS</span>
                <span>
                  {leagueInfo.xpInTier}/{leagueInfo.xpForNextTier} XP
                </span>
              </div>
            </div>

            {/* Stats Summary */}
            {stats && stats.totalGames > 0 && (
              <div className="flex gap-6 text-sm text-muted-foreground">
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-foreground">{stats.totalGames}</span>
                  <span>Games</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-foreground">{stats.bestRound}</span>
                  <span>Best Round</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-foreground">{stats.averageAccuracy}%</span>
                  <span>Avg Accuracy</span>
                </div>
              </div>
            )}
          </section>

          {/* Game History Section */}
          {gameHistory.length > 0 ? (
            <>
              {/* Section Title */}
              <h2 className="text-lg font-semibold text-foreground">Your Game History</h2>

              {/* Search Input */}
              <SearchInput
                placeholder="Search games"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                containerClassName="max-w-sm"
              />

              {/* History Table */}
              <LeaderboardTable data={filteredHistory} pageSize={7} />
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-muted-foreground">
                No game history yet. Play a game to see your results here!
              </p>
            </div>
          )}

          {/* Play Again Button */}
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
 * Displays the player's game results and game history.
 * Shows their current league/rank, rank progress, stats summary,
 * and a history of their past games for this track.
 *
 * ## Data Flow
 * - Fetches user rank from `/api/users/me`
 * - Fetches game history from `/api/games/history`
 * - Displays real game data, not mock data
 *
 * ## URL Parameters
 * - `mode`: "endless" or "blitz" (default: "endless")
 * - `input`: "voice" or "keyboard" (default: "voice")
 *
 * @see lib/services/game-service.ts for database operations
 * @see PRD Section 5.5.4 — Elimination Flow
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
