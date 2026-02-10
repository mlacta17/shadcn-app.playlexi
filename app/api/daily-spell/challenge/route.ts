/**
 * Daily Spell Challenge API Route — PlayLexi
 *
 * Handles challenge link operations for viral sharing.
 *
 * ## Endpoints
 *
 * GET /api/daily-spell/challenge
 * - Get or create user's challenge link
 * - Returns: { code, acceptedCount }
 *
 * POST /api/daily-spell/challenge
 * - Record a challenge link click (for tracking)
 * - Body: { code, visitorId }
 *
 * @see lib/services/daily-spell-service.ts for business logic
 */

import { NextResponse } from "next/server"
import { requireAuth, optionalAuth, handleApiError, Errors } from "@/lib/api"
import {
  getOrCreateChallengeLink,
  recordChallengeClick,
} from "@/lib/services/daily-spell-service"

// =============================================================================
// HANDLERS
// =============================================================================

/**
 * GET /api/daily-spell/challenge
 *
 * Get or create user's challenge link.
 * Requires authentication.
 */
export async function GET() {
  try {
    const { user, db } = await requireAuth()

    const challenge = await getOrCreateChallengeLink(db, user.id)

    return NextResponse.json(challenge)
  } catch (error) {
    return handleApiError(error, "[GetChallengeLink]")
  }
}

/**
 * POST /api/daily-spell/challenge
 *
 * Record a challenge link click.
 * Used for tracking referrals.
 */
export async function POST(request: Request) {
  try {
    const { db } = await optionalAuth()
    const body = (await request.json()) as { code: string; visitorId: string }

    // Validate input
    if (!body.code) {
      throw Errors.validation("code is required")
    }

    if (!body.visitorId) {
      throw Errors.validation("visitorId is required")
    }

    await recordChallengeClick(db, body.code, body.visitorId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "[RecordChallengeClick]")
  }
}
