/**
 * Drizzle Kit Configuration
 *
 * Used by drizzle-kit for generating and running migrations.
 *
 * ## Commands
 *
 * Generate migration from schema changes:
 *   npx drizzle-kit generate
 *
 * Push schema directly (dev only, no migration files):
 *   npx drizzle-kit push
 *
 * Open Drizzle Studio (GUI for database):
 *   npx drizzle-kit studio
 *
 * @see https://orm.drizzle.team/kit-docs/overview
 */

import { defineConfig } from "drizzle-kit"

export default defineConfig({
  // Schema location
  schema: "./db/schema.ts",

  // Output directory for migrations
  out: "./migrations",

  // Database dialect
  dialect: "sqlite",

  // Verbose logging during migrations
  verbose: true,

  // Strict mode - fail on warnings
  strict: true,
})
