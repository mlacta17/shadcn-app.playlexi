/**
 * D1 Word Data Source — Database implementation for word service.
 *
 * This module provides the Cloudflare D1 implementation of the WordDataSource interface.
 * It replaces the mock data source when USE_DATABASE is enabled in word-service.ts.
 *
 * ## Usage
 *
 * ```typescript
 * import { createD1WordDataSource } from "@/lib/services/d1-word-data-source"
 * import { createDb } from "@/db"
 *
 * // In an API route
 * const { env } = getRequestContext()
 * const db = createDb(env.DB)
 * const dataSource = createD1WordDataSource(db)
 *
 * const words = await dataSource.getWordsByTier(3)
 * ```
 *
 * ## Architecture Note
 *
 * This follows the Strategy Pattern established in word-service.ts.
 * The data source is created per-request because Cloudflare D1 bindings
 * are request-scoped in the edge runtime.
 *
 * @see lib/word-service.ts for the WordDataSource interface
 * @see db/schema.ts for the words table schema
 */

import { eq, and, notInArray, sql } from "drizzle-orm"
import type { Database } from "@/db"
import { words } from "@/db/schema"
import type { Word, WordTier } from "@/lib/word-service"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Options for fetching random words with advanced fallback behavior.
 */
export interface RandomWordOptions {
  /** Word IDs to exclude (prevents repeats within session) */
  excludeIds?: string[]
  /** Last word ID to prevent immediate consecutive repeat */
  lastWordId?: string
  /**
   * Enable adaptive tier mixing (10% chance to serve adjacent tier).
   * Keeps gameplay varied for skilled players.
   */
  enableAdaptiveMixing?: boolean
}

/**
 * Async version of WordDataSource interface for D1 queries.
 * D1 operations are asynchronous, unlike the sync mock data source.
 */
export interface AsyncWordDataSource {
  /**
   * Get all words for a specific difficulty tier.
   * @param tier - Difficulty tier (1-7)
   */
  getWordsByTier(tier: WordTier): Promise<Word[]>

  /**
   * Get a specific word by its ID.
   * @param id - Word UUID
   */
  getWordById(id: string): Promise<Word | undefined>

  /**
   * Get a random word from a tier, with fallback to adjacent tiers.
   * Uses SQL RANDOM() for true database-level randomization.
   *
   * ## Fallback Order (when tier is exhausted)
   * 1. Primary tier (requested)
   * 2. Tier + 1 (slightly harder)
   * 3. Tier - 1 (slightly easier)
   * 4. Tier + 2 (harder)
   * 5. Tier - 2 (easier)
   * 6. Any tier with available words
   * 7. Allow repeats from primary tier (last resort)
   *
   * @param tier - Difficulty tier (1-7)
   * @param options - Fetch options including exclusions and anti-repeat
   */
  getRandomWord(tier: WordTier, options?: RandomWordOptions): Promise<Word | undefined>

  /**
   * Get word count per tier (for debugging/monitoring).
   */
  getWordCountByTier(tier: WordTier): Promise<number>
}

// =============================================================================
// DATABASE ROW TO WORD MAPPING
// =============================================================================

/**
 * Map a database row to the Word interface.
 *
 * The database schema uses snake_case (difficultyTier → difficulty_tier),
 * but Drizzle maps these to camelCase in TypeScript.
 */
function mapDbRowToWord(row: typeof words.$inferSelect): Word {
  return {
    id: row.id,
    word: row.word,
    tier: row.difficultyTier as WordTier,
    definition: row.definition,
    sentence: row.exampleSentence,
    audioUrl: row.audioUrl,
    partOfSpeech: row.partOfSpeech,
  }
}

// =============================================================================
// D1 DATA SOURCE FACTORY
// =============================================================================

/**
 * Create a D1-backed word data source.
 *
 * This is the primary factory function for database access to words.
 * The returned data source implements AsyncWordDataSource.
 *
 * @param db - Drizzle database instance from createDb()
 * @returns Async word data source with D1 queries
 *
 * @example
 * ```typescript
 * // In a Cloudflare Workers API route (via OpenNext)
 * import { getCloudflareContext } from "@opennextjs/cloudflare"
 * import { createDb } from "@/db"
 * import { createD1WordDataSource } from "@/lib/services/d1-word-data-source"
 *
 * export async function GET() {
 *   const { env } = await getCloudflareContext({ async: true })
 *   const db = createDb(env.DB)
 *   const dataSource = createD1WordDataSource(db)
 *
 *   const word = await dataSource.getRandomWord(3)
 *   return Response.json(word)
 * }
 * ```
 */
export function createD1WordDataSource(db: Database): AsyncWordDataSource {
  /**
   * Internal helper: Fetch a random word from a specific tier.
   * Returns undefined if no words available after exclusions.
   */
  async function fetchFromTier(
    tier: number,
    excludeIds: string[],
    lastWordId?: string
  ): Promise<typeof words.$inferSelect | undefined> {
    // Combine exclusions: both session exclusions and last word anti-repeat
    const allExclusions = lastWordId
      ? [...excludeIds, lastWordId]
      : excludeIds

    const query = db
      .select()
      .from(words)
      .where(
        allExclusions.length > 0
          ? and(
              eq(words.difficultyTier, tier),
              notInArray(words.id, allExclusions)
            )
          : eq(words.difficultyTier, tier)
      )
      .orderBy(sql`RANDOM()`)
      .limit(1)

    const [row] = await query
    return row
  }

  /**
   * Build the fallback tier order based on primary tier.
   * Prioritizes adjacent tiers, then expands outward.
   */
  function buildFallbackOrder(primaryTier: WordTier): number[] {
    const tiers: number[] = [primaryTier]

    // Add adjacent tiers in order of preference
    // Harder tier first (challenge), then easier (confidence)
    for (let offset = 1; offset <= 6; offset++) {
      const harder = primaryTier + offset
      const easier = primaryTier - offset

      if (harder <= 7) tiers.push(harder)
      if (easier >= 1) tiers.push(easier)
    }

    return tiers
  }

  return {
    async getWordsByTier(tier: WordTier): Promise<Word[]> {
      try {
        const rows = await db
          .select()
          .from(words)
          .where(eq(words.difficultyTier, tier))

        return rows.map(mapDbRowToWord)
      } catch (error) {
        console.error("[D1] Failed to fetch words by tier:", error)
        throw new Error(`Database error: Failed to fetch words for tier ${tier}`)
      }
    },

    async getWordById(id: string): Promise<Word | undefined> {
      try {
        const [row] = await db
          .select()
          .from(words)
          .where(eq(words.id, id))
          .limit(1)

        return row ? mapDbRowToWord(row) : undefined
      } catch (error) {
        console.error("[D1] Failed to fetch word by ID:", error)
        throw new Error(`Database error: Failed to fetch word ${id}`)
      }
    },

    async getRandomWord(
      tier: WordTier,
      options: RandomWordOptions = {}
    ): Promise<Word | undefined> {
      const { excludeIds = [], lastWordId, enableAdaptiveMixing = false } = options

      try {
        console.log(
          `[D1] getRandomWord - tier=${tier}, excludeIds=${excludeIds.length}, ` +
          `lastWordId=${lastWordId ? "set" : "none"}, adaptiveMixing=${enableAdaptiveMixing}`
        )

        // Adaptive mixing: 10% chance to serve from adjacent tier (variety)
        let effectiveTier = tier
        if (enableAdaptiveMixing && Math.random() < 0.1) {
          const mixOffset = Math.random() < 0.5 ? 1 : -1
          const mixedTier = tier + mixOffset
          if (mixedTier >= 1 && mixedTier <= 7) {
            effectiveTier = mixedTier as WordTier
            console.log(`[D1] Adaptive mixing: serving tier ${effectiveTier} instead of ${tier}`)
          }
        }

        // Build fallback order starting with effective tier
        const fallbackOrder = buildFallbackOrder(effectiveTier)

        // Try each tier in order until we find an available word
        for (const tryTier of fallbackOrder) {
          const row = await fetchFromTier(tryTier, excludeIds, lastWordId)

          if (row) {
            if (tryTier !== effectiveTier) {
              console.log(`[D1] Tier ${effectiveTier} exhausted, using tier ${tryTier} fallback`)
            }
            console.log(`[D1] Found word: "${row.word}" (id=${row.id}, tier=${tryTier})`)
            return mapDbRowToWord(row)
          }
        }

        // All tiers exhausted with exclusions - allow repeats from primary tier
        // (but still exclude lastWordId to prevent immediate consecutive repeat)
        console.log(`[D1] All tiers exhausted, allowing repeats from tier ${tier}`)
        const repeatRow = await fetchFromTier(tier, [], lastWordId)

        if (repeatRow) {
          console.log(`[D1] Repeat word: "${repeatRow.word}" (id=${repeatRow.id})`)
          return mapDbRowToWord(repeatRow)
        }

        // Absolute fallback: any word from any tier (shouldn't happen with proper seeding)
        console.warn(`[D1] No words available even with repeats! Fetching any word...`)
        const [anyRow] = await db
          .select()
          .from(words)
          .orderBy(sql`RANDOM()`)
          .limit(1)

        return anyRow ? mapDbRowToWord(anyRow) : undefined
      } catch (error) {
        console.error("[D1] Failed to fetch random word:", error)
        throw new Error(`Database error: Failed to fetch random word for tier ${tier}`)
      }
    },

    async getWordCountByTier(tier: WordTier): Promise<number> {
      try {
        const result = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(words)
          .where(eq(words.difficultyTier, tier))

        return result[0]?.count ?? 0
      } catch (error) {
        console.error("[D1] Failed to get word count:", error)
        return 0
      }
    },
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Increment the times_served counter for a word.
 * Call this when a word is served to a player.
 *
 * @param db - Drizzle database instance
 * @param wordId - Word ID to update
 */
export async function incrementWordServedCount(
  db: Database,
  wordId: string
): Promise<void> {
  await db
    .update(words)
    .set({
      timesServed: sql`${words.timesServed} + 1`,
    })
    .where(eq(words.id, wordId))
}

/**
 * Update the correct rate for a word based on game results.
 * Uses exponential moving average for smooth updates.
 *
 * @param db - Drizzle database instance
 * @param wordId - Word ID to update
 * @param wasCorrect - Whether the player spelled it correctly
 */
export async function updateWordCorrectRate(
  db: Database,
  wordId: string,
  wasCorrect: boolean
): Promise<void> {
  // Fetch current rate
  const [word] = await db
    .select({ correctRate: words.correctRate, timesServed: words.timesServed })
    .from(words)
    .where(eq(words.id, wordId))
    .limit(1)

  if (!word) return

  // Calculate new rate using exponential moving average
  // Weight recent results more heavily (alpha = 0.1)
  const alpha = 0.1
  const currentRate = word.correctRate ?? 0.5
  const newResult = wasCorrect ? 1 : 0
  const newRate = currentRate * (1 - alpha) + newResult * alpha

  await db
    .update(words)
    .set({ correctRate: newRate })
    .where(eq(words.id, wordId))
}
