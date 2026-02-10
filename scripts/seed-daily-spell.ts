#!/usr/bin/env npx ts-node
/**
 * Daily Spell Puzzle Seeding Script
 *
 * Generates puzzles for the Daily Spell game mode.
 * Each puzzle contains 5 words with progressive difficulty:
 * 1. Easy (tier 1-2)
 * 2. Medium (tier 3-4)
 * 3. Hard (tier 5)
 * 4. Hard (tier 5-6)
 * 5. Hardest (tier 6-7)
 *
 * ## Usage
 *
 * Development (local D1):
 *   npm run db:seed:daily
 *
 * Production (remote D1):
 *   npm run db:seed:daily:prod
 *
 * Options:
 *   --days=N          Generate puzzles for next N days (default: 7)
 *   --dry-run         Show what would be done without making changes
 *   --production      Use remote D1 database
 *
 * ## Prerequisites
 *
 * 1. D1 database with words table populated
 * 2. Migrations applied (including 0008_add_daily_spell.sql)
 *
 * @see db/schema.ts for table definitions
 * @see Daily Spell feature spec
 */

import * as path from "path"
import * as dotenv from "dotenv"
import { execSync } from "child_process"

// Load environment variables
const envPath = path.resolve(__dirname, "..", ".env.local")
dotenv.config({ path: envPath })

// =============================================================================
// CLI ARGUMENTS
// =============================================================================

const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const isProduction =
  args.includes("--production") || process.env.NODE_ENV === "production"

const daysArg = args.find((a) => a.startsWith("--days="))
const daysToGenerate = daysArg ? parseInt(daysArg.split("=")[1], 10) : 7

// =============================================================================
// CONSOLE HELPERS
// =============================================================================

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
}

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green)
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red)
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow)
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.blue)
}

// =============================================================================
// D1 HELPERS
// =============================================================================

const PROJECT_ROOT = path.join(__dirname, "..")

/**
 * Execute a D1 SQL query and return results as JSON.
 */
function executeD1Query(sql: string, isRemote: boolean): unknown {
  const remoteFlag = isRemote ? "--remote" : "--local"
  // Escape single quotes by doubling them
  const escapedSql = sql.replace(/'/g, "''").replace(/"/g, '\\"')
  const command = `npx wrangler d1 execute playlexi-db ${remoteFlag} --command="${sql.replace(/"/g, '\\"')}" --json`

  try {
    const output = execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
    return JSON.parse(output)
  } catch (error) {
    const err = error as { stderr?: string; message?: string }
    throw new Error(err.stderr || err.message || "D1 query failed")
  }
}

/**
 * Execute a D1 SQL command (no JSON output).
 */
function executeD1Command(sql: string, isRemote: boolean): void {
  const remoteFlag = isRemote ? "--remote" : "--local"
  const command = `npx wrangler d1 execute playlexi-db ${remoteFlag} --command="${sql.replace(/"/g, '\\"')}"`

  try {
    execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch (error) {
    const err = error as { stderr?: string; message?: string }
    throw new Error(err.stderr || err.message || "D1 command failed")
  }
}

// =============================================================================
// WORD SELECTION
// =============================================================================

interface WordRow {
  id: string
  word: string
  difficulty_tier: number
}

/**
 * Fetch words grouped by difficulty tier.
 */
function fetchWordsByTier(isRemote: boolean): Map<number, WordRow[]> {
  const result = executeD1Query(
    "SELECT id, word, difficulty_tier FROM words ORDER BY difficulty_tier, RANDOM()",
    isRemote
  ) as { results?: WordRow[] }[]

  const wordsByTier = new Map<number, WordRow[]>()

  if (Array.isArray(result) && result[0]?.results) {
    for (const row of result[0].results) {
      const tier = row.difficulty_tier
      if (!wordsByTier.has(tier)) {
        wordsByTier.set(tier, [])
      }
      wordsByTier.get(tier)!.push(row)
    }
  }

  return wordsByTier
}

/**
 * Pick a random word from the given tiers.
 */
function pickWordFromTiers(
  wordsByTier: Map<number, WordRow[]>,
  tiers: number[],
  usedIds: Set<string>
): WordRow | null {
  for (const tier of tiers) {
    const words = wordsByTier.get(tier) || []
    const available = words.filter((w) => !usedIds.has(w.id))
    if (available.length > 0) {
      const randomIndex = Math.floor(Math.random() * available.length)
      return available[randomIndex]
    }
  }
  return null
}

/**
 * Select 5 words for a puzzle with progressive difficulty.
 *
 * Word 1: Easy (tier 1-2)
 * Word 2: Medium (tier 3-4)
 * Word 3: Hard (tier 5)
 * Word 4: Hard (tier 5-6)
 * Word 5: Hardest (tier 6-7)
 */
function selectPuzzleWords(
  wordsByTier: Map<number, WordRow[]>,
  usedIds: Set<string>
): WordRow[] {
  const difficultyProgression = [
    [1, 2],    // Word 1: Easy
    [3, 4],    // Word 2: Medium
    [5],       // Word 3: Hard
    [5, 6],    // Word 4: Hard
    [6, 7],    // Word 5: Hardest
  ]

  const selectedWords: WordRow[] = []

  for (const tiers of difficultyProgression) {
    const word = pickWordFromTiers(wordsByTier, tiers, usedIds)
    if (!word) {
      throw new Error(`No available words for tiers ${tiers.join(", ")}`)
    }
    selectedWords.push(word)
    usedIds.add(word.id)
  }

  return selectedWords
}

// =============================================================================
// PUZZLE GENERATION
// =============================================================================

/**
 * Get existing puzzle dates to avoid duplicates.
 */
function getExistingPuzzleDates(isRemote: boolean): Set<string> {
  try {
    const result = executeD1Query(
      "SELECT puzzle_date FROM daily_spell_puzzles",
      isRemote
    ) as { results?: { puzzle_date: string }[] }[]

    if (Array.isArray(result) && result[0]?.results) {
      return new Set(result[0].results.map((r) => r.puzzle_date))
    }
    return new Set()
  } catch {
    // Table might not exist yet
    return new Set()
  }
}

/**
 * Get the next puzzle number.
 */
function getNextPuzzleNumber(isRemote: boolean): number {
  try {
    const result = executeD1Query(
      "SELECT MAX(puzzle_number) as max_num FROM daily_spell_puzzles",
      isRemote
    ) as { results?: { max_num: number | string | null }[] }[]

    if (Array.isArray(result) && result[0]?.results?.[0]) {
      const maxNum = result[0].results[0].max_num
      // D1 JSON output returns "null" as a string when table is empty
      if (maxNum === null || maxNum === "null" || maxNum === undefined) {
        return 1
      }
      // Parse if it's a string number, or use directly if number
      const parsed = typeof maxNum === "string" ? parseInt(maxNum, 10) : maxNum
      if (!isNaN(parsed)) {
        return parsed + 1
      }
    }
    return 1
  } catch {
    return 1
  }
}

/**
 * Generate a UUID.
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Format date as YYYY-MM-DD.
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

/**
 * Create a puzzle for a specific date.
 */
function createPuzzle(
  date: string,
  puzzleNumber: number,
  words: WordRow[],
  isRemote: boolean,
  isDry: boolean
): void {
  const id = generateUUID()
  const wordIds = JSON.stringify(words.map((w) => w.id))

  const sql = `INSERT INTO daily_spell_puzzles (id, puzzle_date, word_ids, puzzle_number) VALUES ('${id}', '${date}', '${wordIds}', ${puzzleNumber})`

  if (isDry) {
    logInfo(`[DRY RUN] Would create puzzle #${puzzleNumber} for ${date}:`)
    words.forEach((w, i) => {
      log(`  ${i + 1}. ${w.word} (tier ${w.difficulty_tier})`, colors.dim)
    })
  } else {
    executeD1Command(sql, isRemote)
    logSuccess(`Created puzzle #${puzzleNumber} for ${date}`)
    words.forEach((w, i) => {
      log(`  ${i + 1}. ${w.word} (tier ${w.difficulty_tier})`, colors.dim)
    })
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("\n")
  log("═══════════════════════════════════════════════════════════════", colors.blue)
  log("  Daily Spell Puzzle Generator", colors.blue)
  log("═══════════════════════════════════════════════════════════════", colors.blue)
  console.log("")

  if (isDryRun) {
    logWarning("Running in DRY RUN mode - no changes will be made")
  }

  logInfo(`Environment: ${isProduction ? "PRODUCTION (remote)" : "Development (local)"}`)
  logInfo(`Days to generate: ${daysToGenerate}`)
  console.log("")

  // Fetch all words grouped by tier
  log("Fetching words from database...", colors.dim)
  const wordsByTier = fetchWordsByTier(isProduction)

  const totalWords = Array.from(wordsByTier.values()).reduce(
    (sum, words) => sum + words.length,
    0
  )
  logInfo(`Found ${totalWords} words across ${wordsByTier.size} tiers`)

  if (totalWords < 25) {
    logError("Not enough words in database. Need at least 25 words.")
    logInfo("Run 'npm run db:seed' first to populate words.")
    process.exit(1)
  }

  // Get existing puzzles to avoid duplicates
  const existingDates = getExistingPuzzleDates(isProduction)
  logInfo(`Found ${existingDates.size} existing puzzles`)

  // Determine starting puzzle number
  let puzzleNumber = getNextPuzzleNumber(isProduction)
  logInfo(`Next puzzle number: ${puzzleNumber}`)
  console.log("")

  // Track used word IDs to avoid repetition
  const usedWordIds = new Set<string>()

  // Generate puzzles for each day, starting from today (UTC)
  // Use UTC date to ensure consistency across timezones
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  let created = 0
  let skipped = 0

  for (let i = 0; i < daysToGenerate; i++) {
    const puzzleDate = new Date(todayUTC)
    puzzleDate.setUTCDate(todayUTC.getUTCDate() + i)
    const dateStr = formatDate(puzzleDate)

    if (existingDates.has(dateStr)) {
      log(`Skipping ${dateStr} - puzzle already exists`, colors.dim)
      skipped++
      continue
    }

    try {
      const words = selectPuzzleWords(wordsByTier, usedWordIds)
      createPuzzle(dateStr, puzzleNumber, words, isProduction, isDryRun)
      puzzleNumber++
      created++
    } catch (error) {
      logError(`Failed to create puzzle for ${dateStr}: ${(error as Error).message}`)
    }
  }

  console.log("")
  log("═══════════════════════════════════════════════════════════════", colors.blue)
  logSuccess(`Created: ${created} puzzles`)
  if (skipped > 0) {
    logInfo(`Skipped: ${skipped} (already exist)`)
  }
  log("═══════════════════════════════════════════════════════════════", colors.blue)
  console.log("")
}

main().catch((error) => {
  logError(`Fatal error: ${error.message}`)
  process.exit(1)
})
