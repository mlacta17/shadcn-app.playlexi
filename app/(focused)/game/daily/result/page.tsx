"use client"

/**
 * Daily Spell Result Page — PlayLexi
 *
 * Displays results after completing Daily Spell game.
 * Shows percentile ranking and word breakdown.
 *
 * ## Design (Figma node 2913:15840)
 *
 * - TopNavbar with "Daily game" center text
 * - Chart Up illustration (164x164)
 * - "You're in the top X% today" title (4xl semibold)
 * - Subtitle explaining percentile meaning
 * - 3 action cards: Challenge a Friend, Keep Spelling, Share results
 * - Data table with columns: Correct Answer, Your Answer, Difficulty, Status
 *
 * ## Reusable Components
 *
 * - ActionCard: Shared component from components/ui/action-card.tsx
 * - Table: Standard table component from components/ui/table.tsx
 *
 * @see Figma: https://www.figma.com/design/0LvXb0CnTpSAx5oBOJOvUd/Playlexi.com?node-id=2913-15840
 */

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { EyeIcon, EyeOffIcon } from "@/lib/icons"

import { TopNavbar } from "@/components/ui/top-navbar"
import { ActionCard } from "@/components/ui/action-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { showSuccessToast } from "@/lib/toast-utils"

// =============================================================================
// TYPES
// =============================================================================

interface WordResult {
  word: string
  answer: string
  correct: boolean
  difficulty: number // 1-7 tier
}

interface DailySpellResult {
  puzzleId: string
  puzzleNumber: number
  score: number
  emojiRow: string
  percentile: number | null
  wordResults: WordResult[]
}

interface ApiResponse {
  hasPlayed: boolean
  puzzle: {
    id: string
    number: number
  }
  userResult?: {
    score: number
    emojiRow: string
    percentile: number | null
    wordResults: WordResult[]
  }
}

// =============================================================================
// DIFFICULTY BAR COMPONENT
// =============================================================================

interface DifficultyBarProps {
  /** Difficulty tier (1-7), mapped to 1-3 bars */
  tier: number
}

/**
 * Visual difficulty indicator with 3 bars.
 * - Tier 1-2: 1 bar filled (Easy)
 * - Tier 3-4: 2 bars filled (Medium)
 * - Tier 5-7: 3 bars filled (Hard)
 *
 * Uses orange-600 (#ea580c) per Figma design for filled bars.
 *
 * @see Figma node 2944:20370
 */
function DifficultyBar({ tier }: DifficultyBarProps) {
  // Map tier to number of filled bars
  let filledBars = 1
  if (tier >= 5) {
    filledBars = 3
  } else if (tier >= 3) {
    filledBars = 2
  }

  return (
    <div className="flex gap-[3.333px] items-end w-10">
      {/* Bar 1 - Short (10px) */}
      <div
        className={cn(
          "flex-1 h-[10px] rounded-lg",
          filledBars >= 1 ? "bg-orange-600" : "bg-accent"
        )}
      />
      {/* Bar 2 - Medium (18px) */}
      <div
        className={cn(
          "flex-1 h-[18px] rounded-lg",
          filledBars >= 2 ? "bg-orange-600" : "bg-accent"
        )}
      />
      {/* Bar 3 - Tall (24px) */}
      <div
        className={cn(
          "flex-1 h-[24px] rounded-lg",
          filledBars >= 3 ? "bg-orange-600" : "bg-accent"
        )}
      />
    </div>
  )
}

// =============================================================================
// CONTENT COMPONENT
// =============================================================================

function ResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get params from URL
  const puzzleNumber = parseInt(searchParams.get("puzzleNumber") || "0", 10)
  const score = parseInt(searchParams.get("score") || "0", 10)
  const emojiRow = searchParams.get("emojiRow") || ""

  // State
  const [result, setResult] = React.useState<DailySpellResult | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [revealedWords, setRevealedWords] = React.useState<Set<number>>(
    new Set()
  )

  // Fetch full result on mount
  React.useEffect(() => {
    async function fetchResult() {
      try {
        const response = await fetch("/api/daily-spell")
        if (response.ok) {
          const data = (await response.json()) as ApiResponse
          if (data.hasPlayed && data.userResult) {
            setResult({
              puzzleId: data.puzzle.id,
              puzzleNumber: data.puzzle.number,
              score: data.userResult.score,
              emojiRow: data.userResult.emojiRow,
              percentile: data.userResult.percentile,
              wordResults: data.userResult.wordResults || [],
            })
          }
        }
      } catch (error) {
        console.error("[ResultPage] Error fetching result:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchResult()
  }, [])

  // Toggle word reveal
  const handleToggleReveal = (index: number) => {
    setRevealedWords((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  // Share result
  const handleShare = async () => {
    const displayNumber = result?.puzzleNumber || puzzleNumber
    const displayScore = result?.score ?? score
    const displayEmoji = result?.emojiRow || emojiRow

    const shareText = `Daily Spell #${displayNumber}\n${displayEmoji}\nScore: ${displayScore}/5\n\nPlay at playlexi.com`

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Daily Spell #${displayNumber}`,
          text: shareText,
        })
      } else {
        await navigator.clipboard.writeText(shareText)
        showSuccessToast("Copied to clipboard!")
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      console.error("[ResultPage] Share failed:", err)
    }
  }

  // Challenge a friend
  const handleChallenge = () => {
    // TODO: Open challenge modal
    console.log("[ResultPage] Challenge clicked")
  }

  // Keep spelling (go to endless mode)
  const handleKeepSpelling = () => {
    router.push("/game/endless")
  }

  // Navigate home
  const handleClose = () => {
    router.push("/")
  }

  // Calculate display values
  const displayScore = result?.score ?? score
  const displayPercentile = result?.percentile ?? 50 // Default to 50 if not available

  // Generate subtitle text based on percentile and score
  const getSubtitleText = () => {
    const medianScore = 3
    const betterThanMedian = displayScore > medianScore
    const percentileText = 100 - displayPercentile

    if (betterThanMedian) {
      return `${percentileText}% of players only got ${medianScore} words out of 5 words right, which means you're better than the median right now!`
    } else {
      return `Keep practicing! ${percentileText}% of players scored higher. You'll get there!`
    }
  }

  return (
    <div
      data-slot="daily-spell-result-page"
      className="bg-background flex min-h-screen flex-col"
    >
      {/* Top Navigation - "Daily game" per Figma */}
      <TopNavbar
        onClose={handleClose}
        centerContent={
          <span className="text-sm text-muted-foreground">Daily game</span>
        }
        hideSkip
      />

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center gap-6 overflow-clip px-6 py-20">
        <div className="flex flex-col items-center gap-10 w-full max-w-[814px] rounded-lg p-0">
          {/* Chart Up Illustration - 164x164 per Figma */}
          <div className="relative size-[164px]">
            <Image
              src="/illustrations/chart-up.svg"
              alt="Performance chart"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Text Content */}
          <div className="flex flex-col gap-5 items-center text-center w-full">
            {/* Percentile Title - 4xl semibold */}
            <h1 className="text-4xl font-semibold text-foreground">
              {isLoading
                ? "Calculating..."
                : `You're in the top ${displayPercentile}% today`}
            </h1>
            {/* Subtitle - base regular muted */}
            <p className="text-base text-muted-foreground">
              {isLoading ? "Loading your results..." : getSubtitleText()}
            </p>
          </div>

          {/* Action Cards Grid - 3 columns per Figma */}
          {/* Uses shared ActionCard component with consistent hover/focus states */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
            <ActionCard
              imageSrc="/illustrations/challenge-friend.svg"
              imageAlt="Challenge a friend"
              title="Challenge a Friend"
              description="Send today's game to see if they can beat you!"
              onClick={handleChallenge}
            />
            <ActionCard
              imageSrc="/illustrations/keep-spelling.svg"
              imageAlt="Keep spelling"
              imageWidth={51}
              title="Keep Spelling"
              description="Jump into Endless and keep the momentum going!"
              onClick={handleKeepSpelling}
            />
            <ActionCard
              imageSrc="/illustrations/share-results.svg"
              imageAlt="Share results"
              title="Share results"
              description="Post your score and show off to your friends!"
              onClick={handleShare}
            />
          </div>

          {/* Data Table - Uses standard Table component with hover states */}
          {!isLoading && result?.wordResults && result.wordResults.length > 0 && (
            <div className="w-full rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Correct Answer</TableHead>
                    <TableHead>Your Answer</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead className="w-[85px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.wordResults.map((word, index) => {
                    const isRevealed = revealedWords.has(index)
                    return (
                      <TableRow key={`word-${index}`}>
                        {/* Correct Answer with eye toggle */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm text-foreground">
                              {isRevealed ? word.word : "••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleReveal(index)}
                              className="size-4 flex items-center justify-center hover:opacity-70 transition-opacity"
                              aria-label={isRevealed ? "Hide word" : "Reveal word"}
                            >
                              {isRevealed ? (
                                <EyeOffIcon className="size-4 text-foreground" />
                              ) : (
                                <EyeIcon className="size-4 text-foreground" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        {/* Your Answer */}
                        <TableCell>
                          <span className="text-sm text-foreground">
                            {word.answer || "—"}
                          </span>
                        </TableCell>
                        {/* Difficulty */}
                        <TableCell>
                          <DifficultyBar tier={word.difficulty} />
                        </TableCell>
                        {/* Status */}
                        <TableCell>
                          <span className="text-sm">
                            {word.correct ? "✅" : "❌"}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

/**
 * Daily Spell Result Page
 *
 * Shows game results with percentile ranking and word breakdown.
 */
export default function DailySpellResultPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading results...</div>
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  )
}
