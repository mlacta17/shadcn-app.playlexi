/**
 * Game Mode Card — PlayLexi
 *
 * A visually rich card representing a single game mode on the dashboard.
 * Each card features an illustration over a colored background with a dark
 * gradient fade, title, and description — all matching the Figma designs.
 *
 * ## Visual Structure
 * ```
 * ┌──────────────────────────┐
 * │  [Badge]                 │ ← Optional "Coming soon" badge
 * │                          │
 * │      Illustration        │ ← Fills top ~60%, over accent color
 * │                          │
 * │ ░░░░ gradient fade ░░░░░ │ ← Dark gradient overlay
 * │                          │
 * │       Title              │ ← White, 20px, semibold
 * │    Description text      │ ← White, 14px, regular
 * └──────────────────────────┘
 * ```
 *
 * ## Usage
 * ```tsx
 * import { GAME_MODES } from "@/lib/game-modes"
 *
 * <GameModeCard mode={GAME_MODES[0]} />
 * ```
 *
 * @see lib/game-modes.ts for game mode configuration
 * @see Figma nodes 3021:14636, 3024:42384, 3021:14627, 3021:14616
 */

import Link from "next/link"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { GameModeConfig } from "@/lib/game-modes"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Dark gradient that fades from transparent to dark at the bottom.
 * Makes white text readable over any accent color + illustration.
 *
 * Matches Figma: transparent 35% → 35% opacity at 67.5% → solid dark at 100%
 */
const CARD_GRADIENT =
  "linear-gradient(rgba(20, 19, 19, 0) 35%, rgba(20, 19, 19, 0.35) 67.5%, rgb(20, 19, 19) 100%)"

// =============================================================================
// COMPONENT
// =============================================================================

interface GameModeCardProps {
  /** Game mode configuration from GAME_MODES */
  mode: GameModeConfig
  /** Additional class names for the card container */
  className?: string
}

/**
 * A game mode card for the dashboard carousel.
 *
 * - Playable modes (with `href`) render as a Link for navigation
 * - Coming-soon modes render as a div with reduced opacity
 * - The illustration fills the top portion via `object-cover`
 * - The dark gradient ensures text readability over any background
 */
function GameModeCard({ mode, className }: GameModeCardProps) {
  const { title, description, illustration, accentColor, href, badge } = mode
  const isPlayable = !!href

  const cardContent = (
    <>
      {/* Illustration Area — fills top portion of card */}
      <div className="relative w-full flex-1 min-h-[1px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={illustration}
          alt={`${title} illustration`}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />

        {/* "Coming soon" badge — positioned top-left over the illustration */}
        {badge && (
          <Badge
            variant="secondary"
            className="absolute left-4 top-4 z-10"
          >
            {badge}
          </Badge>
        )}
      </div>

      {/* Text Section — fixed height, white text on dark background */}
      <div className="flex shrink-0 flex-col gap-2 px-7 pb-8 pt-6 text-center text-white">
        <h3 className="truncate text-xl font-semibold leading-7">
          {title}
        </h3>
        <p className="text-sm leading-5">
          {description}
        </p>
      </div>
    </>
  )

  // Shared styles for both Link and div variants
  const sharedClasses = cn(
    // Layout
    "flex flex-col items-center overflow-hidden rounded-3xl",
    // Full size of parent container
    "h-full w-full",
    // Disabled state for coming-soon modes
    !isPlayable && "pointer-events-none",
    className
  )

  // Inline style for accent color + gradient
  // The gradient sits on top of the solid accent color
  const backgroundStyle = {
    backgroundImage: `${CARD_GRADIENT}, linear-gradient(90deg, ${accentColor} 0%, ${accentColor} 100%)`,
  }

  if (isPlayable) {
    return (
      <Link
        href={href}
        className={cn(
          sharedClasses,
          // Interactive states
          "transition-transform duration-200",
          "hover:scale-[1.02] active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        style={backgroundStyle}
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <div
      className={sharedClasses}
      style={backgroundStyle}
      aria-disabled="true"
    >
      {cardContent}
    </div>
  )
}

export { GameModeCard }
