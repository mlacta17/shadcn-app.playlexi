"use client"

/**
 * Daily Spell Streak Page — PlayLexi
 *
 * Displays after completing Daily Spell game.
 * Shows streak info before navigating to results.
 *
 * ## Design (Figma node 2913:14663)
 *
 * - TopNavbar with "Daily game" center text
 * - Large bolt illustration (164x164)
 * - "{N} day streak" title (4xl semibold)
 * - Subtitle: "Practice each day so that your streak won't reset"
 * - Week calendar card showing Mon-Sun with full day names
 * - Continue button (primary) → Results page
 * - Exit button (ghost) → Home
 *
 * @see Figma: https://www.figma.com/design/0LvXb0CnTpSAx5oBOJOvUd/Playlexi.com?node-id=2913-14663
 */

import * as React from "react"
import { Suspense } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "@/lib/auth/client"

import { TopNavbar } from "@/components/ui/top-navbar"
import { Button } from "@/components/ui/button"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { CheckIcon } from "@/lib/icons"
import { cn } from "@/lib/utils"

// =============================================================================
// TYPES
// =============================================================================

interface WeekDay {
  /** Unique day identifier (Mon, Tue, Wed, Thu, Fri, Sat, Sun) */
  id: string
  /** Full day name for display */
  label: string
  /** Whether user played on this day */
  played: boolean
}

interface WeekActivityEntry {
  day: string
  played: boolean
}

interface StatsResponse {
  currentStreak: number
  bestStreak: number
  totalGamesPlayed: number
  totalWins: number
  winRate: number
  weekActivity: WeekActivityEntry[]
}

// =============================================================================
// WEEK CALENDAR COMPONENT
// =============================================================================

interface WeekCalendarProps {
  days: WeekDay[]
}

/**
 * Week activity calendar showing Mon-Sun.
 * Played days show primary color with check icon.
 * Unplayed days show secondary color with opacity.
 *
 * @see Figma node 2913:14678
 */
function WeekCalendar({ days }: WeekCalendarProps) {
  return (
    <div className="flex gap-7 items-start justify-center overflow-hidden rounded-[10px] border border-border bg-background p-6">
      {days.map((day) => (
        <div
          key={day.id}
          className="flex flex-col gap-1 items-center"
        >
          {/* Activity indicator circle */}
          <div
            className={cn(
              "size-10 rounded-full flex items-center justify-center",
              day.played
                ? "bg-primary"
                : "bg-secondary opacity-50"
            )}
          >
            {day.played && (
              <CheckIcon className="size-6 text-primary-foreground" />
            )}
          </div>
          {/* Day label */}
          <span className="text-sm font-medium text-muted-foreground">
            {day.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// CONTENT COMPONENT
// =============================================================================

function StreakContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const isAuthenticated = !!session

  // Get params from URL
  const puzzleId = searchParams.get("puzzleId") || ""
  const puzzleNumber = searchParams.get("puzzleNumber") || "0"
  const score = searchParams.get("score") || "0"
  const emojiRow = searchParams.get("emojiRow") || ""

  // State for stats
  const [stats, setStats] = React.useState<StatsResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Fetch stats on mount (include visitorId for anonymous users)
  React.useEffect(() => {
    async function fetchStats() {
      try {
        let url = "/api/daily-spell/stats"
        if (!isAuthenticated) {
          const visitorId = localStorage.getItem("playlexi_visitor_id")
          if (visitorId) {
            url += `?visitorId=${encodeURIComponent(visitorId)}`
          }
        }
        const response = await fetch(url)
        if (response.ok) {
          const data = (await response.json()) as StatsResponse
          setStats(data)
        }
      } catch (error) {
        console.error("[StreakPage] Error fetching stats:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchStats()
  }, [isAuthenticated])

  // Build week days from stats
  const weekDays = React.useMemo((): WeekDay[] => {
    const dayMap = [
      { id: "Mon", label: "Mon" },
      { id: "Tue", label: "Tue" },
      { id: "Wed", label: "Wed" },
      { id: "Thu", label: "Thu" },
      { id: "Fri", label: "Fri" },
      { id: "Sat", label: "Sat" },
      { id: "Sun", label: "Sun" },
    ]

    // Create a map from the weekActivity array
    const activityMap = new Map<string, boolean>()
    if (stats?.weekActivity) {
      for (const entry of stats.weekActivity) {
        activityMap.set(entry.day, entry.played)
      }
    }

    return dayMap.map((day) => ({
      id: day.id,
      label: day.label,
      played: activityMap.get(day.id) ?? false,
    }))
  }, [stats])

  // Navigate to results
  const handleContinue = () => {
    const params = new URLSearchParams({
      puzzleId,
      puzzleNumber,
      score,
      emojiRow,
    })
    router.push(`/game/daily/result?${params.toString()}`)
  }

  // Navigate home
  const handleExit = () => {
    router.push("/")
  }

  // Current streak (default to 1 since they just played)
  const currentStreak = stats?.currentStreak ?? 1

  return (
    <div
      data-slot="daily-spell-streak-page"
      className="bg-background flex min-h-screen flex-col"
    >
      {/* Top Navigation - matches Figma design */}
      <TopNavbar
        onClose={handleExit}
        centerContent={
          <span className="text-sm text-muted-foreground">Daily game</span>
        }
        hideSkip
      />

      {/* Main Content - centered with proper spacing */}
      <main className="flex flex-1 flex-col items-center gap-6 overflow-hidden px-6 py-20">
        <div className="flex flex-col items-center gap-10 w-full rounded-lg p-0">
          {/* Bolt Illustration - 164x164 per Figma */}
          <div className="relative size-[164px]">
            <Image
              src="/illustrations/streak-bolt.svg"
              alt="Streak lightning bolt"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Text Content */}
          <div className="flex flex-col gap-5 items-center text-center w-full">
            {/* Streak Number - 4xl semibold */}
            <h1 className="text-4xl font-semibold text-foreground">
              {isLoading ? "..." : `${currentStreak} day streak`}
            </h1>
            {/* Subtitle - base regular muted */}
            <p className="text-base text-muted-foreground">
              Practice each day so that your streak won&apos;t reset
            </p>
          </div>

          {/* Week Calendar */}
          {!isLoading && <WeekCalendar days={weekDays} />}

          {/* Sign-up CTA for anonymous users */}
          {!isAuthenticated && (
            <div className="flex flex-col items-center gap-3 w-full max-w-[304px]">
              <p className="text-sm text-muted-foreground text-center">
                Sign up to save your streak across devices
              </p>
              <GoogleSignInButton callbackURL="/auth/callback" className="w-full" />
            </div>
          )}

          {/* Action Buttons - stacked, max-width constrained */}
          <div className="flex flex-col gap-2 items-center w-full max-w-[1280px] px-24">
            {/* Continue Button - Primary */}
            <Button
              className="w-[304px]"
              onClick={handleContinue}
            >
              Continue
            </Button>
            {/* Exit Button - Ghost */}
            <Button
              variant="ghost"
              className="w-[304px]"
              onClick={handleExit}
            >
              Exit
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

/**
 * Daily Spell Streak Page
 *
 * Shows streak information after completing the daily puzzle.
 */
export default function DailySpellStreakPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading streak...</div>
        </div>
      }
    >
      <StreakContent />
    </Suspense>
  )
}
