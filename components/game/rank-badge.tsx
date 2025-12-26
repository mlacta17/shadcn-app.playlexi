"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Rank tiers in PlayLexi progression system.
 * Order represents progression from lowest to highest rank.
 */
export type RankTier =
  | "new-bee"
  | "bumble-bee"
  | "busy-bee"
  | "honey-bee"
  | "worker-bee"
  | "royal-bee"
  | "bee-keeper"

/**
 * Human-readable labels for each rank tier.
 */
export const RANK_LABELS: Record<RankTier, string> = {
  "new-bee": "New Bee",
  "bumble-bee": "Bumble Bee",
  "busy-bee": "Busy Bee",
  "honey-bee": "Honey Bee",
  "worker-bee": "Worker Bee",
  "royal-bee": "Royal Bee",
  "bee-keeper": "Bee Keeper",
}

/**
 * Badge asset paths - all badges should be in public/badges/
 *
 * File naming convention: {rank}-{mode}.svg
 * Example: new-bee-light.svg, new-bee-dark.svg
 *
 * Required files (14 total):
 * - new-bee-light.svg, new-bee-dark.svg
 * - bumble-bee-light.svg, bumble-bee-dark.svg
 * - busy-bee-light.svg, busy-bee-dark.svg
 * - honey-bee-light.svg, honey-bee-dark.svg
 * - worker-bee-light.svg, worker-bee-dark.svg
 * - royal-bee-light.svg, royal-bee-dark.svg
 * - bee-keeper-light.svg, bee-keeper-dark.svg
 */
const BADGE_PATHS: Record<RankTier, { light: string; dark: string }> = {
  "new-bee": {
    light: "/badges/new-bee-light.svg",
    dark: "/badges/new-bee-dark.svg",
  },
  "bumble-bee": {
    light: "/badges/bumble-bee-light.svg",
    dark: "/badges/bumble-bee-dark.svg",
  },
  "busy-bee": {
    light: "/badges/busy-bee-light.svg",
    dark: "/badges/busy-bee-dark.svg",
  },
  "honey-bee": {
    light: "/badges/honey-bee-light.svg",
    dark: "/badges/honey-bee-dark.svg",
  },
  "worker-bee": {
    light: "/badges/worker-bee-light.svg",
    dark: "/badges/worker-bee-dark.svg",
  },
  "royal-bee": {
    light: "/badges/royal-bee-light.svg",
    dark: "/badges/royal-bee-dark.svg",
  },
  "bee-keeper": {
    light: "/badges/bee-keeper-light.svg",
    dark: "/badges/bee-keeper-dark.svg",
  },
}

/**
 * Size presets for RankBadge.
 * Values represent width/height in pixels.
 */
const BADGE_SIZES = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
} as const

export type BadgeSize = keyof typeof BADGE_SIZES

export interface RankBadgeProps {
  /** The rank tier to display */
  rank: RankTier
  /** Badge size preset. Default: "md" */
  size?: BadgeSize
  /** Force light or dark mode. If not set, uses CSS to show appropriate variant */
  mode?: "light" | "dark"
  /** Additional CSS classes */
  className?: string
}

/**
 * Displays a rank badge for the PlayLexi progression system.
 *
 * This component handles:
 * - 7 rank tiers from New Bee to Bee Keeper
 * - Light/dark mode variants (auto-switches with theme)
 * - Multiple size presets
 * - Accessible alt text
 *
 * ## Asset Requirements
 * Place SVG files in `public/badges/` with naming convention:
 * `{rank}-{mode}.svg` (e.g., `new-bee-light.svg`)
 *
 * ## Usage
 * ```tsx
 * import { RankBadge } from "@/components/game"
 *
 * // Basic usage - auto theme switching
 * <RankBadge rank="honey-bee" />
 *
 * // With size
 * <RankBadge rank="royal-bee" size="lg" />
 *
 * // Force specific mode
 * <RankBadge rank="bee-keeper" mode="dark" />
 * ```
 *
 * @see COMPONENT_INVENTORY.md for component details
 */
function RankBadge({
  rank,
  size = "md",
  mode,
  className,
}: RankBadgeProps) {
  const paths = BADGE_PATHS[rank]
  const dimensions = BADGE_SIZES[size]
  const label = RANK_LABELS[rank]

  // If mode is forced, show only that variant
  if (mode) {
    return (
      <Image
        src={paths[mode]}
        alt={`${label} rank badge`}
        width={dimensions}
        height={dimensions}
        className={cn("inline-block", className)}
      />
    )
  }

  // Auto theme switching: show light in light mode, dark in dark mode
  // Uses CSS to toggle visibility based on theme
  return (
    <span className={cn("inline-block relative", className)}>
      {/* Light mode badge */}
      <Image
        src={paths.light}
        alt={`${label} rank badge`}
        width={dimensions}
        height={dimensions}
        className="dark:hidden"
      />
      {/* Dark mode badge */}
      <Image
        src={paths.dark}
        alt={`${label} rank badge`}
        width={dimensions}
        height={dimensions}
        className="hidden dark:block absolute inset-0"
      />
    </span>
  )
}

export { RankBadge, BADGE_PATHS, BADGE_SIZES }
