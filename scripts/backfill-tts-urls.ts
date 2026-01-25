#!/usr/bin/env npx ts-node
/**
 * Backfill TTS URLs Script
 *
 * Updates the database with TTS audio URLs for words that already have
 * audio files in R2 storage. This script is SAFE because it:
 *
 * 1. VERIFIES each audio file exists in R2 before updating
 * 2. Only updates words where the URL column is currently NULL
 * 3. Logs every change for audit trail
 * 4. Supports dry-run mode
 *
 * ## Usage
 *
 * Dry run (see what would be done):
 *   npx ts-node scripts/backfill-tts-urls.ts --dry-run
 *
 * Production:
 *   npx ts-node scripts/backfill-tts-urls.ts --production
 *
 * ## What This Does
 *
 * For each word in the database:
 * 1. Check if intro_audio_url, sentence_audio_url, definition_audio_url are NULL
 * 2. Verify the corresponding files exist in R2:
 *    - audio/tts/intros/{word}.mp3
 *    - audio/tts/sentences/{word}.mp3
 *    - audio/tts/definitions/{word}.mp3
 * 3. If file exists, update the database URL
 * 4. If file doesn't exist, skip (don't create broken links)
 */

import * as dotenv from "dotenv"
import * as path from "path"
import { execSync } from "child_process"
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3"

// Load environment variables
const envPath = path.resolve(__dirname, "..", ".env.local")
dotenv.config({ path: envPath })

// Parse arguments
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const isProduction = args.includes("--production") || process.env.NODE_ENV === "production"

const PROJECT_ROOT = path.join(__dirname, "..")

// Colors for console output
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
// R2 CLIENT
// =============================================================================

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_BUCKET_NAME || "playlexi-assets"

let s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (s3Client) return s3Client

  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error("Missing R2 credentials")
  }

  s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  })

  return s3Client
}

/**
 * Check if a file exists in R2.
 */
async function fileExistsInR2(key: string): Promise<boolean> {
  const client = getS3Client()

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    )
    return true
  } catch {
    return false
  }
}

// =============================================================================
// DATABASE HELPERS
// =============================================================================

interface WordRow {
  id: string
  word: string
  intro_audio_url: string | null
  sentence_audio_url: string | null
  definition_audio_url: string | null
}

/**
 * Execute a D1 SQL query.
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
 * Execute D1 SQL (for updates).
 */
function executeD1Sql(sql: string, isRemote: boolean): void {
  const remoteFlag = isRemote ? "--remote" : "--local"
  const escapedSql = sql.replace(/"/g, '\\"')
  const command = `npx wrangler d1 execute playlexi-db ${remoteFlag} --command="${escapedSql}"`

  execSync(command, {
    cwd: PROJECT_ROOT,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  })
}

/**
 * Fetch all words from the database in batches to avoid memory issues.
 */
function fetchAllWords(isRemote: boolean): WordRow[] {
  const allWords: WordRow[] = []
  const batchSize = 200
  let offset = 0

  log("Fetching words in batches...", colors.dim)

  while (true) {
    const sql = `SELECT id, word, intro_audio_url, sentence_audio_url, definition_audio_url FROM words ORDER BY word LIMIT ${batchSize} OFFSET ${offset}`

    try {
      const output = executeD1Query(sql, isRemote)
      const parsed = JSON.parse(output)

      if (Array.isArray(parsed) && parsed[0]?.results) {
        const rows = parsed[0].results as WordRow[]
        if (rows.length === 0) break

        allWords.push(...rows)
        process.stdout.write(`\r  Fetched ${allWords.length} words...`)

        if (rows.length < batchSize) break
        offset += batchSize
      } else {
        break
      }
    } catch (error) {
      console.error("\nFailed to parse D1 output at offset", offset)
      break
    }
  }

  console.log("") // New line after progress
  return allWords
}

// =============================================================================
// TTS URL HELPERS
// =============================================================================

type TtsAudioType = "intro" | "sentence" | "definition"

/**
 * Generate the R2 key for a TTS audio file.
 * MUST match the key generation in scripts/lib/r2-upload.ts
 */
function getTtsAudioKey(word: string, type: TtsAudioType): string {
  // Sanitize the word for use as a filename (lowercase, replace non-alphanumeric with _)
  const sanitized = word.toLowerCase().replace(/[^a-z0-9]/g, "_")

  const pathMap: Record<TtsAudioType, string> = {
    intro: "audio/tts/intros",
    sentence: "audio/tts/sentences",
    definition: "audio/tts/definitions",
  }

  return `${pathMap[type]}/${sanitized}.mp3`
}

/**
 * Get the public URL for an R2 object (served via API route).
 */
function getPublicUrl(key: string): string {
  return `/api/assets/${key}`
}

// =============================================================================
// MAIN
// =============================================================================

interface BackfillResult {
  word: string
  type: TtsAudioType
  success: boolean
  reason?: string
  url?: string
  skipped?: boolean
}

async function main() {
  log("\n╔════════════════════════════════════════════════════════════╗")
  log("║         TTS URL Backfill Script                            ║")
  log("╚════════════════════════════════════════════════════════════╝\n")

  // Show configuration
  logInfo(`Mode: ${isProduction ? "PRODUCTION (remote D1)" : "DEVELOPMENT (local D1)"}`)
  if (isDryRun) logWarning("DRY RUN - no changes will be made")
  logInfo(`R2 Bucket: ${BUCKET_NAME}`)
  console.log("")

  // Fetch all words
  log("Fetching words from database...", colors.dim)
  const words = fetchAllWords(isProduction)

  if (words.length === 0) {
    logError("No words found in database!")
    process.exit(1)
  }

  logSuccess(`Found ${words.length} words in database\n`)

  // Process each word
  const results: BackfillResult[] = []
  const types: TtsAudioType[] = ["intro", "sentence", "definition"]
  const columnMap: Record<TtsAudioType, string> = {
    intro: "intro_audio_url",
    sentence: "sentence_audio_url",
    definition: "definition_audio_url",
  }

  let updatedCount = 0
  let skippedCount = 0
  let missingCount = 0
  let errorCount = 0

  for (let i = 0; i < words.length; i++) {
    const wordRow = words[i]
    const progress = `[${i + 1}/${words.length}]`

    for (const type of types) {
      const column = columnMap[type]
      const currentValue =
        type === "intro"
          ? wordRow.intro_audio_url
          : type === "sentence"
            ? wordRow.sentence_audio_url
            : wordRow.definition_audio_url

      // Skip if already has a URL
      if (currentValue) {
        results.push({
          word: wordRow.word,
          type,
          success: true,
          skipped: true,
          reason: "Already has URL",
          url: currentValue,
        })
        skippedCount++
        continue
      }

      // Generate expected R2 key and public URL
      const r2Key = getTtsAudioKey(wordRow.word, type)
      const publicUrl = getPublicUrl(r2Key)

      // VERIFY file exists in R2 before updating
      process.stdout.write(`${progress} ${wordRow.word}/${type}... `)

      try {
        const exists = await fileExistsInR2(r2Key)

        if (!exists) {
          console.log(colors.yellow + "missing in R2" + colors.reset)
          results.push({
            word: wordRow.word,
            type,
            success: false,
            reason: "File not found in R2",
          })
          missingCount++
          continue
        }

        // File exists - update database
        if (!isDryRun) {
          const escapedUrl = publicUrl.replace(/'/g, "''")
          const sql = `UPDATE words SET ${column} = '${escapedUrl}' WHERE id = '${wordRow.id}'`
          executeD1Sql(sql, isProduction)
        }

        console.log(colors.green + "✓" + colors.reset)
        results.push({
          word: wordRow.word,
          type,
          success: true,
          url: publicUrl,
        })
        updatedCount++
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.log(colors.red + "✗" + colors.reset + ` ${message}`)
        results.push({
          word: wordRow.word,
          type,
          success: false,
          reason: message,
        })
        errorCount++
      }
    }
  }

  // Summary
  log("\n╔════════════════════════════════════════════════════════════╗")
  log("║                      SUMMARY                               ║")
  log("╚════════════════════════════════════════════════════════════╝")
  logSuccess(`Updated: ${updatedCount}`)
  logInfo(`Already had URL (skipped): ${skippedCount}`)
  if (missingCount > 0) logWarning(`Missing in R2 (skipped): ${missingCount}`)
  if (errorCount > 0) logError(`Errors: ${errorCount}`)

  // Show words missing audio
  const missingWords = results
    .filter((r) => !r.success && r.reason === "File not found in R2")
    .reduce((acc, r) => {
      if (!acc.includes(r.word)) acc.push(r.word)
      return acc
    }, [] as string[])

  if (missingWords.length > 0) {
    log("\n━━━ Words Missing TTS Audio in R2 ━━━", colors.yellow)
    log(`Total: ${missingWords.length} words`, colors.dim)
    if (missingWords.length <= 20) {
      for (const w of missingWords) {
        log(`  - ${w}`, colors.dim)
      }
    } else {
      for (const w of missingWords.slice(0, 10)) {
        log(`  - ${w}`, colors.dim)
      }
      log(`  ... and ${missingWords.length - 10} more`, colors.dim)
    }
  }

  console.log("")
  if (isDryRun) {
    logWarning("This was a dry run. Run without --dry-run to apply changes.")
  } else if (updatedCount > 0) {
    logSuccess("TTS URLs have been backfilled in the database!")
  }
}

// Run
main().catch((error) => {
  logError(`Fatal error: ${error.message}`)
  process.exit(1)
})
