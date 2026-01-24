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
 * @see lib/services/d1-word-data-source.ts
 * @see lib/word-service.ts for Word type definition
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { WordTier, Word } from "@/lib/word-service"
import { createDb } from "@/db"
import { createD1WordDataSource } from "@/lib/services/d1-word-data-source"

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

    // Debug: Log incoming request
    console.log(`[API] /api/words/random - tier=${tier}, excludeIds count=${excludeIds.length}`)
    if (excludeIds.length > 0) {
      console.log(`[API] Excluding IDs:`, excludeIds)
    }

    // Get D1 database binding from Cloudflare context via OpenNext
    // This works in both production AND local development thanks to
    // initOpenNextCloudflareForDev() in next.config.ts
    const { env } = await getCloudflareContext({ async: true })

    // Create database connection and data source
    const db = createDb(env.DB)
    const dataSource = createD1WordDataSource(db)

    // Fetch random word
    const word = await dataSource.getRandomWord(tier, excludeIds)

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
    console.log(`[API] Returning word: "${word.word}" (id=${word.id})`)

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
