#!/usr/bin/env npx tsx
/**
 * Speech Recognition Diagnostic Tool
 *
 * This script helps diagnose speech recognition issues by:
 * 1. Showing what Google Speech-to-Text receives
 * 2. Testing specific letters that are commonly confused
 * 3. Verifying the phonetic mapping system
 *
 * ## Usage
 *
 * ```bash
 * # Check recognition logs for a specific user
 * npx tsx scripts/test-speech-recognition.ts logs <userId>
 *
 * # Analyze confusion patterns from recent logs
 * npx tsx scripts/test-speech-recognition.ts analyze
 *
 * # Check what letters are most commonly confused
 * npx tsx scripts/test-speech-recognition.ts confusion
 * ```
 */

import { execSync } from "child_process"

const args = process.argv.slice(2)
const command = args[0] || "help"

// =============================================================================
// HELPERS
// =============================================================================

function runD1Query(sql: string): unknown[] {
  try {
    const result = execSync(
      `npx wrangler d1 execute playlexi-db --local --command "${sql.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    )
    const parsed = JSON.parse(result.split("\n").find((l) => l.startsWith("[")) || "[]")
    return parsed[0]?.results || []
  } catch (error) {
    console.error("Database query failed:", error)
    return []
  }
}

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
Speech Recognition Diagnostic Tool
===================================

Commands:
  logs            Show recent recognition logs with analysis
  confusion       Analyze letter confusion patterns
  help            Show this help message

Examples:
  npx tsx scripts/test-speech-recognition.ts logs
  npx tsx scripts/test-speech-recognition.ts confusion
`)
}

function showLogs() {
  console.log("\n📊 Recent Recognition Logs\n")
  console.log("=" .repeat(80))

  const logs = runD1Query(`
    SELECT
      word_to_spell,
      google_transcript,
      extracted_letters,
      was_correct,
      datetime(created_at, 'unixepoch') as timestamp
    FROM recognition_logs
    ORDER BY created_at DESC
    LIMIT 20
  `) as Array<{
    word_to_spell: string
    google_transcript: string
    extracted_letters: string
    was_correct: number
    timestamp: string
  }>

  if (logs.length === 0) {
    console.log("No logs found. Play some games to generate data.")
    return
  }

  console.log(
    "Word".padEnd(15) +
    "Google Heard".padEnd(30) +
    "Extracted".padEnd(15) +
    "Status".padEnd(10)
  )
  console.log("-".repeat(80))

  for (const log of logs) {
    const status = log.was_correct ? "✅" : "❌"
    const wordMatch = log.extracted_letters === log.word_to_spell
    const highlight = wordMatch ? "" : " ⚠️"

    console.log(
      log.word_to_spell.padEnd(15) +
      log.google_transcript.padEnd(30) +
      log.extracted_letters.padEnd(15) +
      status + highlight
    )
  }

  console.log("\n")
}

function analyzeConfusion() {
  console.log("\n🔍 Letter Confusion Analysis\n")
  console.log("=" .repeat(80))

  // Get all incorrect answers
  const incorrectLogs = runD1Query(`
    SELECT
      word_to_spell,
      google_transcript,
      extracted_letters
    FROM recognition_logs
    WHERE was_correct = 0
    ORDER BY created_at DESC
    LIMIT 100
  `) as Array<{
    word_to_spell: string
    google_transcript: string
    extracted_letters: string
  }>

  if (incorrectLogs.length === 0) {
    console.log("No incorrect answers found. Great job!")
    return
  }

  // Analyze each incorrect answer
  const confusions: Map<string, Map<string, number>> = new Map()

  for (const log of incorrectLogs) {
    const expected = log.word_to_spell.toLowerCase()
    const extracted = log.extracted_letters.toLowerCase()

    // Compare letter by letter
    const minLen = Math.min(expected.length, extracted.length)
    for (let i = 0; i < minLen; i++) {
      if (expected[i] !== extracted[i]) {
        // Found a confusion: expected[i] was recognized as extracted[i]
        const expectedLetter = expected[i].toUpperCase()
        const heardLetter = extracted[i].toUpperCase()

        if (!confusions.has(expectedLetter)) {
          confusions.set(expectedLetter, new Map())
        }
        const letterConfusions = confusions.get(expectedLetter)!
        letterConfusions.set(heardLetter, (letterConfusions.get(heardLetter) || 0) + 1)
      }
    }
  }

  if (confusions.size === 0) {
    console.log("No specific letter confusions detected.")
    return
  }

  console.log("Letter confusion patterns (Expected → Heard as):\n")

  // Sort by most confused
  const sortedConfusions = [...confusions.entries()].sort((a, b) => {
    const aTotal = [...a[1].values()].reduce((sum, n) => sum + n, 0)
    const bTotal = [...b[1].values()].reduce((sum, n) => sum + n, 0)
    return bTotal - aTotal
  })

  for (const [expected, heardMap] of sortedConfusions) {
    const sortedHeard = [...heardMap.entries()].sort((a, b) => b[1] - a[1])
    const heardStr = sortedHeard
      .map(([letter, count]) => `${letter} (${count}x)`)
      .join(", ")

    console.log(`  ${expected} → ${heardStr}`)
  }

  console.log("\n💡 Most Problematic Letters:")
  console.log("   These letters are most commonly confused by Google Speech:")
  console.log("")

  const problematic = sortedConfusions.slice(0, 5)
  for (const [letter, heardMap] of problematic) {
    const total = [...heardMap.values()].reduce((sum, n) => sum + n, 0)
    const mostCommonMishear = [...heardMap.entries()].sort((a, b) => b[1] - a[1])[0]
    console.log(`   ${letter}: Confused ${total} time(s), often heard as "${mostCommonMishear[0]}"`)
  }

  console.log("\n📝 Recommendations:")
  console.log("   1. Try speaking more slowly and clearly")
  console.log("   2. Use phonetic words: 'B as in Boy', 'D as in Dog'")
  console.log("   3. Position microphone closer to your mouth")
  console.log("   4. Reduce background noise")
  console.log("")
}

// =============================================================================
// MAIN
// =============================================================================

switch (command) {
  case "logs":
    showLogs()
    break
  case "confusion":
    analyzeConfusion()
    break
  case "help":
  default:
    showHelp()
}
