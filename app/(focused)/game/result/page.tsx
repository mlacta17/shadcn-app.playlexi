"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { TopNavbar } from "@/components/ui/top-navbar"
import { SearchInput } from "@/components/ui/search-input"
import { Button } from "@/components/ui/button"
import { PlayerAvatar } from "@/components/ui/player-avatar"
import {
  LeaderboardTable,
  type LeaderboardPlayer,
} from "@/components/game/leaderboard-table"
import { usePlayLexiUser } from "@/hooks/use-playlexi-user"
import type { GameMode, InputMethod } from "@/db/schema"

// =============================================================================
// TYPES
// =============================================================================

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
  longestStreak: number
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
  bestStreak: number
}

/**
 * Game history API response.
 */
interface GameHistoryResponse {
  games: GameHistoryEntry[]
  stats: GameStats
}

/**
 * Current game stats passed via URL params (from the game session).
 */
interface CurrentGameStats {
  roundsCompleted: number
  accuracy: number
  longestStreak: number
}

// =============================================================================
// HELPERS
// =============================================================================

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
 *
 * For solo play, each row represents a past game session.
 * We use the current user's avatarId for all entries since
 * this is personal game history (not other players).
 *
 * @param games - Game history entries from API
 * @param userAvatarId - Current user's avatar ID for consistency
 */
function historyToLeaderboard(
  games: GameHistoryEntry[],
  userAvatarId?: number
): LeaderboardPlayer[] {
  return games.map((game) => ({
    id: game.id,
    name: formatGameDate(game.playedAt),
    description: `${game.longestStreak} streak`,
    avatarId: userAvatarId, // Use current user's avatar for all entries
    round: game.roundsCompleted,
    accuracy: game.accuracy,
    points: game.roundsCompleted, // Use rounds as the "score" metric
  }))
}

/**
 * Determine if current game is a personal best.
 */
function getPersonalBestStatus(
  currentRound: number,
  bestRound: number,
  currentStreak: number,
  bestStreak: number,
  historyLength: number
): { type: "new-round-best" | "new-streak-best" | "top-3" | null; message: string } {
  if (historyLength === 0) {
    return { type: "new-round-best", message: "First Game Complete!" }
  }

  // Check for new round record
  if (currentRound > bestRound) {
    return { type: "new-round-best", message: "New Personal Best!" }
  }

  // Check for new streak record
  if (currentStreak > bestStreak) {
    return { type: "new-streak-best", message: "New Best Streak!" }
  }

  // Check if in top 3 range
  if (currentRound >= bestRound - 2) {
    return { type: "top-3", message: "Great Game!" }
  }

  return { type: null, message: "" }
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

  // Get current user's avatar for consistent display
  const { user: playLexiUser } = usePlayLexiUser()

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [searchQuery, setSearchQuery] = React.useState("")
  const [gameHistory, setGameHistory] = React.useState<LeaderboardPlayer[]>([])
  const [stats, setStats] = React.useState<GameStats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // ---------------------------------------------------------------------------
  // Derived Data from URL Params
  // ---------------------------------------------------------------------------

  // Get game mode from URL params (default: endless)
  const mode = (searchParams.get("mode") as GameMode) || "endless"

  // Get input method from URL params (default: voice)
  const inputMethod = (searchParams.get("input") as InputMethod) || "voice"

  // Get current game stats from URL params (passed from game session)
  const currentGame: CurrentGameStats = {
    roundsCompleted: parseInt(searchParams.get("rounds") || "0", 10),
    accuracy: parseInt(searchParams.get("accuracy") || "0", 10),
    longestStreak: parseInt(searchParams.get("streak") || "0", 10),
  }

  // ---------------------------------------------------------------------------
  // Fetch Data
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    async function fetchData() {
      try {
        // Fetch game history
        const historyResponse = await fetch(
          `/api/games/history?mode=${mode}&inputMethod=${inputMethod}`
        )

        if (historyResponse.ok) {
          const historyData = (await historyResponse.json()) as GameHistoryResponse
          // Pass user's avatarId for consistent avatar display
          setGameHistory(historyToLeaderboard(historyData.games, playLexiUser?.avatarId))
          setStats(historyData.stats)
        } else {
          // No history available (not logged in or no games)
          setGameHistory([])
          setStats(null)
        }
      } catch (err) {
        console.error("[GameResult] Error fetching data:", err)
        setGameHistory([])
        setStats(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [mode, inputMethod, playLexiUser?.avatarId])

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

  // Determine personal best status
  const personalBestStatus = React.useMemo(() => {
    if (!stats) return { type: null, message: "" }
    return getPersonalBestStatus(
      currentGame.roundsCompleted,
      stats.bestRound,
      currentGame.longestStreak,
      stats.bestStreak,
      stats.totalGames
    )
  }, [currentGame.roundsCompleted, currentGame.longestStreak, stats])

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
  if (isLoading) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading your results...</div>
      </div>
    )
  }

  // Format mode name for display
  const modeName = mode.charAt(0).toUpperCase() + mode.slice(1)

  return (
    <div
      data-slot="game-result-page"
      className="bg-background flex min-h-screen flex-col"
    >
      {/* Top Navigation */}
      <TopNavbar
        onClose={handleClose}
        centerContent={`${modeName} Mode`}
        hideSkip
      />

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center px-4 py-6 sm:px-6">
        <div className="flex w-full max-w-3xl flex-col gap-6">
          {/* Current Game Stats Section */}
          <section
            data-slot="current-game-stats"
            className="flex flex-col items-center gap-4 text-center"
          >
            {/* Personal Best Badge */}
            {personalBestStatus.type === "new-round-best" && (
              <div className="rounded-full bg-yellow-500/10 px-4 py-1 text-sm font-medium text-yellow-600 dark:text-yellow-400">
                {personalBestStatus.message}
              </div>
            )}
            {personalBestStatus.type === "new-streak-best" && (
              <div className="rounded-full bg-orange-500/10 px-4 py-1 text-sm font-medium text-orange-600 dark:text-orange-400">
                {personalBestStatus.message}
              </div>
            )}
            {personalBestStatus.type === "top-3" && (
              <div className="rounded-full bg-blue-500/10 px-4 py-1 text-sm font-medium text-blue-600 dark:text-blue-400">
                {personalBestStatus.message}
              </div>
            )}

            {/* Player Avatar - Consistent with navbar */}
            {playLexiUser?.avatarId && (
              <PlayerAvatar
                avatarId={playLexiUser.avatarId}
                size="lg"
                className="size-20"
              />
            )}

            {/* Main Stat: Rounds Completed */}
            <div className="flex flex-col items-center">
              <span className="text-6xl font-bold text-foreground">
                {currentGame.roundsCompleted}
              </span>
              <span className="text-lg text-muted-foreground">
                {currentGame.roundsCompleted === 1 ? "Round" : "Rounds"} Completed
              </span>
            </div>

            {/* Secondary Stats: Accuracy, Best Round, Streak */}
            <div className="flex gap-6 text-sm sm:gap-8">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">
                  {currentGame.accuracy}%
                </span>
                <span className="text-muted-foreground">Accuracy</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">
                  {stats?.bestRound ?? currentGame.roundsCompleted}
                </span>
                <span className="text-muted-foreground">Best</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">
                  {currentGame.longestStreak}
                </span>
                <span className="text-muted-foreground">Streak</span>
              </div>
            </div>
          </section>

          {/* Lifetime Progress (if available) */}
          {stats && stats.totalGames > 0 && (
            <section
              data-slot="lifetime-stats"
              className="rounded-lg border border-border bg-card p-4"
            >
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                YOUR PROGRESS
              </h2>
              <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                <div>
                  <span className="block text-xl font-bold text-foreground">
                    {stats.bestStreak}
                  </span>
                  <span className="text-xs text-muted-foreground">Best Streak</span>
                </div>
                <div>
                  <span className="block text-xl font-bold text-foreground">
                    {stats.averageAccuracy}%
                  </span>
                  <span className="text-xs text-muted-foreground">Avg Accuracy</span>
                </div>
                <div>
                  <span className="block text-xl font-bold text-foreground">
                    {stats.totalGames}
                  </span>
                  <span className="text-xs text-muted-foreground">Games Played</span>
                </div>
                <div>
                  <span className="block text-xl font-bold text-foreground">
                    {stats.totalCorrect}
                  </span>
                  <span className="text-xs text-muted-foreground">Words Spelled</span>
                </div>
              </div>
            </section>
          )}

          {/* Game History Section */}
          {gameHistory.length > 0 ? (
            <section data-slot="game-history">
              {/* Section Title */}
              <h2 className="mb-3 text-lg font-semibold text-foreground">
                Your Game History
              </h2>

              {/* Search Input */}
              <SearchInput
                placeholder="Search games"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                containerClassName="max-w-sm mb-4"
              />

              {/* History Table */}
              <LeaderboardTable data={filteredHistory} pageSize={7} />
            </section>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-muted-foreground">
                This was your first game! Keep playing to build your history.
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
 * Displays the player's personal performance stats for solo games.
 * Focused on self-improvement with key metrics that matter to players.
 *
 * ## Design Philosophy
 *
 * Solo mode is practice mode focused on self-improvement. The stats shown
 * are carefully chosen to provide actionable feedback:
 *
 * - **Rounds Completed**: Primary score metric (how far you got)
 * - **Accuracy**: Precision metric (how consistent you are)
 * - **Streak**: Momentum metric (consecutive correct answers)
 * - **Best Round/Streak**: Personal bests to beat
 *
 * ## Avatar Consistency
 *
 * The player's selected avatar (from onboarding) is shown:
 * - At the top of the results (hero section)
 * - In every row of game history (using same avatarId)
 *
 * This creates visual consistency with the navbar and profile.
 *
 * ## URL Parameters (Input)
 * - `mode`: "endless" or "blitz" (default: "endless")
 * - `input`: "voice" or "keyboard" (default: "voice")
 * - `rounds`: rounds completed in current game
 * - `accuracy`: accuracy percentage
 * - `streak`: longest streak in current game
 *
 * @see hooks/use-game-session.ts for game state management
 * @see lib/services/game-service.ts for history/stats API
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
