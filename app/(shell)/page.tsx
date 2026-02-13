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

      {/* Game Mode Cards — Preview layout (will become carousel) */}
      <section className="flex flex-1 flex-col items-center px-4 pb-8">
        <div className="grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {GAME_MODES.map((mode) => (
            <div
              key={mode.id}
              className="aspect-[3/4]"
            >
              <GameModeCard mode={mode} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
