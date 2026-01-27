/**
 * User Phonetic Mappings API
 *
 * GET /api/phonetic-learning/mappings
 * - Returns all phonetic mappings for the authenticated user
 *
 * POST /api/phonetic-learning/mappings
 * - Creates a new phonetic mapping (auto-learned or manual)
 *
 * ## Authentication
 *
 * Both endpoints require authentication. The user ID is extracted from
 * the session, NOT from query params or request body. This prevents:
 * - Reading other users' phonetic mappings
 * - Creating mappings for other users
 *
 * ## Usage
 *
 * Fetch user's mappings at game start for optimal performance:
 *
 * ```typescript
 * const response = await fetch('/api/phonetic-learning/mappings')
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
import { createDb, userPhoneticMappings, eq, sql } from "@/db"
import type { PhoneticMapping } from "@/lib/phonetic-learning"
import { requireAuth, handleApiError, Errors, type ApiErrorResponse } from "@/lib/api"

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
 * Fetches all phonetic mappings for the authenticated user.
 * Requires authentication — users can only read their own mappings.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<GetSuccessResponse | ApiErrorResponse>> {
  try {
    // Require authentication — user can only read their own mappings
    const { user, db: d1Binding } = await requireAuth()
    const db = createDb(d1Binding)

    // Fetch authenticated user's mappings
    const rows = await db
      .select()
      .from(userPhoneticMappings)
      .where(eq(userPhoneticMappings.userId, user.id))

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
    return handleApiError(error, "[GetPhoneticMappings]")
  }
}

// =============================================================================
// POST HANDLER
// =============================================================================

/**
 * POST /api/phonetic-learning/mappings
 *
 * Creates a new phonetic mapping for the authenticated user.
 * Requires authentication — users can only create mappings for themselves.
 *
 * Request body:
 * ```json
 * {
 *   "heard": "ohs",
 *   "intended": "o",
 *   "source": "auto_learned",
 *   "confidence": 0.85,
 *   "occurrenceCount": 3
 * }
 * ```
 *
 * Note: userId is no longer accepted — it's taken from auth session.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<PostSuccessResponse | ApiErrorResponse>> {
  try {
    // Require authentication — user can only create their own mappings
    const { user, db: d1Binding } = await requireAuth()
    const db = createDb(d1Binding)

    const body = (await request.json()) as {
      heard?: string
      intended?: string
      source?: string
      confidence?: number
      occurrenceCount?: number
    }

    if (!body.heard || typeof body.heard !== "string") {
      throw Errors.invalidInput("heard", "Required field missing or invalid type")
    }

    if (!body.intended || typeof body.intended !== "string") {
      throw Errors.invalidInput("intended", "Required field missing or invalid type")
    }

    // Validate intended is a reasonable length (1-2 characters for letters)
    if (body.intended.length > 2) {
      throw Errors.invalidInput("intended", "Must be 1-2 characters", "1-2 chars", body.intended)
    }

    // Validate and parse source
    const validSources = ["auto_learned", "manual", "support_added"] as const
    type ValidSource = (typeof validSources)[number]
    const source: ValidSource = validSources.includes(body.source as ValidSource)
      ? (body.source as ValidSource)
      : "auto_learned"

    // Prepare mapping data (use authenticated user's ID)
    const mappingData = {
      userId: user.id,
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
      throw Errors.database("insert", { table: "userPhoneticMappings" })
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
    return handleApiError(error, "[CreatePhoneticMapping]")
  }
}
