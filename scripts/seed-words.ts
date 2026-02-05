#!/usr/bin/env npx ts-node
/**
 * Word Seeding Script
 *
 * Populates the D1 database with words from the Merriam-Webster API.
 * Downloads audio files and uploads them to R2 storage.
 *
 * ## Usage
 *
 * Development (local D1 + skip R2):
 *   npm run db:seed
 *
 * Production (remote D1 + R2):
 *   npm run db:seed:prod
 *
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --tier=N        Only seed words for tier N (1-7)
 *   --skip-audio    Skip downloading/uploading audio files
 *   --limit=N       Limit to N words per tier
 *
 * ## Prerequisites
 *
 * 1. MW API keys in .env.local:
 *    - MERRIAM_WEBSTER_LEARNERS_KEY
 *    - MERRIAM_WEBSTER_COLLEGIATE_KEY
 *
 * 2. For R2 uploads (production):
 *    - R2_ACCOUNT_ID
 *    - R2_ACCESS_KEY_ID
 *    - R2_SECRET_ACCESS_KEY
 *
 * 3. D1 database created and migrations applied
 *
 * @see docs/SETUP.md for full setup instructions
 */

import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"

// Load environment variables FIRST, before importing modules that use them
const envPath = path.resolve(__dirname, "..", ".env.local")
console.log(`Loading env from: ${envPath}`)
const result = dotenv.config({ path: envPath })
if (result.error) {
  console.error("Failed to load .env.local:", result.error.message)
}

import {
  fetchWordData,
  downloadAudio,
  isApiError,
  type WordData,
} from "./lib/merriam-webster"
import {
  uploadWordAudio,
  getAudioKey,
  getPublicUrl,
  isR2Configured,
} from "./lib/r2-upload"

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const skipAudio = args.includes("--skip-audio")
const isProduction = args.includes("--production") || process.env.NODE_ENV === "production"

const tierArg = args.find((a) => a.startsWith("--tier="))
const tierFilter = tierArg ? parseInt(tierArg.split("=")[1], 10) : null

const limitArg = args.find((a) => a.startsWith("--limit="))
const limitPerTier = limitArg ? parseInt(limitArg.split("=")[1], 10) : null

const skipExisting = args.includes("--skip-existing")

// Paths
const SEED_FILE = path.join(__dirname, "..", "data", "seed-words.json")
const PROJECT_ROOT = path.join(__dirname, "..")

// Colors for console output
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

interface SeedWordFile {
  tiers: Record<
    string,
    {
      name: string
      description: string
      words: string[]
    }
  >
}

interface SeedResult {
  word: string
  tier: number
  success: boolean
  error?: string
  hasAudio: boolean
}

/**
 * Execute a D1 SQL command using Wrangler.
 */
function executeD1Query(sql: string, isRemote: boolean): string {
  const remoteFlag = isRemote ? "--remote" : "--local"
  const escapedSql = sql.replace(/"/g, '\\"')
  const command = `npx wrangler d1 execute playlexi-db ${remoteFlag} --command="${escapedSql}" --json`

  try {
    return execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch (error) {
    const err = error as { stderr?: string; message?: string }
    throw new Error(err.stderr || err.message || "D1 command failed")
  }
}

/**
 * Fetch existing words from the database.
 */
function fetchExistingWords(isRemote: boolean): Set<string> {
  try {
    const output = executeD1Query("SELECT word FROM words", isRemote)
    const parsed = JSON.parse(output)
    if (Array.isArray(parsed) && parsed[0]?.results) {
      return new Set(parsed[0].results.map((r: { word: string }) => r.word.toLowerCase()))
    }
    return new Set()
  } catch {
    logWarning("Could not fetch existing words, will process all")
    return new Set()
  }
}

/**
 * Execute a D1 SQL command using Wrangler (for inserts/updates).
 */
function executeD1Sql(sql: string, isRemote: boolean): string {
  const remoteFlag = isRemote ? "--remote" : "--local"
  const escapedSql = sql.replace(/"/g, '\\"')
  const command = `npx wrangler d1 execute playlexi-db ${remoteFlag} --command="${escapedSql}"`

  try {
    return execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })
  } catch (error) {
    const err = error as { stderr?: string; message?: string }
    throw new Error(err.stderr || err.message || "D1 command failed")
  }
}

/**
 * Insert a word into the D1 database.
 */
async function insertWord(
  wordData: WordData,
  tier: number,
  audioUrl: string,
  isRemote: boolean
): Promise<void> {
  // Escape single quotes for SQL
  const escapeStr = (s: string) => s.replace(/'/g, "''")

  const sql = `
    INSERT OR REPLACE INTO words (
      id, word, difficulty_tier, definition, example_sentence,
      audio_url, part_of_speech, syllables, etymology, times_served, created_at
    ) VALUES (
      lower(hex(randomblob(16))),
      '${escapeStr(wordData.word)}',
      ${tier},
      '${escapeStr(wordData.definition)}',
      '${escapeStr(wordData.exampleSentence)}',
      '${escapeStr(audioUrl)}',
      '${escapeStr(wordData.partOfSpeech)}',
      ${wordData.syllables ?? "NULL"},
      ${wordData.etymology ? `'${escapeStr(wordData.etymology)}'` : "NULL"},
      0,
      unixepoch()
    )
  `.trim()

  if (isDryRun) {
    log(`  [DRY RUN] Would insert: ${wordData.word}`, colors.dim)
    return
  }

  executeD1Sql(sql, isRemote)
}

/**
 * Process a single word: fetch from MW, download audio, upload to R2, insert to D1.
 */
async function processWord(
  word: string,
  tier: number,
  isRemote: boolean
): Promise<SeedResult> {
  const result: SeedResult = {
    word,
    tier,
    success: false,
    hasAudio: false,
  }

  try {
    // Fetch word data from Merriam-Webster
    const wordData = await fetchWordData(word)

    if (isApiError(wordData)) {
      result.error = wordData.error
      if (wordData.suggestions?.length) {
        result.error += ` (suggestions: ${wordData.suggestions.join(", ")})`
      }
      return result
    }

    // Handle audio
    let audioUrl = "/api/assets/audio/placeholder.mp3" // Fallback

    if (!skipAudio && wordData.audioUrl) {
      if (isR2Configured() && !isDryRun) {
        // Download and upload to R2
        const audioBuffer = await downloadAudio(wordData.audioUrl)
        if (audioBuffer) {
          audioUrl = await uploadWordAudio(word, audioBuffer)
          result.hasAudio = true
        } else {
          logWarning(`  Could not download audio for "${word}"`)
        }
      } else if (!isR2Configured()) {
        // Use the direct MW URL or a placeholder
        // In production, we'd want R2 configured
        audioUrl = getPublicUrl(getAudioKey(word))
        if (isDryRun) {
          log(`  [DRY RUN] Would upload audio to: ${audioUrl}`, colors.dim)
        }
      }
    }

    // Insert into database
    await insertWord(wordData, tier, audioUrl, isRemote)

    result.success = true
    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error"
    return result
  }
}

/**
 * Main seeding function.
 */
async function main() {
  log("\n╔════════════════════════════════════════════════════════════╗")
  log("║         PlayLexi Word Seeding Script                       ║")
  log("╚════════════════════════════════════════════════════════════╝\n")

  // Show configuration
  logInfo(`Mode: ${isProduction ? "PRODUCTION (remote D1)" : "DEVELOPMENT (local D1)"}`)
  if (isDryRun) logWarning("DRY RUN - no changes will be made")
  if (skipAudio) logWarning("Skipping audio download/upload")
  if (tierFilter) logInfo(`Filtering to tier ${tierFilter} only`)
  if (limitPerTier) logInfo(`Limiting to ${limitPerTier} words per tier`)
  if (skipExisting) logInfo("Skipping words already in database")
  logInfo(`R2 configured: ${isR2Configured() ? "yes" : "no (using placeholder URLs)"}`)
  console.log("")

  // Check prerequisites
  if (!process.env.MERRIAM_WEBSTER_LEARNERS_KEY || !process.env.MERRIAM_WEBSTER_COLLEGIATE_KEY) {
    logError("Missing MW API keys. Set MERRIAM_WEBSTER_LEARNERS_KEY and MERRIAM_WEBSTER_COLLEGIATE_KEY in .env.local")
    process.exit(1)
  }

  // Load seed words
  if (!fs.existsSync(SEED_FILE)) {
    logError(`Seed file not found: ${SEED_FILE}`)
    process.exit(1)
  }

  const seedData: SeedWordFile = JSON.parse(fs.readFileSync(SEED_FILE, "utf-8"))
  const isRemote = isProduction

  // Fetch existing words if skip-existing is enabled
  let existingWords: Set<string> = new Set()
  if (skipExisting) {
    log("Fetching existing words from database...", colors.dim)
    existingWords = fetchExistingWords(isRemote)
    logInfo(`Found ${existingWords.size} existing words in database`)
  }

  // Process each tier
  const results: SeedResult[] = []
  let skippedCount = 0
  const tiers = Object.entries(seedData.tiers)
    .filter(([tier]) => !tierFilter || parseInt(tier, 10) === tierFilter)
    .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))

  for (const [tierStr, tierData] of tiers) {
    const tier = parseInt(tierStr, 10)
    let words = limitPerTier ? tierData.words.slice(0, limitPerTier) : tierData.words

    // Filter out existing words if skip-existing is enabled
    if (skipExisting) {
      const originalCount = words.length
      words = words.filter(w => !existingWords.has(w.toLowerCase()))
      const tierSkipped = originalCount - words.length
      skippedCount += tierSkipped
      if (tierSkipped > 0) {
        logInfo(`Tier ${tier}: Skipping ${tierSkipped} existing words`)
      }
    }

    if (words.length === 0) {
      log(`\n━━━ Tier ${tier}: ${tierData.name} (all words already exist) ━━━`, colors.dim)
      continue
    }

    log(`\n━━━ Tier ${tier}: ${tierData.name} (${words.length} new words) ━━━`, colors.blue)

    for (const word of words) {
      process.stdout.write(`  Processing "${word}"... `)

      const result = await processWord(word, tier, isRemote)
      results.push(result)

      if (result.success) {
        console.log(colors.green + "✓" + colors.reset + (result.hasAudio ? " (with audio)" : ""))
      } else {
        console.log(colors.red + "✗" + colors.reset + ` ${result.error}`)
      }

      // Rate limiting: MW API has limits, so add a small delay
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  // Summary
  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)
  const withAudio = results.filter((r) => r.hasAudio)

  log("\n╔════════════════════════════════════════════════════════════╗")
  log("║                      SUMMARY                               ║")
  log("╚════════════════════════════════════════════════════════════╝")
  if (skippedCount > 0) {
    logInfo(`Skipped (already in DB): ${skippedCount}`)
  }
  logSuccess(`Successful: ${successful.length}/${results.length}`)
  if (withAudio.length > 0) {
    logInfo(`With audio: ${withAudio.length}`)
  }
  if (failed.length > 0) {
    logError(`Failed: ${failed.length}`)
    log("\nFailed words:", colors.red)
    for (const f of failed) {
      log(`  - ${f.word}: ${f.error}`, colors.dim)
    }
  }

  console.log("")
  if (isDryRun) {
    logWarning("This was a dry run. Run without --dry-run to apply changes.")
  } else if (successful.length > 0) {
    logSuccess("Seeding complete! Words are now in your D1 database.")
  }
}

// Run the script
main().catch((error) => {
  logError(`Fatal error: ${error.message}`)
  process.exit(1)
})
