/**
 * Dashboard Page — PlayLexi
 *
 * The main home screen for authenticated users.
 * Shows game mode cards that users can browse and select.
 *
 * ## Card Order
 * 1. Daily Game - Primary retention/virality mechanic
 * 2. Endless - Core practice mode
 * 3. Blitz - Time-based challenge (coming soon)
 * 4. Multiplayer - Head-to-head mode (coming soon)
 *
 * ## Layout
 * Currently a horizontal scrollable preview. This will be replaced
 * with an animated carousel in the next iteration.
 *
 * @see lib/game-modes.ts for game mode configuration
 * @see components/game/game-mode-card.tsx for card component
 * @see PRD Section 2.3 — Existing User Flow
 */

import { GameModeCard } from "@/components/game/game-mode-card"
import { GAME_MODES } from "@/lib/game-modes"

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center gap-2 px-6 pt-8 pb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Ready to spell?
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Choose a game mode and start improving your spelling skills.
        </p>
      </section>

      {/* Game Mode Cards — Horizontal scroll preview (will become carousel) */}
      <section className="flex flex-1 flex-col px-6 pb-8">
        <div className="mx-auto flex w-full max-w-sm flex-1 gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:max-w-4xl sm:justify-center">
          {GAME_MODES.map((mode) => (
            <div
              key={mode.id}
              className="h-[480px] w-[300px] shrink-0 snap-center sm:h-[520px] sm:w-[320px]"
            >
              <GameModeCard mode={mode} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
