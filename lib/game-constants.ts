/**
 * Game Constants — PlayLexi
 *
 * Centralized constants for game mechanics, XP calculations, and tier thresholds.
 * These values are used both client-side (for display) and server-side (for validation).
 *
 * ## Why Centralize?
 * - Single source of truth for game mechanics
 * - Server can validate client-calculated values
 * - Easy to adjust game balance without hunting through files
 * - Type-safe exports prevent magic numbers
 *
 * @see db/schema.ts for RankTier type
 * @see lib/services/game-service.ts for server-side usage
 * @see hooks/use-game-session.ts for client-side usage
 */

import type { RankTier, GameMode } from "@/db/schema"

// =============================================================================
// XP THRESHOLDS
// =============================================================================

/**
 * XP required to reach each tier.
 *
 * Tier progression:
 * - new_bee: 0 XP (starting tier)
 * - bumble_bee: 100 XP
 * - busy_bee: 300 XP
 * - honey_bee: 600 XP
 * - worker_bee: 1000 XP
 * - royal_bee: 1500 XP
 * - bee_keeper: 2100 XP (max tier)
 */
export const XP_THRESHOLDS: Record<RankTier, number> = {
  new_bee: 0,
  bumble_bee: 100,
  busy_bee: 300,
  honey_bee: 600,
  worker_bee: 1000,
  royal_bee: 1500,
  bee_keeper: 2100,
} as const

/**
 * Ordered list of tiers from lowest to highest.
 * Used for tier progression calculations.
 */
export const TIER_ORDER: RankTier[] = [
  "new_bee",
  "bumble_bee",
  "busy_bee",
  "honey_bee",
  "worker_bee",
  "royal_bee",
  "bee_keeper",
] as const

// =============================================================================
// XP CALCULATION
// =============================================================================

/**
 * XP awarded per correct answer in endless mode.
 * Example: 10 correct = 50 XP
 */
export const XP_PER_CORRECT_ENDLESS = 5

/**
 * XP multiplier for blitz score.
 * Blitz score is based on speed and accuracy.
 * Example: blitzScore 15 = 30 XP
 */
export const XP_MULTIPLIER_BLITZ = 2

/**
 * Calculate XP earned from game results.
 *
 * This function MUST be used both client-side (for display) and server-side
 * (for validation) to ensure consistency.
 *
 * @param mode - Game mode
 * @param correctCount - Number of correct answers
 * @param blitzScore - Blitz-specific score (only used in blitz mode)
 * @returns Calculated XP
 *
 * @example
 * ```typescript
 * // Endless mode: 10 correct answers
 * calculateXP("endless", 10, 0) // Returns 50
 *
 * // Blitz mode: score of 25
 * calculateXP("blitz", 10, 25) // Returns 50 (blitzScore * 2)
 * ```
 */
export function calculateXP(
  mode: GameMode,
  correctCount: number,
  blitzScore: number = 0
): number {
  if (mode === "endless") {
    return correctCount * XP_PER_CORRECT_ENDLESS
  } else {
    return blitzScore * XP_MULTIPLIER_BLITZ
  }
}

// =============================================================================
// TIER UTILITIES
// =============================================================================

/**
 * Get the tier for a given XP amount.
 *
 * @param xp - Total XP
 * @returns The tier the player should be at
 *
 * @example
 * ```typescript
 * getTierForXP(0)    // "new_bee"
 * getTierForXP(150)  // "bumble_bee"
 * getTierForXP(1500) // "royal_bee"
 * getTierForXP(3000) // "bee_keeper"
 * ```
 */
export function getTierForXP(xp: number): RankTier {
  // Work backwards from highest tier to find the correct tier
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    const tier = TIER_ORDER[i]
    if (xp >= XP_THRESHOLDS[tier]) {
      return tier
    }
  }
  return "new_bee"
}

/**
 * Get progress to next tier.
 *
 * @param xp - Current XP
 * @returns Object with current tier, next tier, and progress percentage
 *
 * @example
 * ```typescript
 * getTierProgress(150)
 * // Returns: { tier: "bumble_bee", nextTier: "busy_bee", progress: 25, xpToNext: 150 }
 * ```
 */
export function getTierProgress(xp: number): {
  tier: RankTier
  nextTier: RankTier | null
  progress: number
  xpToNext: number
} {
  const tier = getTierForXP(xp)
  const tierIndex = TIER_ORDER.indexOf(tier)

  // At max tier
  if (tierIndex === TIER_ORDER.length - 1) {
    return {
      tier,
      nextTier: null,
      progress: 100,
      xpToNext: 0,
    }
  }

  const nextTier = TIER_ORDER[tierIndex + 1]
  const currentThreshold = XP_THRESHOLDS[tier]
  const nextThreshold = XP_THRESHOLDS[nextTier]
  const xpInCurrentTier = xp - currentThreshold
  const xpNeededForNext = nextThreshold - currentThreshold
  const progress = Math.floor((xpInCurrentTier / xpNeededForNext) * 100)

  return {
    tier,
    nextTier,
    progress,
    xpToNext: nextThreshold - xp,
  }
}

// =============================================================================
// GLICKO-2 CONSTANTS
// =============================================================================

/**
 * Glicko-2 system constants for skill rating updates.
 *
 * These are used by the rating update algorithm after games.
 *
 * @see ADR-012 for Glicko-2 implementation details
 */
export const GLICKO2_CONSTANTS = {
  /** Default starting rating */
  INITIAL_RATING: 1500,

  /** Max rating deviation for new players (high uncertainty) */
  INITIAL_RD: 350,

  /** Default volatility */
  INITIAL_VOLATILITY: 0.06,

  /** Min RD after many games (high confidence) */
  MIN_RD: 30,

  /** Volatility constraint (tau) - controls rating volatility changes */
  TAU: 0.5,

  /** Rating to tier mapping:
   * Tier 1 (1000-1149): new_bee
   * Tier 2 (1150-1299): bumble_bee
   * Tier 3 (1300-1449): busy_bee
   * Tier 4 (1450-1599): honey_bee (default starting)
   * Tier 5 (1600-1749): worker_bee
   * Tier 6 (1750-1899): royal_bee
   * Tier 7 (1900+): bee_keeper
   */
  TIER_RATING_RANGES: {
    1: { min: 1000, max: 1149 },
    2: { min: 1150, max: 1299 },
    3: { min: 1300, max: 1449 },
    4: { min: 1450, max: 1599 },
    5: { min: 1600, max: 1749 },
    6: { min: 1750, max: 1899 },
    7: { min: 1900, max: Infinity },
  },
} as const

/**
 * Convert Glicko-2 rating to derived tier (1-7).
 * Used for word difficulty selection.
 *
 * @param rating - Glicko-2 rating
 * @returns Tier number (1-7)
 */
export function ratingToTier(rating: number): number {
  const ranges = GLICKO2_CONSTANTS.TIER_RATING_RANGES
  for (let tier = 7; tier >= 1; tier--) {
    if (rating >= ranges[tier as keyof typeof ranges].min) {
      return tier
    }
  }
  return 1
}

/**
 * Validate a placement test tier (1-7).
 *
 * @param tier - Tier to validate
 * @returns true if valid, false otherwise
 */
export function isValidPlacementTier(tier: unknown): tier is number {
  return typeof tier === "number" && tier >= 1 && tier <= 7 && Number.isInteger(tier)
}

// =============================================================================
// GAME MECHANICS
// =============================================================================

/**
 * Default hearts in endless mode.
 */
export const ENDLESS_STARTING_HEARTS = 3

/**
 * Default time per round in blitz mode (seconds).
 */
export const BLITZ_TIME_PER_ROUND = 10

/**
 * Default total time for blitz mode (seconds).
 */
export const BLITZ_TOTAL_TIME = 60
