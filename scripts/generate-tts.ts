#!/usr/bin/env npx ts-node
/**
 * TTS Generation Script
 *
 * Generates OpenAI TTS audio for all words in the database and uploads to R2.
 * Updates the database with the audio URLs.
 *
 * ## Usage
 *
 * Development (local D1 + skip R2):
 *   npm run tts:generate
 *
 * Production (remote D1 + R2):
 *   npm run tts:generate:prod
 *
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --tier=N        Only process words for tier N (1-7)
 *   --limit=N       Limit to N words total
 *   --word=WORD     Only process a specific word
 *   --skip-existing Skip words that already have TTS audio
 *   --type=TYPE     Only generate specific type (intro, sentence, definition)
 *   --voice=VOICE   Use specific voice (alloy, echo, fable, onyx, nova, shimmer)
 *   --estimate      Only show cost estimate, don't generate
 *
 * ## Prerequisites
 *
 * 1. OpenAI API key in .env.local:
 *    - OPENAI_API_KEY
 *
 * 2. For R2 uploads (production):
 *    - R2_ACCOUNT_ID
 *    - R2_ACCESS_KEY_ID
 *    - R2_SECRET_ACCESS_KEY
 *
 * 3. D1 database with words seeded
 *
 * ## Cost Estimate
 *
 * For 10,000 words:
 * - Intro (~20 chars): 200K chars → $3.00
 * - Sentence (~100 chars): 1M chars → $15.00
 * - Definition (~150 chars): 1.5M chars → $22.50
 * - Total: ~$40.50
 *
 * @see ADR-015 (OpenAI TTS for Realistic Voice Output)
 * @see lib/tts/openai-tts.ts
 */

import * as dotenv from "dotenv"
import * as path from "path"
import { execSync } from "child_process"

// Load environment variables FIRST
const envPath = path.resolve(__dirname, "..", ".env.local")
console.log(`Loading env from: ${envPath}`)
const result = dotenv.config({ path: envPath })
if (result.error) {
  console.error("Failed to load .env.local:", result.error.message)
}

import {
  generateIntroAudio,
  generateSentenceAudio,
  generateDefinitionAudio,
  estimateBatchCost,
  isTtsConfigured,
  type TtsVoice,
} from "../lib/tts"
import {
  uploadTtsAudio,
  isR2Configured,
  getPublicUrl,
  getTtsAudioKey,
  type TtsAudioType,
} from "./lib/r2-upload"

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const isProduction = args.includes("--production") || process.env.NODE_ENV === "production"
const estimateOnly = args.includes("--estimate")
const skipExisting = args.includes("--skip-existing")

const tierArg = args.find((a) => a.startsWith("--tier="))
const tierFilter = tierArg ? parseInt(tierArg.split("=")[1], 10) : null

const limitArg = args.find((a) => a.startsWith("--limit="))
const wordLimit = limitArg ? parseInt(limitArg.split("=")[1], 10) : null

const wordArg = args.find((a) => a.startsWith("--word="))
const specificWord = wordArg ? wordArg.split("=")[1] : null

const typeArg = args.find((a) => a.startsWith("--type="))
const typeFilter = typeArg ? (typeArg.split("=")[1] as TtsAudioType) : null

const voiceArg = args.find((a) => a.startsWith("--voice="))
const voice = (voiceArg ? voiceArg.split("=")[1] : "shimmer") as TtsVoice

// Use tts-1-hd for higher quality, more natural sounding speech
const modelArg = args.find((a) => a.startsWith("--model="))
const model = modelArg ? modelArg.split("=")[1] : "tts-1-hd"

// Slightly slower speed for clearer pronunciation (0.9 = 90% speed)
const speedArg = args.find((a) => a.startsWith("--speed="))
const speed = speedArg ? parseFloat(speedArg.split("=")[1]) : 0.95

const PROJECT_ROOT = path.join(__dirname, "..")

// =============================================================================
// CONSOLE COLORS
// =============================================================================

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
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
// DATABASE HELPERS
// =============================================================================

interface WordRow {
  id: string
  word: string
  difficulty_tier: number
  definition: string
  example_sentence: string
  intro_audio_url: string | null
  sentence_audio_url: string | null
  definition_audio_url: string | null
}

/**
 * Execute a D1 SQL query using Wrangler.
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
 * Fetch words from the database.
 */
function fetchWords(isRemote: boolean): WordRow[] {
  // Build SQL on single line to avoid escaping issues with wrangler
  let sql = "SELECT id, word, difficulty_tier, definition, example_sentence, intro_audio_url, sentence_audio_url, definition_audio_url FROM words"

  const conditions: string[] = []

  if (tierFilter) {
    conditions.push(`difficulty_tier = ${tierFilter}`)
  }

  if (specificWord) {
    conditions.push(`word = '${specificWord.replace(/'/g, "''")}'`)
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`
  }

  sql += " ORDER BY difficulty_tier, word"

  if (wordLimit) {
    sql += ` LIMIT ${wordLimit}`
  }

  const output = executeD1Query(sql, isRemote)

  try {
    const parsed = JSON.parse(output)
    // D1 output format: [{ results: [...], ... }]
    if (Array.isArray(parsed) && parsed[0]?.results) {
      return parsed[0].results as WordRow[]
    }
    return []
  } catch {
    console.error("Failed to parse D1 output:", output)
    return []
  }
}

/**
 * Update a word's TTS audio URL in the database.
 */
function updateWordTtsUrl(
  wordId: string,
  type: TtsAudioType,
  url: string,
  isRemote: boolean
): void {
  const columnMap: Record<TtsAudioType, string> = {
    intro: "intro_audio_url",
    sentence: "sentence_audio_url",
    definition: "definition_audio_url",
  }

  const column = columnMap[type]
  const escapedUrl = url.replace(/'/g, "''")

  const sql = `
    UPDATE words
    SET ${column} = '${escapedUrl}',
        tts_generated_at = unixepoch(),
        tts_voice = '${voice}'
    WHERE id = '${wordId}'
  `.trim()

  if (!isDryRun) {
    executeD1Query(sql, isRemote)
  }
}

// =============================================================================
// TTS GENERATION
// =============================================================================

interface GenerationResult {
  word: string
  type: TtsAudioType
  success: boolean
  error?: string
  url?: string
  skipped?: boolean
}

/**
 * Generate TTS for a single word and type.
 */
async function generateForWord(
  wordRow: WordRow,
  type: TtsAudioType,
  isRemote: boolean
): Promise<GenerationResult> {
  const result: GenerationResult = {
    word: wordRow.word,
    type,
    success: false,
  }

  // Check if already exists
  const existingUrl =
    type === "intro"
      ? wordRow.intro_audio_url
      : type === "sentence"
        ? wordRow.sentence_audio_url
        : wordRow.definition_audio_url

  if (skipExisting && existingUrl) {
    result.success = true
    result.skipped = true
    result.url = existingUrl
    return result
  }

  if (isDryRun) {
    result.success = true
    result.url = getPublicUrl(getTtsAudioKey(wordRow.word, type))
    return result
  }

  try {
    // Generate the audio with HD model and optimal speed
    const ttsOptions = {
      voice,
      model: model as "tts-1" | "tts-1-hd",
      speed,
    }

    let ttsResult

    switch (type) {
      case "intro":
        ttsResult = await generateIntroAudio(wordRow.word, ttsOptions)
        break
      case "sentence":
        ttsResult = await generateSentenceAudio(wordRow.example_sentence, ttsOptions)
        break
      case "definition":
        ttsResult = await generateDefinitionAudio(
          wordRow.word,
          wordRow.definition,
          ttsOptions
        )
        break
    }

    if (!ttsResult.success || !ttsResult.audioBuffer) {
      result.error = ttsResult.error || "No audio generated"
      return result
    }

    // Upload to R2
    if (isR2Configured()) {
      const url = await uploadTtsAudio(wordRow.word, type, ttsResult.audioBuffer)
      result.url = url

      // Update database
      updateWordTtsUrl(wordRow.id, type, url, isRemote)
    } else {
      // In development, just generate placeholder URL
      result.url = getPublicUrl(getTtsAudioKey(wordRow.word, type))
      logWarning(`R2 not configured, using placeholder URL for ${wordRow.word}/${type}`)
    }

    result.success = true
    return result
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error"
    return result
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  log("\n╔════════════════════════════════════════════════════════════╗")
  log("║         PlayLexi TTS Generation Script                      ║")
  log("╚════════════════════════════════════════════════════════════╝\n")

  // Show configuration
  logInfo(`Mode: ${isProduction ? "PRODUCTION (remote D1 + R2)" : "DEVELOPMENT (local D1)"}`)
  logInfo(`Voice: ${voice}`)
  logInfo(`Model: ${model}`)
  logInfo(`Speed: ${speed}x`)
  if (isDryRun) logWarning("DRY RUN - no changes will be made")
  if (estimateOnly) logInfo("ESTIMATE ONLY - calculating costs")
  if (skipExisting) logInfo("Skipping words with existing TTS audio")
  if (tierFilter) logInfo(`Filtering to tier ${tierFilter} only`)
  if (wordLimit) logInfo(`Limiting to ${wordLimit} words`)
  if (specificWord) logInfo(`Processing only word: ${specificWord}`)
  if (typeFilter) logInfo(`Generating only ${typeFilter} audio`)
  logInfo(`TTS configured: ${isTtsConfigured() ? "yes" : "no"}`)
  logInfo(`R2 configured: ${isR2Configured() ? "yes" : "no (using placeholder URLs)"}`)
  console.log("")

  // Check prerequisites
  if (!isTtsConfigured() && !isDryRun && !estimateOnly) {
    logError("OPENAI_API_KEY is not set. Add it to .env.local")
    process.exit(1)
  }

  // Fetch words
  log("Fetching words from database...", colors.dim)
  const words = fetchWords(isProduction)

  if (words.length === 0) {
    logWarning("No words found matching criteria")
    process.exit(0)
  }

  logSuccess(`Found ${words.length} words`)

  // Cost estimate (using the selected model for accurate pricing)
  const wordsForEstimate = words.map((w) => ({
    word: w.word,
    sentence: w.example_sentence,
    definition: w.definition,
  }))
  const estimate = estimateBatchCost(wordsForEstimate, model as "tts-1" | "tts-1-hd")

  log("\n━━━ Cost Estimate ━━━", colors.cyan)
  logInfo(`Total characters: ${estimate.totalCharacters.toLocaleString()}`)
  logInfo(`Estimated cost: $${estimate.estimatedCost.toFixed(2)}`)
  console.log("")

  if (estimateOnly) {
    log("Estimate complete. Run without --estimate to generate audio.")
    process.exit(0)
  }

  // Determine which types to generate
  const typesToGenerate: TtsAudioType[] = typeFilter
    ? [typeFilter]
    : ["intro", "sentence", "definition"]

  // Process words
  const results: GenerationResult[] = []
  const startTime = Date.now()

  for (let i = 0; i < words.length; i++) {
    const wordRow = words[i]
    const progress = `[${i + 1}/${words.length}]`

    for (const type of typesToGenerate) {
      process.stdout.write(`${progress} ${wordRow.word}/${type}... `)

      const genResult = await generateForWord(wordRow, type, isProduction)
      results.push(genResult)

      if (genResult.skipped) {
        console.log(colors.dim + "skipped" + colors.reset)
      } else if (genResult.success) {
        console.log(colors.green + "✓" + colors.reset)
      } else {
        console.log(colors.red + "✗" + colors.reset + ` ${genResult.error}`)
      }

      // Rate limiting: OpenAI allows ~50 requests/min for TTS
      // Add delay to stay well under limit
      if (!isDryRun && !genResult.skipped) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
      }
    }
  }

  // Summary
  const durationSeconds = (Date.now() - startTime) / 1000
  const successful = results.filter((r) => r.success && !r.skipped)
  const skipped = results.filter((r) => r.skipped)
  const failed = results.filter((r) => !r.success)

  log("\n╔════════════════════════════════════════════════════════════╗")
  log("║                      SUMMARY                               ║")
  log("╚════════════════════════════════════════════════════════════╝")
  logSuccess(`Generated: ${successful.length}`)
  if (skipped.length > 0) logInfo(`Skipped (existing): ${skipped.length}`)
  if (failed.length > 0) logError(`Failed: ${failed.length}`)
  logInfo(`Duration: ${durationSeconds.toFixed(1)}s`)

  if (failed.length > 0) {
    log("\nFailed items:", colors.red)
    for (const f of failed.slice(0, 10)) {
      log(`  - ${f.word}/${f.type}: ${f.error}`, colors.dim)
    }
    if (failed.length > 10) {
      log(`  ... and ${failed.length - 10} more`, colors.dim)
    }
  }

  console.log("")
  if (isDryRun) {
    logWarning("This was a dry run. Run without --dry-run to apply changes.")
  } else if (successful.length > 0) {
    logSuccess("TTS generation complete! Audio URLs are now in the database.")
  }
}

// Run the script
main().catch((error) => {
  logError(`Fatal error: ${error.message}`)
  process.exit(1)
})
