/**
 * Admin Puzzle Generation API
 *
 * POST /api/admin/generate-puzzles
 *
 * Bulk pre-generates daily spell puzzles. Idempotent — skips dates
 * that already have puzzles. Used by GitHub Actions cron or manual trigger.
 *
 * ## Security
 *
 * Requires Bearer token matching ADMIN_CLEANUP_SECRET env var.
 * (Same secret used by /api/admin/cleanup.)
 *
 * ## Usage
 *
 * ```bash
 * curl -X POST https://app.playlexi.com/api/admin/generate-puzzles \
 *   -H "Authorization: Bearer YOUR_SECRET" \
 *   -H "Content-Type: application/json" \
 *   -d '{"days": 7}'
 * ```
 *
 * @see lib/services/puzzle-generator.ts
 * @see .github/workflows/generate-puzzles.yml
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { handleApiError, Errors, type ApiErrorResponse } from "@/lib/api"
import { generatePuzzlesForDateRange } from "@/lib/services/puzzle-generator"

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum days that can be generated in one request */
const MAX_DAYS = 30

/** Default number of days to generate */
const DEFAULT_DAYS = 7

// =============================================================================
// AUTHENTICATION
// =============================================================================

function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization")
  const secret = process.env.ADMIN_CLEANUP_SECRET

  if (!secret && process.env.NODE_ENV === "development") {
    console.warn("[GeneratePuzzles] No ADMIN_CLEANUP_SECRET set, allowing in dev mode")
    return true
  }

  if (!secret) {
    console.error("[GeneratePuzzles] ADMIN_CLEANUP_SECRET not configured")
    return false
  }

  if (!authHeader) {
    return false
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader

  return token === secret
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get today's date in YYYY-MM-DD format (UTC).
 */
function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0]
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

interface SuccessResponse {
  success: true
  created: number
  skipped: number
  errors: string[]
  totalDurationMs: number
}

/**
 * POST /api/admin/generate-puzzles
 *
 * Generate daily spell puzzles for upcoming days.
 * Body: { days?: number } (default 7, max 30)
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ApiErrorResponse>> {
  const startTime = Date.now()

  try {
    if (!validateAuth(request)) {
      throw Errors.unauthorized("Invalid or missing authorization token")
    }

    // Parse request body
    let days = DEFAULT_DAYS
    try {
      const body = (await request.json()) as { days?: number }
      if (body.days !== undefined) {
        days = Math.min(Math.max(1, Math.floor(body.days)), MAX_DAYS)
      }
    } catch {
      // No body or invalid JSON — use defaults
    }

    console.log(`[GeneratePuzzles] Generating ${days} days starting from today`)

    // Get database connection
    const { env } = await getCloudflareContext({ async: true })

    // Generate puzzles
    const startDate = getTodayUTC()
    const result = await generatePuzzlesForDateRange(env.DB, startDate, days)

    const totalDurationMs = Date.now() - startTime
    console.log(
      `[GeneratePuzzles] Done in ${totalDurationMs}ms — created: ${result.created}, skipped: ${result.skipped}, errors: ${result.errors.length}`
    )

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
      totalDurationMs,
    })
  } catch (error) {
    return handleApiError(error, "[GeneratePuzzles]")
  }
}

/**
 * GET /api/admin/generate-puzzles
 *
 * Returns endpoint info (no auth required).
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: "/api/admin/generate-puzzles",
    method: "POST",
    description: "Generates daily spell puzzles for upcoming days",
    body: {
      days: `Number of days to generate (default: ${DEFAULT_DAYS}, max: ${MAX_DAYS})`,
    },
    authentication: "Requires Bearer token matching ADMIN_CLEANUP_SECRET env var",
  })
}
