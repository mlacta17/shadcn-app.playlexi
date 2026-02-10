/**
 * Dashboard Page — PlayLexi
 *
 * The main home screen for authenticated users.
 * Shows play options, current rank, and quick stats.
 *
 * ## What Users See Here
 * - Daily Spell (featured, first position)
 * - Game mode cards (Endless, Blitz)
 * - Current rank badge and progress
 *
 * ## Card Order
 * 1. Daily Spell - Primary retention/virality mechanic
 * 2. Endless Mode - Core practice mode
 * 3. Blitz Mode - Time-based challenge
 *
 * @see PRD Section 2.3 — Existing User Flow
 * @see Daily Spell feature spec
 */

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DailySpellCard } from "@/components/daily-spell/daily-spell-card"

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
          {/* Daily Spell - Featured first */}
          <DailySpellCard />

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
    </main>
  )
}
