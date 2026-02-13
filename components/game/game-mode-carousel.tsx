/**
 * Game Mode Carousel — PlayLexi
 *
 * A full-bleed card stack carousel for browsing game modes on the dashboard.
 * The focused card is centered and vivid; background cards fan out to the
 * viewport edges with a white frost overlay, matching the Figma design.
 *
 * ## Overlapping Full-Bleed Layout
 * Cards overlap each other in a stacked fan, spreading across the viewport.
 * Each step offsets ~250px (capped), giving ~112px overlap between adjacent
 * cards. The ±2 cards peek from the screen edges. On smaller screens the
 * offset scales down proportionally (20% of viewport width).
 *
 * ## Interaction
 * - **Arrow buttons**: Navigate left/right (loops infinitely)
 * - **Click**: Tap any visible background card to focus it
 * - **Keyboard**: ArrowLeft / ArrowRight keys
 * - **Swipe**: Touch swipe left/right on mobile
 *
 * ## Visual Stack (Figma node 3048:43528)
 * ```
 * ┌─viewport──────────────────────────────viewport─┐
 * │┌──┐ ┌───┐  ┌────────┐  ┌───┐ ┌──┐            │
 * ││±2├─┤ ±1├──┤ Focus  ├──┤±1 ├─┤±2│            │
 * ││  │ │   │  │        │  │   │ │  │            │
 * │└──┘ └───┘  └────────┘  └───┘ └──┘            │
 * └───────────────────────────────────────────────┘
 *                   ← →
 * ```
 * Cards overlap ~112px. Focused card has highest z-index.
 *
 * ## Circular Layout
 * Cards wrap around infinitely. Background cards rearrange using the
 * shortest circular path. Cards that wrap teleport instantly (duration: 0)
 * to avoid visible cross-screen animation artifacts.
 *
 * @see lib/game-modes.ts for game mode configuration
 * @see components/game/game-mode-card.tsx for individual card rendering
 * @see Figma node 3048:43528
 */

"use client"

import * as React from "react"
import { motion } from "motion/react"

import { GameModeCard } from "./game-mode-card"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, ArrowRightIcon } from "@/lib/icons"
import type { GameModeConfig } from "@/lib/game-modes"

// =============================================================================
// CONSTANTS — Match Figma node 3048:43528
// =============================================================================

/** Card width in pixels (Figma: 362px) */
const CARD_WIDTH = 362

/** Card height in pixels (Figma: 446px) */
const CARD_HEIGHT = 446

/**
 * Card offset scales with viewport but caps to guarantee overlap.
 *
 * In Figma (1280px), ±1 cards are ~258px from center → ~20% of viewport.
 * Cards are 362px wide, so 250px offset → 112px overlap (~31% of card).
 *
 * Without a cap, wider screens (1920px+) push cards apart until they
 * no longer overlap, breaking the stacked look. The cap ensures cards
 * always overlap by at least 112px on any screen size.
 */
const OFFSET_RATIO = 0.20
const MAX_OFFSET = 250

/** Spring animation config for smooth card transitions */
const SPRING = { type: "spring" as const, stiffness: 300, damping: 30 }

/** Instant transition for cards that wrap around the circular layout */
const INSTANT = { duration: 0 }

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Track viewport width for responsive card spread.
 *
 * Returns a pixel offset per step that:
 * - Scales proportionally on small/medium screens (cards stay visible)
 * - Caps at MAX_OFFSET on large screens (cards always overlap)
 */
function useCardOffset(): number {
  const [offset, setOffset] = React.useState(MAX_OFFSET)

  React.useEffect(() => {
    const update = () =>
      setOffset(Math.min(window.innerWidth * OFFSET_RATIO, MAX_OFFSET))
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return offset
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate the shortest circular offset between a card and the active card.
 *
 * For 5 cards with active=0: offsets are [0, 1, 2, -2, -1]
 * This ensures cards always fan out evenly around the focused card,
 * regardless of which card is active.
 */
function getCircularOffset(
  index: number,
  active: number,
  total: number
): number {
  let offset = index - active
  const half = total / 2
  if (offset > half) offset -= total
  if (offset < -half) offset += total
  return offset
}

/**
 * Get the rotation for a background card based on its distance from center.
 * Matches the Figma pattern where cards alternate rotation direction:
 * - ±1 cards: +4° (tilted clockwise)
 * - ±2 cards: -4° (tilted counter-clockwise)
 *
 * This creates a natural, scattered fan effect.
 */
function getRotation(offset: number): number {
  if (offset === 0) return 0
  const absOffset = Math.abs(offset)
  return absOffset % 2 === 1 ? 4 : -4
}

// =============================================================================
// COMPONENT
// =============================================================================

interface GameModeCarouselProps {
  /** Array of game mode configurations to display */
  modes: GameModeConfig[]
}

/**
 * Full-bleed card stack carousel with centered focus card and
 * frosted background cards that spread to the viewport edges.
 * Uses Motion for spring-based animations. Loops infinitely.
 */
function GameModeCarousel({ modes }: GameModeCarouselProps) {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const prevActiveRef = React.useRef(activeIndex)
  const touchStartX = React.useRef(0)
  const cardOffset = useCardOffset()

  // Track previous active index to detect wrap-around transitions
  React.useEffect(() => {
    prevActiveRef.current = activeIndex
  }, [activeIndex])

  // Navigation handlers (circular — always wraps)
  const goTo = React.useCallback(
    (index: number) => setActiveIndex(index),
    []
  )

  const goNext = React.useCallback(
    () => setActiveIndex((i) => (i + 1) % modes.length),
    [modes.length]
  )

  const goPrev = React.useCallback(
    () => setActiveIndex((i) => (i - 1 + modes.length) % modes.length),
    [modes.length]
  )

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev()
      if (e.key === "ArrowRight") goNext()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goNext, goPrev])

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (diff > 50) goNext()
    if (diff < -50) goPrev()
  }

  return (
    <div
      className="flex flex-col items-center gap-8"
      role="region"
      aria-roledescription="carousel"
      aria-label="Game modes"
    >
      {/* Card stack area — NO overflow-hidden, cards bleed to viewport edges */}
      <div
        className="relative w-full"
        style={{ height: CARD_HEIGHT }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {modes.map((mode, index) => {
          const offset = getCircularOffset(index, activeIndex, modes.length)
          const prevOffset = getCircularOffset(
            index,
            prevActiveRef.current,
            modes.length
          )
          const isFocused = offset === 0
          const absOffset = Math.abs(offset)

          // Detect if this card wrapped around the circular layout.
          // If so, teleport it instantly to avoid a visible cross-screen fly.
          const didWrap =
            Math.abs(offset - prevOffset) > Math.floor(modes.length / 2)

          return (
            <motion.div
              key={mode.id}
              className="absolute left-1/2 top-0"
              style={{ width: CARD_WIDTH }}
              animate={{
                x: -CARD_WIDTH / 2 + offset * cardOffset,
                rotate: getRotation(offset),
                zIndex: isFocused ? 20 : 10 - absOffset,
              }}
              transition={didWrap ? INSTANT : SPRING}
              onClick={() => !isFocused && goTo(index)}
              aria-label={isFocused ? undefined : `Go to ${mode.title}`}
              role={isFocused ? "group" : "button"}
              aria-roledescription={isFocused ? "slide" : undefined}
              tabIndex={isFocused ? -1 : 0}
              onKeyDown={(e) => {
                if (!isFocused && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault()
                  goTo(index)
                }
              }}
            >
              {/* White frost overlay — matches Figma rgba(255,255,255,0.56) */}
              <motion.div
                className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-white/[0.56]"
                animate={{ opacity: isFocused ? 0 : 1 }}
                transition={didWrap ? INSTANT : { duration: 0.3 }}
              />

              {/* Card content */}
              <div
                className="aspect-[362/446]"
                style={{
                  pointerEvents: isFocused ? "auto" : "none",
                  cursor: isFocused ? "default" : "pointer",
                }}
              >
                <GameModeCard mode={mode} />
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Arrow navigation — always enabled (loops infinitely) */}
      <div className="flex items-center gap-7">
        <Button
          variant="outline"
          size="icon"
          onClick={goPrev}
          aria-label="Previous game mode"
        >
          <ArrowLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={goNext}
          aria-label="Next game mode"
        >
          <ArrowRightIcon />
        </Button>
      </div>
    </div>
  )
}

export { GameModeCarousel }
