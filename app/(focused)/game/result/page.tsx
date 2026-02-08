"use client"

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"

import { TopNavbar } from "@/components/ui/top-navbar"
import { SearchInput } from "@/components/ui/search-input"
import {
  LeaderboardTable,
  type LeaderboardPlayer,
} from "@/components/game/leaderboard-table"
import { usePlayLexiUser } from "@/hooks/use-playlexi-user"
import { cn } from "@/lib/utils"
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
 * Game history API response.
 */
interface GameHistoryResponse {
  games: GameHistoryEntry[]
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

// =============================================================================
// ACTION CARD COMPONENT
// =============================================================================
//
// A clickable card with illustration, title, and description.
// Uses secondary button colors with card-like layout.
//
// NOTE: If this pattern is needed elsewhere (e.g., game mode selection,
// onboarding choices), consider extracting to components/ui/action-card.tsx
//
// =============================================================================

interface ActionCardProps {
  imageSrc: string
  imageAlt: string
  title: string
  description: string
  onClick?: () => void
  disabled?: boolean
}

/**
 * Action card for game result actions (Review, Play Again, Share).
 *
 * Follows secondary button design system:
 * - Background: bg-secondary
 * - Hover: hover:bg-[var(--secondary-hover)]
 *
 * @see Figma node 2880:30127 (Game result action cards)
 */
function ActionCard({
  imageSrc,
  imageAlt,
  title,
  description,
  onClick,
  disabled = false,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Layout
        "flex flex-col items-start gap-3 p-6 w-full text-left",
        // Styling (matches secondary button, shadow-xs per Figma)
        "bg-secondary rounded-xl shadow-xs",
        "transition-colors",
        // Hover state (matches secondary button hover)
        "hover:bg-[var(--secondary-hover)]",
        // Disabled state
        "disabled:opacity-50 disabled:pointer-events-none"
      )}
    >
      {/* Illustration */}
      <div className="size-11 flex items-center justify-center">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={44}
          height={44}
          className="object-contain"
        />
      </div>
      {/* Text content */}
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  )
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
        } else {
          // No history available (not logged in or no games)
          setGameHistory([])
        }
      } catch (err) {
        console.error("[GameResult] Error fetching data:", err)
        setGameHistory([])
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

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    router.push("/")
  }

  const handlePlayAgain = () => {
    router.push(`/game/${mode}`)
  }

  const handleReviewGame = () => {
    // TODO: Navigate to game review page when implemented
    // router.push(`/game/review?gameId=${gameId}`)
    console.log("[GameResult] Review game clicked")
  }

  const handleShareGame = async () => {
    // Use Web Share API if available, fallback to clipboard
    const shareData = {
      title: "PlayLexi Game Results",
      text: `I just completed ${currentGame.roundsCompleted} rounds with ${currentGame.accuracy}% accuracy on PlayLexi!`,
      url: window.location.href,
    }

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData)
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(
          `${shareData.text}\n${shareData.url}`
        )
        // TODO: Show toast notification "Copied to clipboard!"
        console.log("[GameResult] Share copied to clipboard")
      }
    } catch (err) {
      console.error("[GameResult] Share failed:", err)
    }
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
          {/* Page Title */}
          <h1 className="text-2xl font-semibold text-foreground">
            Game Results
          </h1>

          {/* Action Cards - Review, Play Again, Share */}
          <section
            data-slot="action-cards"
            className="grid grid-cols-1 gap-5 sm:grid-cols-3"
          >
            <ActionCard
              imageSrc="/illustrations/review-game.svg"
              imageAlt="Review game illustration"
              title="Review game"
              description="See what words you spelled correctly vs wrong."
              onClick={handleReviewGame}
            />
            <ActionCard
              imageSrc="/illustrations/play-again.svg"
              imageAlt="Play again illustration"
              title="Play again"
              description="Don't want to stop the fun? Let's play again!"
              onClick={handlePlayAgain}
            />
            <ActionCard
              imageSrc="/illustrations/share-game.svg"
              imageAlt="Share game illustration"
              title="Share game"
              description="Share this with your friends to let them know how you did!"
              onClick={handleShareGame}
            />
          </section>

          {/* Game History Section */}
          <section data-slot="game-history">
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

        </div>
      </main>
    </div>
  )
}

/**
 * Solo Game Result Screen
 *
 * Displays game result actions and history for solo games.
 *
 * ## Features
 *
 * - **Action Cards**: Review game, Play again, Share game
 * - **Game History**: Searchable table of past game sessions
 *
 * ## Avatar Consistency
 *
 * The player's selected avatar (from onboarding) is shown in every row
 * of game history, creating visual consistency with the navbar and profile.
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
