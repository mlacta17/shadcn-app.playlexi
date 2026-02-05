#!/usr/bin/env npx ts-node
/**
 * Fix Placeholder Sentences Script
 *
 * Updates words that have placeholder sentences ("Can you spell the word...")
 * with real example sentences from external APIs.
 *
 * ## Usage
 *
 * Development (local D1):
 *   npx ts-node scripts/fix-placeholder-sentences.ts
 *
 * Production (remote D1):
 *   npx ts-node scripts/fix-placeholder-sentences.ts --production
 *
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --regenerate-tts  Also regenerate TTS audio for updated sentences
 *
 * ## Data Sources (in priority order)
 *
 * 1. Merriam-Webster API (via updated parser)
 * 2. Handcrafted sentences for spelling bee context
 */

import * as dotenv from "dotenv"
import * as path from "path"
import { execSync } from "child_process"

// Load environment variables FIRST
const envPath = path.resolve(__dirname, "..", ".env.local")
console.log(`Loading env from: ${envPath}`)
dotenv.config({ path: envPath })

import { fetchWordData, isApiError } from "./lib/merriam-webster"

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes("--dry-run")
const isProduction = args.includes("--production") || process.env.NODE_ENV === "production"
const regenerateTts = args.includes("--regenerate-tts")

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

/**
 * Handcrafted example sentences for words that may not have good API examples.
 * These are contextually appropriate for a spelling bee game.
 */
const HANDCRAFTED_SENTENCES: Record<string, string> = {
  // Original entries
  purple: "The sunset painted the sky in shades of purple and orange.",
  xylophone: "The music teacher demonstrated how to play the xylophone during class.",
  rhinoceros: "We saw a rhinoceros at the wildlife sanctuary during our field trip.",
  entrepreneur: "The young entrepreneur started her first business at age sixteen.",
  chrysanthemum: "My grandmother grows beautiful chrysanthemum flowers in her garden.",
  flibbertigibbet: "Her sister called her a flibbertigibbet for chattering nonstop all morning.",
  Kafkaesque: "The bureaucratic nightmare of renewing my license felt truly Kafkaesque.",
  sesquipedalian: "The professor's sesquipedalian vocabulary often confused his students.",
  tintinnabulation: "The tintinnabulation of the church bells echoed through the valley.",
  weltanschauung: "His travels abroad significantly shaped his weltanschauung.",
  xerophyte: "The cactus is a xerophyte that thrives in desert conditions.",
  prestidigitation: "The magician's prestidigitation amazed the audience with seemingly impossible card tricks.",
  pulchritudinous: "The art critic described the Renaissance painting as utterly pulchritudinous.",

  // Tier 1 words
  any: "Is there any pizza left for dinner?",
  axe: "The lumberjack sharpened his axe before cutting the tree.",
  cod: "We ordered fresh cod at the seafood restaurant.",
  cot: "The baby slept peacefully in her cot.",
  elk: "We spotted a majestic elk while hiking in the mountains.",
  elm: "The old elm tree provided shade for the entire backyard.",
  fig: "She added a fresh fig to her morning yogurt.",
  gum: "Please throw your gum in the trash before class.",
  hen: "The hen laid three eggs in the nest this morning.",
  him: "I gave the book to him after I finished reading it.",
  lid: "Put the lid back on the jar to keep the cookies fresh.",
  oar: "He used the oar to paddle the canoe across the lake.",
  owl: "The wise owl hooted from the branch at midnight.",
  vat: "The cheese maker stirred the milk in a large vat.",
  yak: "The yak is well-adapted to cold mountain environments.",
  yam: "Sweet potato and yam are often confused for one another.",

  // Tier 2 words
  camel: "The camel stored water for the long journey through the desert.",
  comet: "We watched the comet streak across the night sky.",
  deer: "A deer and her fawn crossed the road at dawn.",
  frog: "The frog jumped from lily pad to lily pad.",
  shark: "The great white shark is one of the ocean's top predators.",
  whale: "The blue whale is the largest animal on Earth.",

  // Tier 3 words
  camera: "She bought a new camera for her photography class.",
  candle: "The candle flickered gently in the breeze.",
  dragon: "The dragon breathed fire in the fantasy movie.",
  harbor: "The fishing boats returned to the harbor at sunset.",
  pillow: "She fluffed her pillow before going to sleep.",
  rainbow: "A beautiful rainbow appeared after the rainstorm.",
  turtle: "The sea turtle swam gracefully through the coral reef.",

  // Tier 4 words
  antibody: "The antibody helps the immune system fight infection.",
  attorney: "She hired an attorney to help with the legal matter.",
  bracelet: "The silver bracelet sparkled on her wrist.",
  breakout: "The new singer had a breakout performance at the concert.",
  geometry: "We learned about shapes and angles in geometry class.",
  hydrogen: "Hydrogen is the lightest element on the periodic table.",
  platinum: "The platinum ring was more valuable than gold.",
  telegram: "Before telephones, people sent news by telegram.",

  // Tier 5 words
  accountant: "The accountant prepared the company's annual tax return.",
  blackberry: "She picked fresh blackberry fruit from the garden bush.",
  blacksmith: "The blacksmith forged a horseshoe in his workshop.",
  helicopter: "The helicopter landed on the hospital rooftop.",
  locomotive: "The steam locomotive pulled the train through the mountains.",
  volleyball: "We played volleyball on the beach during summer vacation.",
  watermelon: "Nothing tastes better than cold watermelon on a hot day.",

  // Tier 6 words
  electromagnetic: "The electromagnetic spectrum includes radio waves and visible light.",
  furthermore: "The experiment was successful; furthermore, it exceeded expectations.",
  grandchildren: "My grandmother loves spending time with her grandchildren.",
  kindergarten: "She started kindergarten at five years old.",

  // Tier 7 words
  accoutrements: "The chef organized all her accoutrements before starting to cook.",
  anthropology: "She studied anthropology to learn about human cultures and societies.",
  appurtenance: "The storage shed was sold as an appurtenance to the house.",
  bathysphere: "Scientists used a bathysphere to explore the deep ocean.",
  bibliophile: "As a true bibliophile, she owns over a thousand books.",
  bougainvillea: "The bright purple bougainvillea covered the garden wall.",
  crystallography: "Crystallography helps scientists understand atomic structures.",
  ecclesiastic: "The ecclesiastic proceedings were held at the cathedral.",
  electrocardiogram: "The doctor ordered an electrocardiogram to check my heart.",
  encephalopathy: "The patient was diagnosed with a rare form of encephalopathy.",
  entrepreneurial: "Her entrepreneurial spirit led her to start three successful businesses.",
  extemporaneous: "He gave an extemporaneous speech without any preparation.",
  extraordinaire: "She was known as a chef extraordinaire in the culinary world.",
  hallucinogenic: "Some mushrooms contain hallucinogenic compounds.",
  hippopotamus: "The hippopotamus spends most of its day in the water.",
  legerdemain: "The card trick required impressive legerdemain.",
  ophthalmologist: "The ophthalmologist examined my eyes for any problems.",
  schadenfreude: "He felt a twinge of schadenfreude when his rival stumbled.",
  thaumaturgist: "The thaumaturgist in the story could perform miracles.",
  thoroughfare: "The main thoroughfare through town was blocked by construction.",
  verisimilar: "The historical novel was praised for its verisimilar details.",
  vicissitudes: "The vicissitudes of life taught her to be resilient.",
  whimsicality: "The whimsicality of the children's book delighted readers.",
  worcestershire: "Add a dash of worcestershire sauce to the recipe.",
  xanthophyll: "Xanthophyll gives autumn leaves their yellow color.",
  xylophonist: "The talented xylophonist performed a solo at the concert.",
}

interface WordRow {
  id: string
  word: string
  example_sentence: string
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
 * Fetch words with placeholder sentences.
 */
function fetchPlaceholderWords(isRemote: boolean): WordRow[] {
  const sql = `
    SELECT id, word, example_sentence
    FROM words
    WHERE example_sentence LIKE '%Can you spell the word%'
    ORDER BY word
  `

  const output = executeD1Query(sql, isRemote)

  try {
    const parsed = JSON.parse(output)
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
 * Update a word's example sentence in the database.
 */
function updateExampleSentence(
  wordId: string,
  newSentence: string,
  isRemote: boolean
): void {
  const escapedSentence = newSentence.replace(/'/g, "''")

  const sql = `
    UPDATE words
    SET example_sentence = '${escapedSentence}'
    WHERE id = '${wordId}'
  `.trim()

  if (!isDryRun) {
    executeD1Sql(sql, isRemote)
  }
}

/**
 * Get a real example sentence for a word.
 */
async function getRealSentence(word: string): Promise<string | null> {
  // First, check handcrafted sentences
  if (HANDCRAFTED_SENTENCES[word]) {
    return HANDCRAFTED_SENTENCES[word]
  }

  // Try Merriam-Webster API (with updated parser)
  try {
    const wordData = await fetchWordData(word)
    if (!isApiError(wordData)) {
      const sentence = wordData.exampleSentence
      // Check if it's not a placeholder
      if (sentence && !sentence.includes("Can you spell the word")) {
        return sentence
      }
    }
  } catch (error) {
    logWarning(`MW API error for "${word}": ${error}`)
  }

  return null
}

interface UpdateResult {
  word: string
  success: boolean
  oldSentence: string
  newSentence?: string
  source?: string
  error?: string
}

async function main() {
  log("\n╔════════════════════════════════════════════════════════════╗")
  log("║     Fix Placeholder Sentences Script                       ║")
  log("╚════════════════════════════════════════════════════════════╝\n")

  // Show configuration
  logInfo(`Mode: ${isProduction ? "PRODUCTION (remote D1)" : "DEVELOPMENT (local D1)"}`)
  if (isDryRun) logWarning("DRY RUN - no changes will be made")
  if (regenerateTts) logInfo("Will regenerate TTS audio for updated sentences")
  console.log("")

  // Fetch words with placeholder sentences
  log("Fetching words with placeholder sentences...", colors.dim)
  const words = fetchPlaceholderWords(isProduction)

  if (words.length === 0) {
    logSuccess("No words with placeholder sentences found!")
    process.exit(0)
  }

  logInfo(`Found ${words.length} words with placeholder sentences\n`)

  // Process each word
  const results: UpdateResult[] = []
  const wordsToRegenerateTts: string[] = []

  for (const wordRow of words) {
    process.stdout.write(`  Processing "${wordRow.word}"... `)

    const result: UpdateResult = {
      word: wordRow.word,
      success: false,
      oldSentence: wordRow.example_sentence,
    }

    // Try to get a real sentence
    const newSentence = await getRealSentence(wordRow.word)

    if (newSentence) {
      result.newSentence = newSentence
      result.source = HANDCRAFTED_SENTENCES[wordRow.word] ? "handcrafted" : "MW API"

      try {
        updateExampleSentence(wordRow.id, newSentence, isProduction)
        result.success = true
        wordsToRegenerateTts.push(wordRow.word)
        console.log(colors.green + "✓" + colors.reset + ` (${result.source})`)
      } catch (error) {
        result.error = error instanceof Error ? error.message : "Update failed"
        console.log(colors.red + "✗" + colors.reset + ` ${result.error}`)
      }
    } else {
      result.error = "No real sentence found"
      console.log(colors.yellow + "⚠" + colors.reset + " No sentence found")
    }

    results.push(result)

    // Rate limiting for API calls
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // Summary
  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  log("\n╔════════════════════════════════════════════════════════════╗")
  log("║                      SUMMARY                               ║")
  log("╚════════════════════════════════════════════════════════════╝")
  logSuccess(`Updated: ${successful.length}/${results.length}`)
  if (failed.length > 0) {
    logWarning(`Needs manual fix: ${failed.length}`)
    log("\nWords still needing sentences:", colors.yellow)
    for (const f of failed) {
      log(`  - ${f.word}`, colors.dim)
    }
  }

  // Show updated sentences
  if (successful.length > 0) {
    log("\n━━━ Updated Sentences ━━━", colors.cyan)
    for (const s of successful) {
      log(`\n${s.word} (${s.source}):`, colors.blue)
      log(`  "${s.newSentence}"`, colors.dim)
    }
  }

  console.log("")
  if (isDryRun) {
    logWarning("This was a dry run. Run without --dry-run to apply changes.")
  } else if (successful.length > 0) {
    logSuccess("Example sentences updated!")

    if (regenerateTts && wordsToRegenerateTts.length > 0) {
      log("\n━━━ Regenerating TTS ━━━", colors.cyan)
      logInfo(`Run this command to regenerate TTS for ${wordsToRegenerateTts.length} updated words:`)
      log(`\n  npx ts-node scripts/generate-tts.ts --production --type=sentence --word=${wordsToRegenerateTts.join(",")}`, colors.dim)
    } else if (wordsToRegenerateTts.length > 0) {
      log("\n━━━ TTS Regeneration Needed ━━━", colors.yellow)
      logWarning(`${wordsToRegenerateTts.length} words have new sentences. Run with --regenerate-tts or manually run:`)
      log(`\n  npm run tts:generate:prod -- --type=sentence --word=${wordsToRegenerateTts[0]}`, colors.dim)
      log("  (repeat for each word)", colors.dim)
    }
  }
}

// Run the script
main().catch((error) => {
  logError(`Fatal error: ${error.message}`)
  process.exit(1)
})
