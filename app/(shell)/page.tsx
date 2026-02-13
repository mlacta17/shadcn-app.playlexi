/**
 * Dashboard Page — PlayLexi
 *
 * The main home screen for authenticated users.
 * Shows game mode cards in an interactive carousel that users
 * can browse with arrows, clicks, keyboard, or swipe.
 *
 * ## Card Order
 * 1. Daily Game - Primary retention/virality mechanic
 * 2. Endless - Core practice mode
 * 3. Blitz - Time-based challenge (coming soon)
 * 4. Multiplayer - Head-to-head mode (coming soon)
 * 5. Phonetic Calibration - Voice accuracy tuning
 *
 * ## Layout
 * The carousel shows the focused card centered and sharp, with
 * background cards fanned out, blurred, and frost-overlayed.
 * Arrow buttons and swipe gestures navigate between cards.
 *
 * @see lib/game-modes.ts for game mode configuration
 * @see components/game/game-mode-carousel.tsx for carousel component
 * @see components/game/game-mode-card.tsx for card component
 * @see Figma node 3048:43528
 * @see PRD Section 2.3 — Existing User Flow
 */

import { GameModeCarousel } from "@/components/game/game-mode-carousel"
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

      {/* Game Mode Carousel — no horizontal padding so cards bleed to viewport edges */}
      <section className="flex-1 pb-8">
        <GameModeCarousel modes={GAME_MODES} />
      </section>
    </main>
  )
}
