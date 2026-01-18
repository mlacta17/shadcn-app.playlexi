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
   * Get a random word from a tier, excluding specified IDs.
   * Uses SQL RANDOM() for true database-level randomization.
   * @param tier - Difficulty tier (1-7)
   * @param excludeIds - Word IDs to exclude (prevents repeats)
   */
  getRandomWord(tier: WordTier, excludeIds?: string[]): Promise<Word | undefined>
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
 * // In a Cloudflare Pages API route
 * import { getRequestContext } from "@cloudflare/next-on-pages"
 * import { createDb } from "@/db"
 * import { createD1WordDataSource } from "@/lib/services/d1-word-data-source"
 *
 * export async function GET() {
 *   const { env } = getRequestContext()
 *   const db = createDb(env.DB)
 *   const dataSource = createD1WordDataSource(db)
 *
 *   const word = await dataSource.getRandomWord(3)
 *   return Response.json(word)
 * }
 * ```
 */
export function createD1WordDataSource(db: Database): AsyncWordDataSource {
  return {
    async getWordsByTier(tier: WordTier): Promise<Word[]> {
      const rows = await db
        .select()
        .from(words)
        .where(eq(words.difficultyTier, tier))

      return rows.map(mapDbRowToWord)
    },

    async getWordById(id: string): Promise<Word | undefined> {
      const [row] = await db
        .select()
        .from(words)
        .where(eq(words.id, id))
        .limit(1)

      return row ? mapDbRowToWord(row) : undefined
    },

    async getRandomWord(tier: WordTier, excludeIds: string[] = []): Promise<Word | undefined> {
      // Build query with optional exclusion
      let query = db
        .select()
        .from(words)
        .where(
          excludeIds.length > 0
            ? and(
                eq(words.difficultyTier, tier),
                notInArray(words.id, excludeIds)
              )
            : eq(words.difficultyTier, tier)
        )
        .orderBy(sql`RANDOM()`)
        .limit(1)

      const [row] = await query

      // If no word found (all excluded), try again without exclusions
      if (!row && excludeIds.length > 0) {
        const [fallbackRow] = await db
          .select()
          .from(words)
          .where(eq(words.difficultyTier, tier))
          .orderBy(sql`RANDOM()`)
          .limit(1)

        return fallbackRow ? mapDbRowToWord(fallbackRow) : undefined
      }

      return row ? mapDbRowToWord(row) : undefined
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
