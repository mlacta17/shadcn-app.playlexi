/**
 * Drizzle Kit Configuration
 *
 * Used by drizzle-kit for generating and running migrations.
 *
 * ## Commands
 *
 * Generate migration from schema changes:
 *   npx drizzle-kit generate:sqlite
 *
 * Push schema directly (dev only, no migration files):
 *   npx drizzle-kit push:sqlite
 *
 * Open Drizzle Studio (GUI for database):
 *   npx drizzle-kit studio
 *
 * @see https://orm.drizzle.team/kit-docs/overview
 */

import type { Config } from "drizzle-kit"

export default {
  // Schema location
  schema: "./db/schema.ts",

  // Output directory for migrations
  out: "./migrations",

  // Database driver (SQLite for D1)
  driver: "d1",

  // D1 database configuration for local development
  // Wrangler creates this file when running locally
  dbCredentials: {
    wranglerConfigPath: "./wrangler.toml",
    dbName: "playlexi-db",
  },

  // Verbose logging during migrations
  verbose: true,

  // Strict mode - fail on warnings
  strict: true,
} satisfies Config
