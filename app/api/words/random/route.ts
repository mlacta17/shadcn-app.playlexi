/**
 * Random Word API — Serves random words from D1 database.
 *
 * GET /api/words/random?tier=3&excludeIds=abc,def
 *
 * Returns a random word from the specified difficulty tier,
 * optionally excluding certain word IDs (to prevent repeats in a session).
 *
 * ## Query Parameters
 *
 * | Param | Required | Description |
 * |-------|----------|-------------|
 * | tier | Yes | Difficulty tier 1-7 |
 * | excludeIds | No | Comma-separated word IDs to exclude |
 *
 * ## Response
 *
 * Success (200):
 * ```json
 * {
 *   "success": true,
 *   "word": {
 *     "id": "abc123",
 *     "word": "castle",
 *     "tier": 3,
 *     "definition": "A large fortified building...",
 *     "sentence": "The castle stood on the hill.",
 *     "audioUrl": "https://...",
 *     "partOfSpeech": "noun"
 *   }
 * }
 * ```
 *
 * Error (400/404/500):
 * ```json
 * {
 *   "success": false,
 *   "error": "Error message"
 * }
 * ```
 *
 * ## Local Development
 *
 * In local development (without Cloudflare runtime), this route uses
 * Wrangler CLI to query the local D1 database. This allows testing
 * without requiring @cloudflare/next-on-pages (which has peer dependency
 * issues with Next.js 16+).
 *
 * ## Production (Cloudflare Pages)
 *
 * In production, uncomment the edge runtime and use getRequestContext()
 * once @cloudflare/next-on-pages supports Next.js 16.
 *
 * ## Example Usage
 *
 * ```typescript
 * // Fetch a tier 3 word, excluding previously seen words
 * const response = await fetch('/api/words/random?tier=3&excludeIds=abc,def')
 * const { success, word, error } = await response.json()
 * ```
 *
 * @see lib/services/d1-word-data-source.ts
 * @see lib/word-service.ts for Word type definition
 */

import { NextRequest, NextResponse } from "next/server"
import { execSync } from "child_process"
import * as path from "path"
import type { WordTier, Word } from "@/lib/word-service"

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Check if running in Cloudflare's edge runtime.
 * When true, use getRequestContext() for D1 access.
 * When false (local dev), use Wrangler CLI.
 */
const IS_CLOUDFLARE_RUNTIME = typeof globalThis.caches !== "undefined" &&
  process.env.CF_PAGES === "1"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface SuccessResponse {
  success: true
  word: Word
}

interface ErrorResponse {
  success: false
  error: string
}

type ApiResponse = SuccessResponse | ErrorResponse

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate and parse the tier query parameter.
 * Must be an integer between 1 and 7.
 */
function parseTier(tierParam: string | null): WordTier | null {
  if (!tierParam) return null

  const tier = parseInt(tierParam, 10)
  if (isNaN(tier) || tier < 1 || tier > 7) return null

  return tier as WordTier
}

/**
 * Parse comma-separated exclude IDs.
 * Filters out empty strings and limits to 100 IDs to prevent abuse.
 */
function parseExcludeIds(excludeParam: string | null): string[] {
  if (!excludeParam) return []

  return excludeParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .slice(0, 100) // Limit to prevent abuse
}

// =============================================================================
// LOCAL DEVELOPMENT: WRANGLER CLI QUERIES
// =============================================================================

/**
 * Query the local D1 database via Wrangler CLI.
 * Used in local development when Cloudflare runtime is not available.
 */
function queryLocalD1(sql: string): unknown[] {
  const PROJECT_ROOT = path.resolve(process.cwd())
  const escapedSql = sql.replace(/"/g, '\\"')
  const command = `npx wrangler d1 execute playlexi-db --local --command="${escapedSql}" --json`

  try {
    const result = execSync(command, {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Parse JSON output from wrangler
    const parsed = JSON.parse(result)

    // Wrangler returns an array with result objects
    if (Array.isArray(parsed) && parsed[0]?.results) {
      return parsed[0].results
    }

    return []
  } catch (error) {
    console.error("[D1 Local] Query failed:", error)
    throw error
  }
}

/**
 * Get a random word from local D1 database.
 */
function getRandomWordLocal(tier: WordTier, excludeIds: string[]): Word | null {
  // Build SQL query
  let sql = `SELECT * FROM words WHERE difficulty_tier = ${tier}`

  if (excludeIds.length > 0) {
    const escapedIds = excludeIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")
    sql += ` AND id NOT IN (${escapedIds})`
  }

  sql += " ORDER BY RANDOM() LIMIT 1"

  const results = queryLocalD1(sql) as Array<{
    id: string
    word: string
    difficulty_tier: number
    definition: string
    example_sentence: string
    audio_url: string
    part_of_speech: string
  }>

  if (results.length === 0) {
    // Try again without exclusions
    if (excludeIds.length > 0) {
      const fallbackSql = `SELECT * FROM words WHERE difficulty_tier = ${tier} ORDER BY RANDOM() LIMIT 1`
      const fallbackResults = queryLocalD1(fallbackSql) as typeof results
      if (fallbackResults.length > 0) {
        return mapDbRowToWord(fallbackResults[0])
      }
    }
    return null
  }

  return mapDbRowToWord(results[0])
}

/**
 * Map database row to Word interface.
 */
function mapDbRowToWord(row: {
  id: string
  word: string
  difficulty_tier: number
  definition: string
  example_sentence: string
  audio_url: string
  part_of_speech: string
}): Word {
  return {
    id: row.id,
    word: row.word,
    tier: row.difficulty_tier as WordTier,
    definition: row.definition,
    sentence: row.example_sentence,
    audioUrl: row.audio_url,
    partOfSpeech: row.part_of_speech,
  }
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * GET /api/words/random
 *
 * Fetches a random word from the D1 database.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const tier = parseTier(searchParams.get("tier"))
    const excludeIds = parseExcludeIds(searchParams.get("excludeIds"))

    // Validate tier parameter
    if (tier === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or missing 'tier' parameter. Must be 1-7.",
        },
        { status: 400 }
      )
    }

    // Use local D1 via Wrangler CLI in development
    // TODO: When @cloudflare/next-on-pages supports Next.js 16,
    // add Cloudflare runtime branch using getRequestContext()
    const word = getRandomWordLocal(tier, excludeIds)

    if (!word) {
      return NextResponse.json(
        {
          success: false,
          error: `No words available for tier ${tier}.`,
        },
        { status: 404 }
      )
    }

    // Note: In local dev, we skip incrementing served count for simplicity
    // This will be handled properly in production with Cloudflare runtime

    return NextResponse.json({
      success: true,
      word,
    })
  } catch (error) {
    // Log error for debugging
    console.error("[API] Error fetching random word:", error)

    // Return generic error (don't expose internal details)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error. Please try again.",
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// RUNTIME CONFIGURATION
// =============================================================================

/**
 * Note: Edge runtime is disabled until @cloudflare/next-on-pages
 * supports Next.js 16. Current version (1.13.x) only supports up to 15.5.2.
 *
 * When deploying to Cloudflare Pages:
 * 1. Wait for next-on-pages to support Next.js 16, OR
 * 2. Downgrade to Next.js 15.x
 *
 * Then uncomment:
 * export const runtime = "edge"
 */
