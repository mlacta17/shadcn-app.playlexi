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
 * - Mobile (< md): Horizontal scroll with snap — each card at ~75vw
 *   width, showing 1 card + a peek of the next
 * - md (768px+): 2-column centered grid (cards ≈360px — Figma size)
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

      {/* Game Mode Cards — Horizontal scroll on mobile, grid on md+ */}
      <section className="pb-8">
        <div className="flex gap-4 overflow-x-auto px-4 snap-x snap-mandatory scroll-pl-4 no-scrollbar md:grid md:grid-cols-2 md:overflow-visible md:snap-none md:mx-auto md:max-w-3xl">
          {GAME_MODES.map((mode) => (
            <div
              key={mode.id}
              className="aspect-[362/446] w-[75vw] max-w-[362px] shrink-0 snap-start md:w-auto md:max-w-none md:shrink"
            >
              <GameModeCard mode={mode} />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
