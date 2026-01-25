/**
 * User Service — PlayLexi
 *
 * Handles user record management, including:
 * - Checking if a PlayLexi user exists for an auth user
 * - Creating new user records after profile completion
 * - Initializing user ranks and skill ratings
 *
 * ## Architecture Notes
 *
 * Better Auth creates `auth_user` records on OAuth login.
 * Our `users` table contains PlayLexi-specific data (username, age, etc.).
 * The `auth_user.id` links to `users.id`.
 *
 * ## User Status Detection
 *
 * After OAuth callback:
 * - If `users` record exists → Route to dashboard (returning user)
 * - If no `users` record → Route to onboarding/profile (new user)
 *
 * @see lib/auth/schema.ts for Better Auth tables
 * @see db/schema.ts for PlayLexi tables
 */

import type { D1Database } from "@cloudflare/workers-types"
import { drizzle } from "drizzle-orm/d1"
import { eq, sql } from "drizzle-orm"
import * as schema from "@/db/schema"
import type { AuthProvider, RankTrack } from "@/db/schema"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data required to create a new PlayLexi user.
 * Collected during the profile completion step.
 */
export interface CreateUserInput {
  /** Better Auth user ID (becomes the users.id) */
  authUserId: string
  /** Email from OAuth provider */
  email: string
  /** User-chosen display name */
  username: string
  /**
   * User's birth year for age demographics (optional).
   * Stored as year (e.g., 2010) for flexibility in age range calculations.
   * @see lib/age-utils.ts for conversion from age range selection
   */
  birthYear?: number
  /** OAuth provider used */
  authProvider: AuthProvider
  /** Selected avatar preset (1-3) */
  avatarId?: number
}

/**
 * Placement test result to initialize user ranks.
 * Stored in sessionStorage during onboarding, passed here after profile completion.
 */
export interface PlacementResult {
  /** Derived tier from placement test (1-7) */
  derivedTier: number
  /** Initial Glicko-2 rating */
  rating: number
  /** Initial rating deviation */
  ratingDeviation: number
}

/**
 * User status check result.
 */
export interface UserStatus {
  /** Whether a PlayLexi user record exists */
  exists: boolean
  /** The user record if it exists */
  user?: typeof schema.users.$inferSelect
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Check if a PlayLexi user record exists for the given auth user ID.
 *
 * Use this after OAuth callback to determine routing:
 * - exists: true → Dashboard
 * - exists: false → Profile completion
 *
 * @param d1 - D1 database binding
 * @param authUserId - Better Auth user ID
 * @returns User status with optional user record
 *
 * @example
 * ```typescript
 * const status = await getUserStatus(env.DB, session.user.id)
 * if (status.exists) {
 *   redirect("/")
 * } else {
 *   redirect("/onboarding/profile")
 * }
 * ```
 */
export async function getUserStatus(
  d1: D1Database,
  authUserId: string
): Promise<UserStatus> {
  const db = drizzle(d1, { schema })

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, authUserId),
  })

  return {
    exists: !!user,
    user: user ?? undefined,
  }
}

/**
 * Create a new PlayLexi user record.
 *
 * Called after profile completion. Creates:
 * 1. User record with profile data
 * 2. Rank records for all 4 tracks (XP-based)
 * 3. Skill rating records for all 4 tracks (Glicko-2)
 *
 * @param d1 - D1 database binding
 * @param input - User profile data from completion form
 * @param placement - Optional placement test results
 * @returns Created user record
 *
 * @example
 * ```typescript
 * const user = await createUser(env.DB, {
 *   authUserId: session.user.id,
 *   email: session.user.email,
 *   username: "SpellingBee123",
 *   age: 12,
 *   authProvider: "google",
 * }, { derivedTier: 3, rating: 1350, ratingDeviation: 200 })
 * ```
 */
export async function createUser(
  d1: D1Database,
  input: CreateUserInput,
  placement?: PlacementResult
): Promise<typeof schema.users.$inferSelect> {
  const db = drizzle(d1, { schema })

  // Use the auth user ID as the PlayLexi user ID (1:1 mapping)
  const userId = input.authUserId

  // Create user record
  const [user] = await db
    .insert(schema.users)
    .values({
      id: userId,
      email: input.email,
      username: input.username,
      birthYear: input.birthYear,
      authProvider: input.authProvider,
      avatarId: input.avatarId ?? 1,
    })
    .returning()

  // Initialize ranks and skill ratings for all 4 tracks
  const tracks: RankTrack[] = [
    "endless_voice",
    "endless_keyboard",
    "blitz_voice",
    "blitz_keyboard",
  ]

  // Derive initial tier from placement or default to tier 1 (new_bee)
  const initialTier = placement?.derivedTier ?? 1
  const tierName = getTierName(initialTier)

  // Create rank records (visible XP-based progression)
  await db.insert(schema.userRanks).values(
    tracks.map((track) => ({
      userId,
      track,
      tier: tierName,
      xp: 0,
      crownPoints: 0,
    }))
  )

  // Create skill rating records (hidden Glicko-2)
  await db.insert(schema.userSkillRatings).values(
    tracks.map((track) => ({
      userId,
      track,
      rating: placement?.rating ?? 1500,
      ratingDeviation: placement?.ratingDeviation ?? 350,
      volatility: 0.06,
      derivedTier: initialTier,
      gamesPlayed: 0,
    }))
  )

  return user
}

/**
 * Get user by ID with related data.
 *
 * @param d1 - D1 database binding
 * @param userId - User ID
 * @returns User with ranks and skill ratings, or null if not found
 */
export async function getUserById(
  d1: D1Database,
  userId: string
): Promise<(typeof schema.users.$inferSelect & {
  ranks: (typeof schema.userRanks.$inferSelect)[]
  skillRatings: (typeof schema.userSkillRatings.$inferSelect)[]
}) | null> {
  const db = drizzle(d1, { schema })

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  })

  if (!user) return null

  const ranks = await db.query.userRanks.findMany({
    where: eq(schema.userRanks.userId, userId),
  })

  const skillRatings = await db.query.userSkillRatings.findMany({
    where: eq(schema.userSkillRatings.userId, userId),
  })

  return { ...user, ranks, skillRatings }
}

/**
 * Check if a username is available.
 *
 * Performs case-insensitive check to prevent confusing duplicates
 * (e.g., "SpellingBee" and "spellingbee" cannot both exist).
 *
 * @param d1 - D1 database binding
 * @param username - Username to check
 * @returns true if available, false if taken
 */
export async function isUsernameAvailable(
  d1: D1Database,
  username: string
): Promise<boolean> {
  const db = drizzle(d1, { schema })

  // Case-insensitive check using SQLite's LOWER function
  const normalizedUsername = username.toLowerCase()
  const existing = await db.query.users.findFirst({
    where: sql`LOWER(${schema.users.username}) = ${normalizedUsername}`,
    columns: { id: true },
  })

  return !existing
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert numeric tier (1-7) to tier name.
 */
function getTierName(tier: number): typeof schema.rankTiers[number] {
  const tiers = schema.rankTiers
  // Clamp to valid range
  const index = Math.max(0, Math.min(tier - 1, tiers.length - 1))
  return tiers[index]
}
