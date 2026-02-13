/**
 * Puzzle Generator — PlayLexi
 *
 * Shared puzzle generation logic used by:
 * 1. On-demand fallback in getTodayPuzzle() (game never breaks)
 * 2. Admin API endpoint for bulk pre-generation
 *
 * Ported from scripts/seed-daily-spell.ts to use Drizzle ORM
 * instead of execSync + wrangler CLI, so it runs in Workers runtime.
 *
 * @see scripts/seed-daily-spell.ts (original CLI version)
 * @see db/schema.ts (dailySpellPuzzles table)
 */

import { eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { dailySpellPuzzles, words } from "@/db/schema"

// =============================================================================
// TYPES
// =============================================================================

interface WordRow {
  id: string
  word: string
  difficultyTier: number
}

export interface GenerationResult {
  created: number
  skipped: number
  errors: string[]
}

// =============================================================================
// DIFFICULTY PROGRESSION
// =============================================================================

/**
 * 5 slots with progressive difficulty:
 * Word 1: Easy (tier 1-2)
 * Word 2: Medium (tier 3-4)
 * Word 3: Hard (tier 5)
 * Word 4: Hard (tier 5-6)
 * Word 5: Hardest (tier 6-7)
 */
const DIFFICULTY_PROGRESSION = [
  [1, 2],
  [3, 4],
  [5],
  [5, 6],
  [6, 7],
]

// =============================================================================
// WORD SELECTION
// =============================================================================

/**
 * Fetch all words grouped by difficulty tier.
 */
async function fetchWordsByTier(
  orm: ReturnType<typeof drizzle>
): Promise<Map<number, WordRow[]>> {
  const allWords = await orm
    .select({
      id: words.id,
      word: words.word,
      difficultyTier: words.difficultyTier,
    })
    .from(words)

  const wordsByTier = new Map<number, WordRow[]>()
  for (const row of allWords) {
    const tier = row.difficultyTier
    if (!wordsByTier.has(tier)) {
      wordsByTier.set(tier, [])
    }
    wordsByTier.get(tier)!.push(row)
  }

  return wordsByTier
}

/**
 * Pick a random word from the given tiers, avoiding already-used IDs.
 */
function pickWordFromTiers(
  wordsByTier: Map<number, WordRow[]>,
  tiers: number[],
  usedIds: Set<string>
): WordRow | null {
  for (const tier of tiers) {
    const tierWords = wordsByTier.get(tier) || []
    const available = tierWords.filter((w) => !usedIds.has(w.id))
    if (available.length > 0) {
      const idx = Math.floor(Math.random() * available.length)
      return available[idx]
    }
  }
  return null
}

/**
 * Select 5 words for a puzzle with progressive difficulty.
 */
function selectPuzzleWords(
  wordsByTier: Map<number, WordRow[]>,
  usedIds: Set<string>
): WordRow[] {
  const selected: WordRow[] = []

  for (const tiers of DIFFICULTY_PROGRESSION) {
    const word = pickWordFromTiers(wordsByTier, tiers, usedIds)
    if (!word) {
      throw new Error(`No available words for tiers ${tiers.join(", ")}`)
    }
    selected.push(word)
    usedIds.add(word.id)
  }

  return selected
}

// =============================================================================
// PUZZLE GENERATION
// =============================================================================

/**
 * Get the next puzzle number (MAX + 1).
 */
async function getNextPuzzleNumber(
  orm: ReturnType<typeof drizzle>
): Promise<number> {
  const result = await orm
    .select({ maxNum: sql<number | null>`MAX(${dailySpellPuzzles.puzzleNumber})` })
    .from(dailySpellPuzzles)
    .get()

  const maxNum = result?.maxNum
  if (maxNum === null || maxNum === undefined) {
    return 1
  }
  return maxNum + 1
}

/**
 * Generate a single puzzle for a specific date.
 *
 * Returns the puzzle ID if created, or null if it already exists
 * (another request beat us — UNIQUE constraint on puzzle_date).
 */
export async function generatePuzzleForDate(
  db: D1Database,
  date: string
): Promise<string | null> {
  const orm = drizzle(db)

  // Check if puzzle already exists for this date
  const existing = await orm
    .select({ id: dailySpellPuzzles.id })
    .from(dailySpellPuzzles)
    .where(eq(dailySpellPuzzles.puzzleDate, date))
    .get()

  if (existing) {
    return null // Already exists
  }

  // Fetch words and select 5 with progressive difficulty
  const wordsByTier = await fetchWordsByTier(orm)
  const usedIds = new Set<string>()
  const selectedWords = selectPuzzleWords(wordsByTier, usedIds)

  // Get next puzzle number
  const puzzleNumber = await getNextPuzzleNumber(orm)

  // Build the puzzle
  const puzzleId = crypto.randomUUID()
  const wordIds = JSON.stringify(selectedWords.map((w) => w.id))

  try {
    await orm.insert(dailySpellPuzzles).values({
      id: puzzleId,
      puzzleDate: date,
      wordIds,
      puzzleNumber,
    })

    console.log(
      `[PuzzleGenerator] Created puzzle #${puzzleNumber} for ${date}:`,
      selectedWords.map((w) => `${w.word}(T${w.difficultyTier})`).join(", ")
    )

    return puzzleId
  } catch (error) {
    // UNIQUE constraint violation — another concurrent request created it
    const message = (error as Error).message || ""
    if (message.includes("UNIQUE") || message.includes("unique")) {
      console.log(`[PuzzleGenerator] Puzzle for ${date} created by concurrent request`)
      return null
    }
    throw error
  }
}

/**
 * Generate puzzles for a range of dates (bulk pre-generation).
 *
 * Starts from `startDate` and generates `days` consecutive puzzles.
 * Idempotent — skips dates that already have puzzles.
 */
export async function generatePuzzlesForDateRange(
  db: D1Database,
  startDate: string,
  days: number
): Promise<GenerationResult> {
  const result: GenerationResult = { created: 0, skipped: 0, errors: [] }

  const start = new Date(startDate + "T00:00:00Z")

  for (let i = 0; i < days; i++) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + i)
    const dateStr = date.toISOString().split("T")[0]

    try {
      const puzzleId = await generatePuzzleForDate(db, dateStr)
      if (puzzleId) {
        result.created++
      } else {
        result.skipped++
      }
    } catch (error) {
      const msg = `${dateStr}: ${(error as Error).message}`
      console.error(`[PuzzleGenerator] Failed for ${dateStr}:`, error)
      result.errors.push(msg)
    }
  }

  return result
}
