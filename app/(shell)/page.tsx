/**
 * Dashboard Page — PlayLexi
 *
 * The main home screen for authenticated users.
 * Shows play options, current rank, and quick stats.
 *
 * ## What Users See Here
 * - Play buttons (Endless, Blitz)
 * - Current rank badge and progress
 * - Recent activity / stats
 *
 * ## Future Enhancements
 * - Daily challenges
 * - Friends activity feed
 * - Achievement notifications
 *
 * @see PRD Section 2.3 — Existing User Flow
 */

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to spell?
        </h1>
        <p className="max-w-md text-muted-foreground">
          Choose a game mode and start improving your spelling skills.
        </p>
      </section>

      {/* Game Mode Cards */}
      <section className="container mx-auto max-w-4xl px-6 pb-12">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Endless Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Endless Mode</CardTitle>
              <CardDescription>
                Spell as many words as you can. 3 lives, infinite rounds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/game/endless">Play Endless</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Blitz Mode */}
          <Card>
            <CardHeader>
              <CardTitle>Blitz Mode</CardTitle>
              <CardDescription>
                Race against the clock. 3 minutes, no lives.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/game/blitz">Play Blitz</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Stats Preview */}
      <section className="container mx-auto max-w-4xl px-6 pb-12">
        <Card>
          <CardHeader>
            <CardTitle>Your Progress</CardTitle>
            <CardDescription>
              Keep playing to improve your rank and climb the leaderboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">—</p>
                <p className="text-sm text-muted-foreground">Current Rank</p>
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Games Played</p>
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-sm text-muted-foreground">Words Spelled</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Button asChild variant="link">
                <Link href="/leaderboard">View Leaderboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
