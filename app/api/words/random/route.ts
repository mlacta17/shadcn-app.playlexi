/**
 * Random Word API — Serves random words from D1 database.
 *
 * GET /api/words/random?tier=3&excludeIds=abc,def&lastWordId=xyz&adaptiveMixing=true
 *
 * Returns a random word from the specified difficulty tier,
 * with smart fallback to adjacent tiers when primary tier is exhausted.
 *
 * ## Query Parameters
 *
 * | Param | Required | Description |
 * |-------|----------|-------------|
 * | tier | Yes | Difficulty tier 1-7 |
 * | excludeIds | No | Comma-separated word IDs to exclude (session history) |
 * | lastWordId | No | ID of the last word served (prevents immediate repeat) |
 * | adaptiveMixing | No | Enable 10% chance of adjacent tier (default: false) |
 *
 * ## Fallback Behavior
 *
 * When the requested tier is exhausted (all words in excludeIds):
 * 1. Try adjacent tiers (tier+1, tier-1, tier+2, tier-2, etc.)
 * 2. Allow repeats from primary tier (but not lastWordId)
 * 3. Any word from any tier (last resort)
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
 * @see lib/services/d1-word-data-source.ts
 * @see lib/word-service.ts for Word type definition
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { WordTier, Word } from "@/lib/word-service"
import { createDb } from "@/db"
import { createD1WordDataSource, type RandomWordOptions } from "@/lib/services/d1-word-data-source"

// =============================================================================
// CLOUDFLARE ENV AUGMENTATION
// =============================================================================

// Extend the global CloudflareEnv interface to include our D1 binding
declare global {
  interface CloudflareEnv {
    DB: D1Database
  }
}

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

/**
 * Parse boolean query parameter.
 * Returns true only for explicit "true" or "1" values.
 */
function parseBoolean(param: string | null): boolean {
  if (!param) return false
  return param.toLowerCase() === "true" || param === "1"
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * GET /api/words/random
 *
 * Fetches a random word from the D1 database with smart tier fallback.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const tier = parseTier(searchParams.get("tier"))
    const excludeIds = parseExcludeIds(searchParams.get("excludeIds"))
    const lastWordId = searchParams.get("lastWordId") || undefined
    const enableAdaptiveMixing = parseBoolean(searchParams.get("adaptiveMixing"))

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

    // Debug: Log incoming request
    console.log(
      `[API] /api/words/random - tier=${tier}, excludeIds=${excludeIds.length}, ` +
      `lastWordId=${lastWordId ? "set" : "none"}, adaptiveMixing=${enableAdaptiveMixing}`
    )

    // Get D1 database binding from Cloudflare context via OpenNext
    // This works in both production AND local development thanks to
    // initOpenNextCloudflareForDev() in next.config.ts
    const { env } = await getCloudflareContext({ async: true })

    // Create database connection and data source
    const db = createDb(env.DB)
    const dataSource = createD1WordDataSource(db)

    // Build options for enhanced word fetching
    const options: RandomWordOptions = {
      excludeIds,
      lastWordId,
      enableAdaptiveMixing,
    }

    // Fetch random word with fallback logic
    const word = await dataSource.getRandomWord(tier, options)

    if (!word) {
      return NextResponse.json(
        {
          success: false,
          error: `No words available for tier ${tier}.`,
        },
        { status: 404 }
      )
    }

    // Debug: Log returned word
    console.log(`[API] Returning word: "${word.word}" (id=${word.id}, tier=${word.tier})`)

    return NextResponse.json({
      success: true,
      word,
    })
  } catch (error) {
    // Log error with full context for debugging
    console.error("[GetRandomWord] Error:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

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
