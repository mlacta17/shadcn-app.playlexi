/**
 * Database Connection — PlayLexi
 *
 * This module provides the database connection setup for Cloudflare D1.
 * Drizzle ORM handles the actual queries with full TypeScript support.
 *
 * ## Usage in Cloudflare Workers/Pages
 *
 * In your API routes, access the database via the Cloudflare context:
 *
 * ```typescript
 * // app/api/example/route.ts
 * import { createDb } from "@/db"
 * import { getCloudflareContext } from "@opennextjs/cloudflare"
 *
 * export async function GET(request: Request) {
 *   const { env } = await getCloudflareContext({ async: true })
 *   const db = createDb(env.DB)
 *
 *   const users = await db.query.users.findMany()
 *   return Response.json(users)
 * }
 * ```
 *
 * ## Local Development
 *
 * For local development with Wrangler:
 * 1. Run `npx wrangler d1 create playlexi-db` (one time)
 * 2. Run `npm run db:migrate` to apply migrations
 * 3. Run `npm run dev` — Wrangler binds the local D1 database
 *
 * @see docs/ARCHITECTURE.md Section 1.3 (Infrastructure)
 */

import { drizzle } from "drizzle-orm/d1"
import * as schema from "./schema"

// =============================================================================
// DATABASE FACTORY
// =============================================================================

/**
 * Create a Drizzle database instance from a D1 binding.
 *
 * This is the primary entry point for database access throughout the app.
 * The D1 binding is provided by Cloudflare's runtime environment.
 *
 * @param d1 - The D1 database binding from Cloudflare
 * @returns A typed Drizzle database instance
 *
 * @example
 * ```typescript
 * // In a Cloudflare Workers route handler
 * import { createDb } from "@/db"
 *
 * export async function onRequest(context) {
 *   const db = createDb(context.env.DB)
 *   const user = await db.query.users.findFirst({
 *     where: eq(schema.users.id, userId)
 *   })
 *   return new Response(JSON.stringify(user))
 * }
 * ```
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

/**
 * Type for the database instance returned by createDb.
 * Use this when you need to pass the database as a parameter.
 *
 * @example
 * ```typescript
 * async function getUser(db: Database, userId: string) {
 *   return db.query.users.findFirst({
 *     where: eq(schema.users.id, userId)
 *   })
 * }
 * ```
 */
export type Database = ReturnType<typeof createDb>

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Re-export schema for convenient access
export * from "./schema"

// Re-export inferred types for convenient access
export * from "./types"

// Re-export common Drizzle operators for queries
export { eq, and, or, gt, gte, lt, lte, ne, isNull, isNotNull, inArray, notInArray, like, sql } from "drizzle-orm"
