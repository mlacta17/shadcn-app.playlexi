/**
 * Admin Cleanup API — Data Retention Jobs
 *
 * POST /api/admin/cleanup
 *
 * Performs scheduled cleanup tasks for data retention:
 * - Deletes recognition logs older than 30 days
 * - Can be extended for other cleanup tasks
 *
 * ## Security
 *
 * This endpoint requires a secret key to prevent unauthorized access.
 * Set ADMIN_CLEANUP_SECRET in your environment.
 *
 * ## Usage
 *
 * For Cloudflare Cron Triggers:
 * - Add to wrangler.toml: `[triggers] crons = ["0 3 * * *"]`
 * - The _worker.ts file should call this endpoint when triggered
 *
 * For manual testing:
 * ```bash
 * curl -X POST http://localhost:3000/api/admin/cleanup \
 *   -H "Authorization: Bearer YOUR_SECRET"
 * ```
 *
 * @see lib/phonetic-learning/recognition-logger.ts
 * @see db/schema.ts (recognitionLogs table)
 */

import { NextRequest, NextResponse } from "next/server"
import { getCloudflareContext } from "@opennextjs/cloudflare"
import { createDb, recognitionLogs } from "@/db"
import { lt } from "drizzle-orm"
import { handleApiError, Errors, type ApiErrorResponse } from "@/lib/api"

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Number of days to keep recognition logs */
const LOG_RETENTION_DAYS = 30

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface CleanupResult {
  task: string
  deleted: number
  durationMs: number
}

interface SuccessResponse {
  success: true
  results: CleanupResult[]
  totalDurationMs: number
}

interface ErrorResponse {
  success: false
  error: string
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Validate the cleanup request using a secret key.
 */
function validateAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization")
  const secret = process.env.ADMIN_CLEANUP_SECRET

  // In development, allow without auth if no secret is set
  if (!secret && process.env.NODE_ENV === "development") {
    console.warn("[Cleanup] No ADMIN_CLEANUP_SECRET set, allowing in dev mode")
    return true
  }

  if (!secret) {
    console.error("[Cleanup] ADMIN_CLEANUP_SECRET not configured")
    return false
  }

  if (!authHeader) {
    return false
  }

  // Support both "Bearer TOKEN" and just "TOKEN" formats
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader

  return token === secret
}

// =============================================================================
// CLEANUP TASKS
// =============================================================================

/**
 * Delete recognition logs older than the retention period.
 */
async function cleanupRecognitionLogs(db: ReturnType<typeof createDb>): Promise<CleanupResult> {
  const startTime = Date.now()

  // Calculate cutoff timestamp (30 days ago)
  const cutoffDate = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  // Delete old logs
  const result = await db
    .delete(recognitionLogs)
    .where(lt(recognitionLogs.createdAt, cutoffDate))
    .returning({ id: recognitionLogs.id })

  const deleted = result.length

  // Log the result
  console.log(`[Cleanup] Deleted ${deleted} recognition logs older than ${LOG_RETENTION_DAYS} days`)

  return {
    task: "recognition_logs",
    deleted,
    durationMs: Date.now() - startTime,
  }
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /api/admin/cleanup
 *
 * Run all cleanup tasks.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SuccessResponse | ApiErrorResponse>> {
  const startTime = Date.now()

  try {
    // Validate authentication
    if (!validateAuth(request)) {
      throw Errors.unauthorized("Invalid or missing authorization token")
    }

    console.log("[Cleanup] Starting cleanup job...")

    // Get database connection
    const { env } = await getCloudflareContext({ async: true })
    const db = createDb(env.DB)

    // Run cleanup tasks
    const results: CleanupResult[] = []

    // Task 1: Clean up old recognition logs
    results.push(await cleanupRecognitionLogs(db))

    // Add more cleanup tasks here as needed:
    // results.push(await cleanupOldSessions(db))
    // results.push(await cleanupExpiredNotifications(db))

    const totalDurationMs = Date.now() - startTime
    console.log(`[Cleanup] Completed in ${totalDurationMs}ms`)

    return NextResponse.json({
      success: true,
      results,
      totalDurationMs,
    })
  } catch (error) {
    return handleApiError(error, "[Cleanup]")
  }
}

/**
 * GET /api/admin/cleanup
 *
 * Returns info about the cleanup endpoint (no auth required).
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: "/api/admin/cleanup",
    method: "POST",
    description: "Runs scheduled cleanup tasks for data retention",
    tasks: [
      {
        name: "recognition_logs",
        description: `Deletes recognition logs older than ${LOG_RETENTION_DAYS} days`,
      },
    ],
    authentication: "Requires Bearer token matching ADMIN_CLEANUP_SECRET env var",
  })
}
