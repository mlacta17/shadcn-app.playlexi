/**
 * Better Auth Database Schema — PlayLexi
 *
 * These tables are required by Better Auth for authentication.
 * They are separate from the main PlayLexi schema to keep concerns isolated.
 *
 * ## Tables
 *
 * - `auth_user`: Core user identity (email, name, image)
 * - `auth_session`: Active login sessions
 * - `auth_account`: OAuth provider connections (Google, etc.)
 * - `auth_verification`: Email/phone verification tokens
 *
 * ## Relationship to PlayLexi Users
 *
 * The `auth_user.id` links to our `users.id` table. After OAuth login,
 * we check if a PlayLexi user exists and create one if not.
 *
 * @see lib/auth/index.ts for the auth configuration
 * @see db/schema.ts for the main application schema
 */

import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core"

// =============================================================================
// BETTER AUTH CORE TABLES
// =============================================================================

/**
 * Auth User — Core identity from Better Auth.
 *
 * This stores the OAuth user info (email, name, avatar).
 * The `id` field links to our `users` table for game data.
 */
export const user = sqliteTable(
  "auth_user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    emailIdx: index("idx_auth_user_email").on(table.email),
  })
)

/**
 * Auth Session — Active login sessions.
 *
 * Each browser/device gets its own session.
 * Sessions are validated on each request via cookies.
 */
export const session = sqliteTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_auth_session_user_id").on(table.userId),
    tokenIdx: index("idx_auth_session_token").on(table.token),
  })
)

/**
 * Auth Account — OAuth provider connections.
 *
 * Links OAuth providers (Google) to auth users.
 * One user can have multiple accounts (e.g., Google + Apple).
 */
export const account = sqliteTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_auth_account_user_id").on(table.userId),
    providerAccountIdx: index("idx_auth_account_provider").on(
      table.providerId,
      table.accountId
    ),
  })
)

/**
 * Auth Verification — Email/phone verification tokens.
 *
 * Used for email verification flows (not currently used since we
 * rely on OAuth which provides verified emails).
 */
export const verification = sqliteTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" }),
  },
  (table) => ({
    identifierIdx: index("idx_auth_verification_identifier").on(table.identifier),
  })
)
