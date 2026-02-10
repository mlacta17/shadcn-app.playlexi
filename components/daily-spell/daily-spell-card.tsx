"use client"

/**
 * Daily Spell Card — PlayLexi
 *
 * Dashboard card for the Daily Spell game mode.
 * Shows different states based on whether user has played today.
 *
 * ## States
 *
 * - **Not Played**: Shows "Play Today" button
 * - **Played**: Shows emoji row, score, and "View Results" button
 * - **Loading**: Skeleton while fetching status
 *
 * @see Daily Spell feature spec
 */

import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// =============================================================================
// TYPES
// =============================================================================

interface DailySpellStatus {
  hasPlayed: boolean
  score?: number
  emojiRow?: string
  puzzleNumber?: number
}

interface ApiResponse {
  hasPlayed: boolean
  puzzle?: { number: number }
  userResult?: { score: number; emojiRow: string }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Daily Spell card for the dashboard.
 *
 * Fetches user's daily spell status and displays appropriate UI.
 */
export function DailySpellCard() {
  const [status, setStatus] = React.useState<DailySpellStatus | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Fetch daily spell status on mount
  React.useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/daily-spell")

        if (response.ok) {
          const data = (await response.json()) as ApiResponse
          setStatus({
            hasPlayed: data.hasPlayed,
            score: data.userResult?.score,
            emojiRow: data.userResult?.emojiRow,
            puzzleNumber: data.puzzle?.number,
          })
        } else {
          // No puzzle available or error
          setStatus({ hasPlayed: false })
        }
      } catch (error) {
        console.error("[DailySpellCard] Error fetching status:", error)
        setStatus({ hasPlayed: false })
      } finally {
        setIsLoading(false)
      }
    }

    fetchStatus()
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Played state
  if (status?.hasPlayed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Daily Spell</span>
            <span className="text-sm font-normal text-muted-foreground">
              #{status.puzzleNumber}
            </span>
          </CardTitle>
          <CardDescription className="flex flex-col gap-2">
            <span className="text-2xl tracking-wider">{status.emojiRow}</span>
            <span>
              You scored {status.score}/5 today
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/game/daily/result">View Results</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Not played state
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Spell</CardTitle>
        <CardDescription>
          Same 5 words for everyone. One attempt per day. Voice only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link href="/game/daily">Play Today</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
