/**
 * User Phonetic Mappings API
 *
 * GET /api/phonetic-learning/mappings?userId=abc123
 * - Returns all phonetic mappings for a user
 *
 * POST /api/phonetic-learning/mappings
 * - Creates a new phonetic mapping (auto-learned or manual)
 *
 * ## Usage
 *
 * Fetch user's mappings at game start for optimal performance:
 *
 * ```typescript
 * const response = await fetch(`/api/phonetic-learning/mappings?userId=${userId}`)
 * const { mappings } = await response.json()
 *
 * // Convert to Map for fast lookup
 * const userMappings = new Map(mappings.map(m => [m.heard, m.intended]))
 * ```
 *
 * @see lib/phonetic-learning/learning-engine.ts
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createDb, userPhoneticMappings, eq, sql } from "@/db"
import type { PhoneticMapping } from "@/lib/phonetic-learning"

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface GetSuccessResponse {
  success: true
  mappings: PhoneticMapping[]
}

interface PostSuccessResponse {
  success: true
  id: string
  mapping: PhoneticMapping
}

interface ErrorResponse {
  success: false
  error: string
}

// =============================================================================
// GET HANDLER
// =============================================================================

/**
 * GET /api/phonetic-learning/mappings
 *
 * Fetches all phonetic mappings for a user.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GetSuccessResponse | ErrorResponse>> {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "userId parameter is required",
        },
        { status: 400 }
      )
    }

    // Get D1 database binding
    const { env } = await getCloudflareContext({ async: true })
    const db = createDb(env.DB)

    // Fetch user's mappings
    const rows = await db
      .select()
      .from(userPhoneticMappings)
      .where(eq(userPhoneticMappings.userId, userId))

    // Transform to PhoneticMapping type
    const mappings: PhoneticMapping[] = rows.map((row) => ({
      userId: row.userId,
      heard: row.heard,
      intended: row.intended,
      source: row.source as PhoneticMapping["source"],
      confidence: row.confidence,
      occurrenceCount: row.occurrenceCount,
      timesApplied: row.timesApplied,
    }))

    return NextResponse.json({
      success: true,
      mappings,
    })
  } catch (error) {
    // Log error with full context for debugging
    console.error("[GetPhoneticMappings] Error:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch phonetic mappings",
      },
      { status: 500 }
    )
  }
}

// =============================================================================
// POST HANDLER
// =============================================================================

/**
 * POST /api/phonetic-learning/mappings
 *
 * Creates a new phonetic mapping.
 *
 * Request body:
 * ```json
 * {
 *   "userId": "abc123",
 *   "heard": "ohs",
 *   "intended": "o",
 *   "source": "auto_learned",
 *   "confidence": 0.85,
 *   "occurrenceCount": 3
 * }
 * ```
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<PostSuccessResponse | ErrorResponse>> {
  try {
    const body = (await request.json()) as {
      userId?: string
      heard?: string
      intended?: string
      source?: string
      confidence?: number
      occurrenceCount?: number
    }

    // Validate required fields
    if (!body.userId || typeof body.userId !== "string") {
      return NextResponse.json(
        { success: false, error: "userId is required" },
        { status: 400 }
      )
    }

    if (!body.heard || typeof body.heard !== "string") {
      return NextResponse.json(
        { success: false, error: "heard is required" },
        { status: 400 }
      )
    }

    if (!body.intended || typeof body.intended !== "string") {
      return NextResponse.json(
        { success: false, error: "intended is required" },
        { status: 400 }
      )
    }

    // Validate intended is a reasonable length (1-2 characters for letters)
    if (body.intended.length > 2) {
      return NextResponse.json(
        { success: false, error: "intended must be 1-2 characters" },
        { status: 400 }
      )
    }

    // Get D1 database binding
    const { env } = await getCloudflareContext({ async: true })
    const db = createDb(env.DB)

    // Validate and parse source
    const validSources = ["auto_learned", "manual", "support_added"] as const
    type ValidSource = (typeof validSources)[number]
    const source: ValidSource = validSources.includes(body.source as ValidSource)
      ? (body.source as ValidSource)
      : "auto_learned"

    // Prepare mapping data
    const mappingData = {
      userId: body.userId,
      heard: body.heard.toLowerCase().trim(),
      intended: body.intended.toLowerCase().trim(),
      source,
      confidence: body.confidence ?? 0.75,
      occurrenceCount: body.occurrenceCount ?? 1,
      timesApplied: 0,
    }

    // Insert or update (upsert)
    // If mapping already exists for this user+heard, update it
    const result = await db
      .insert(userPhoneticMappings)
      .values(mappingData)
      .onConflictDoUpdate({
        target: [userPhoneticMappings.userId, userPhoneticMappings.heard],
        set: {
          intended: mappingData.intended,
          source: mappingData.source,
          confidence: mappingData.confidence,
          occurrenceCount: sql`${userPhoneticMappings.occurrenceCount} + 1`,
          updatedAt: sql`(unixepoch())`,
        },
      })
      .returning({ id: userPhoneticMappings.id })

    const insertedId = result[0]?.id

    if (!insertedId) {
      throw new Error("Failed to insert mapping")
    }

    return NextResponse.json(
      {
        success: true,
        id: insertedId,
        mapping: mappingData as PhoneticMapping,
      },
      { status: 201 }
    )
  } catch (error) {
    // Log error with full context for debugging
    console.error("[CreatePhoneticMapping] Error:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create phonetic mapping",
      },
      { status: 500 }
    )
  }
}
