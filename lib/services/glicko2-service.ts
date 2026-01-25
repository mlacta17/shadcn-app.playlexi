/**
 * Glicko-2 Rating Service — PlayLexi
 *
 * Implements the Glicko-2 rating algorithm for hidden skill ratings.
 * This system determines word difficulty selection and matchmaking.
 *
 * ## Overview
 *
 * Glicko-2 is an improvement over the Elo rating system that tracks:
 * - Rating (μ): Player's estimated skill level
 * - Rating Deviation (RD/φ): Uncertainty in the rating
 * - Volatility (σ): Expected fluctuation in player's performance
 *
 * ## How It Works in PlayLexi
 *
 * After each game, we update the player's rating based on:
 * - Expected performance (based on word difficulty vs player rating)
 * - Actual performance (% correct answers)
 *
 * The rating update considers:
 * - Beating higher-tier words = larger rating increase
 * - Losing to lower-tier words = larger rating decrease
 * - RD decreases over time (more games = more certainty)
 *
 * ## Algorithm Reference
 *
 * Based on Mark Glickman's Glicko-2 algorithm:
 * http://www.glicko.net/glicko/glicko2.pdf
 *
 * @see ADR-012 (Hidden Skill Rating System - Glicko-2)
 * @see lib/game-constants.ts for GLICKO2_CONSTANTS
 */

import type { D1Database } from "@cloudflare/workers-types"
import { drizzle } from "drizzle-orm/d1"
import { eq, and } from "drizzle-orm"
import * as schema from "@/db/schema"
import type { RankTrack } from "@/db/schema"
import { GLICKO2_CONSTANTS, ratingToTier } from "@/lib/game-constants"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of a game for rating calculation.
 */
export interface GameResult {
  /** Number of correct answers */
  correct: number
  /** Number of wrong answers */
  wrong: number
  /** Average tier of words faced (for opponent rating estimation) */
  averageWordTier: number
}

/**
 * Updated rating values after processing a game.
 */
export interface RatingUpdate {
  /** New rating */
  rating: number
  /** New rating deviation */
  ratingDeviation: number
  /** New volatility */
  volatility: number
  /** New derived tier (1-7) */
  derivedTier: number
  /** Rating change (positive or negative) */
  ratingChange: number
}

// =============================================================================
// GLICKO-2 MATH HELPERS
// =============================================================================

const PI_SQUARED = Math.PI * Math.PI
const TAU = GLICKO2_CONSTANTS.TAU

/**
 * Convert rating to Glicko-2 scale (μ).
 * Glicko-2 uses a different internal scale.
 */
function toGlicko2Scale(rating: number): number {
  return (rating - 1500) / 173.7178
}

/**
 * Convert rating from Glicko-2 scale back to normal scale.
 */
function fromGlicko2Scale(mu: number): number {
  return mu * 173.7178 + 1500
}

/**
 * Convert RD to Glicko-2 scale (φ).
 */
function rdToGlicko2Scale(rd: number): number {
  return rd / 173.7178
}

/**
 * Convert RD from Glicko-2 scale back to normal scale.
 */
function rdFromGlicko2Scale(phi: number): number {
  return phi * 173.7178
}

/**
 * Calculate g(φ) function used in Glicko-2.
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / PI_SQUARED)
}

/**
 * Calculate expected score E(μ, μj, φj).
 */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)))
}

/**
 * Estimate opponent rating from word tier.
 * Words are treated as "opponents" with ratings based on their difficulty.
 */
function tierToRating(tier: number): number {
  const ranges = GLICKO2_CONSTANTS.TIER_RATING_RANGES
  const range = ranges[tier as keyof typeof ranges]
  if (!range) return 1500
  // Use midpoint of range as the "opponent" rating
  return (range.min + Math.min(range.max, 2000)) / 2
}

// =============================================================================
// CORE ALGORITHM
// =============================================================================

/**
 * Calculate updated Glicko-2 rating after a game.
 *
 * Simplified implementation that treats each word as an "opponent":
 * - Correct answer = win (score = 1)
 * - Wrong answer = loss (score = 0)
 *
 * @param currentRating - Current player rating
 * @param currentRD - Current rating deviation
 * @param currentVolatility - Current volatility
 * @param result - Game result with correct/wrong counts and word difficulty
 * @returns Updated rating values
 */
export function calculateRatingUpdate(
  currentRating: number,
  currentRD: number,
  currentVolatility: number,
  result: GameResult
): RatingUpdate {
  const totalGames = result.correct + result.wrong

  // If no games played, just increase RD slightly (rating decay)
  if (totalGames === 0) {
    const newRD = Math.min(
      GLICKO2_CONSTANTS.INITIAL_RD,
      Math.sqrt(currentRD * currentRD + currentVolatility * currentVolatility)
    )
    return {
      rating: currentRating,
      ratingDeviation: newRD,
      volatility: currentVolatility,
      derivedTier: ratingToTier(currentRating),
      ratingChange: 0,
    }
  }

  // Convert to Glicko-2 scale
  const mu = toGlicko2Scale(currentRating)
  const phi = rdToGlicko2Scale(currentRD)
  const sigma = currentVolatility

  // Estimate opponent (word difficulty) rating and RD
  const opponentRating = tierToRating(result.averageWordTier)
  const opponentMu = toGlicko2Scale(opponentRating)
  const opponentPhi = rdToGlicko2Scale(50) // Low RD = we're confident about word difficulty

  // Calculate variance (v)
  const gPhi = g(opponentPhi)
  const expectedScore = E(mu, opponentMu, opponentPhi)
  const variance = 1 / (gPhi * gPhi * expectedScore * (1 - expectedScore) * totalGames)

  // Calculate delta (improvement estimate)
  const actualScore = result.correct / totalGames
  const delta = variance * gPhi * (actualScore - expectedScore) * totalGames

  // Step 5: Volatility update (simplified - using Newton-Raphson iteration)
  let newSigma = sigma

  // Simplified volatility update (avoids complex iteration)
  // In practice, volatility changes slowly
  const deltaSquared = delta * delta
  const phiSquared = phi * phi
  const a = Math.log(sigma * sigma)

  // Illinois algorithm for finding new sigma
  const f = (x: number): number => {
    const expX = Math.exp(x)
    const term1 = (expX * (deltaSquared - phiSquared - variance - expX)) /
      (2 * Math.pow(phiSquared + variance + expX, 2))
    const term2 = (x - a) / (TAU * TAU)
    return term1 - term2
  }

  // Bracket and iterate (simplified - just a few iterations)
  let A = a
  let B = deltaSquared > phiSquared + variance
    ? Math.log(deltaSquared - phiSquared - variance)
    : a - 10 * TAU

  let fA = f(A)
  let fB = f(B)

  // Iterate up to 20 times
  for (let i = 0; i < 20 && Math.abs(B - A) > 0.000001; i++) {
    const C = A + (A - B) * fA / (fB - fA)
    const fC = f(C)

    if (fC * fB <= 0) {
      A = B
      fA = fB
    } else {
      fA = fA / 2
    }
    B = C
    fB = fC
  }

  newSigma = Math.exp(A / 2)

  // Step 6: Update phi* (pre-rating period phi)
  const phiStar = Math.sqrt(phiSquared + newSigma * newSigma)

  // Step 7: Update rating and RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / variance)
  const newMu = mu + newPhi * newPhi * gPhi * (actualScore - expectedScore) * totalGames

  // Convert back from Glicko-2 scale
  const newRating = fromGlicko2Scale(newMu)
  const newRD = rdFromGlicko2Scale(newPhi)

  // Clamp RD to valid range
  const clampedRD = Math.max(
    GLICKO2_CONSTANTS.MIN_RD,
    Math.min(GLICKO2_CONSTANTS.INITIAL_RD, newRD)
  )

  // Clamp rating to reasonable range (1000-2000)
  const clampedRating = Math.max(1000, Math.min(2000, newRating))

  return {
    rating: clampedRating,
    ratingDeviation: clampedRD,
    volatility: newSigma,
    derivedTier: ratingToTier(clampedRating),
    ratingChange: clampedRating - currentRating,
  }
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Update user's skill rating after a game.
 *
 * @param d1 - D1 database binding
 * @param userId - User ID
 * @param track - Rank track
 * @param result - Game result
 * @returns Updated rating values
 *
 * @example
 * ```typescript
 * const update = await updateSkillRating(env.DB, userId, "endless_voice", {
 *   correct: 15,
 *   wrong: 3,
 *   averageWordTier: 4,
 * })
 * console.log(`Rating change: ${update.ratingChange}`)
 * ```
 */
export async function updateSkillRating(
  d1: D1Database,
  userId: string,
  track: RankTrack,
  result: GameResult
): Promise<RatingUpdate | null> {
  const db = drizzle(d1, { schema })

  // Get current skill rating
  const current = await db.query.userSkillRatings.findFirst({
    where: and(
      eq(schema.userSkillRatings.userId, userId),
      eq(schema.userSkillRatings.track, track)
    ),
  })

  if (!current) {
    console.warn(`[Glicko2] No skill rating found for user ${userId} on track ${track}`)
    return null
  }

  // Calculate new rating
  const update = calculateRatingUpdate(
    current.rating,
    current.ratingDeviation,
    current.volatility,
    result
  )

  // Update database
  await db
    .update(schema.userSkillRatings)
    .set({
      rating: update.rating,
      ratingDeviation: update.ratingDeviation,
      volatility: update.volatility,
      derivedTier: update.derivedTier,
      gamesPlayed: current.gamesPlayed + 1,
      lastPlayedAt: new Date(),
      seasonHighestRating: Math.max(current.seasonHighestRating ?? 1500, update.rating),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.userSkillRatings.userId, userId),
        eq(schema.userSkillRatings.track, track)
      )
    )

  return update
}
