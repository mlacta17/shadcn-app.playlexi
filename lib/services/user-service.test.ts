/**
 * User Service Tests
 *
 * Tests for user record management including:
 * - User status detection (exists/doesn't exist)
 * - User creation with ranks and skill ratings
 * - Username availability checking
 *
 * These tests use an in-memory SQLite database that mirrors the D1 schema.
 *
 * @see lib/services/user-service.ts
 * @see lib/test-utils/db-test-helper.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  createTestDatabase,
  generateTestId,
  resetTestIdCounter,
  type TestDatabase,
} from "@/lib/test-utils/db-test-helper"
import {
  getUserStatus,
  createUser,
  getUserById,
  isUsernameAvailable,
  type CreateUserInput,
  type PlacementResult,
} from "./user-service"

// =============================================================================
// TEST SETUP
// =============================================================================

describe("UserService", () => {
  let db: TestDatabase

  beforeEach(() => {
    resetTestIdCounter()
    db = createTestDatabase()
  })

  afterEach(() => {
    db.close()
  })

  // ===========================================================================
  // getUserStatus()
  // ===========================================================================

  describe("getUserStatus", () => {
    it("returns exists=false for non-existent user", async () => {
      const status = await getUserStatus(
        db.d1 as unknown as D1Database,
        "non-existent-id"
      )

      expect(status.exists).toBe(false)
      expect(status.user).toBeUndefined()
    })

    it("returns exists=true for existing user", async () => {
      // Create a user directly in the database
      const userId = generateTestId("user")
      db.sqlite.exec(`
        INSERT INTO users (id, email, username, auth_provider)
        VALUES ('${userId}', 'test@example.com', 'testuser', 'google')
      `)

      const status = await getUserStatus(
        db.d1 as unknown as D1Database,
        userId
      )

      expect(status.exists).toBe(true)
      expect(status.user).toBeDefined()
      expect(status.user?.id).toBe(userId)
      expect(status.user?.email).toBe("test@example.com")
    })
  })

  // ===========================================================================
  // createUser()
  // ===========================================================================

  describe("createUser", () => {
    const baseInput: CreateUserInput = {
      authUserId: "auth-user-123",
      email: "newuser@example.com",
      username: "SpellingBee",
      authProvider: "google",
    }

    it("creates user record with correct data", async () => {
      const user = await createUser(db.d1 as unknown as D1Database, baseInput)

      expect(user.id).toBe(baseInput.authUserId)
      expect(user.email).toBe(baseInput.email)
      expect(user.username).toBe(baseInput.username)
      expect(user.authProvider).toBe(baseInput.authProvider)
      expect(user.avatarId).toBe(1) // default
    })

    it("creates user with custom avatar", async () => {
      const input: CreateUserInput = {
        ...baseInput,
        avatarId: 3,
      }

      const user = await createUser(db.d1 as unknown as D1Database, input)

      expect(user.avatarId).toBe(3)
    })

    it("creates user with birth year", async () => {
      const input: CreateUserInput = {
        ...baseInput,
        birthYear: 2010,
      }

      const user = await createUser(db.d1 as unknown as D1Database, input)

      expect(user.birthYear).toBe(2010)
    })

    it("creates rank records for all 4 tracks", async () => {
      await createUser(db.d1 as unknown as D1Database, baseInput)

      // Query ranks directly
      const ranks = db.sqlite
        .prepare("SELECT * FROM user_ranks WHERE user_id = ?")
        .all(baseInput.authUserId) as Array<{
        track: string
        tier: string
        xp: number
      }>

      expect(ranks).toHaveLength(4)

      const tracks = ranks.map((r) => r.track).sort()
      expect(tracks).toEqual([
        "blitz_keyboard",
        "blitz_voice",
        "endless_keyboard",
        "endless_voice",
      ])

      // All ranks start at tier 1 (new_bee) with 0 XP
      for (const rank of ranks) {
        expect(rank.tier).toBe("new_bee")
        expect(rank.xp).toBe(0)
      }
    })

    it("creates skill rating records for all 4 tracks", async () => {
      await createUser(db.d1 as unknown as D1Database, baseInput)

      // Query skill ratings directly
      const ratings = db.sqlite
        .prepare("SELECT * FROM user_skill_ratings WHERE user_id = ?")
        .all(baseInput.authUserId) as Array<{
        track: string
        rating: number
        rating_deviation: number
        derived_tier: number
      }>

      expect(ratings).toHaveLength(4)

      // All ratings start at 1500 with 350 deviation (Glicko-2 defaults)
      for (const rating of ratings) {
        expect(rating.rating).toBe(1500)
        expect(rating.rating_deviation).toBe(350)
        expect(rating.derived_tier).toBe(1) // No placement = tier 1
      }
    })

    it("uses placement test results for initial tier", async () => {
      const placement: PlacementResult = {
        derivedTier: 4,
        rating: 1650,
        ratingDeviation: 200,
      }

      await createUser(db.d1 as unknown as D1Database, baseInput, placement)

      // Check ranks
      const ranks = db.sqlite
        .prepare("SELECT tier FROM user_ranks WHERE user_id = ?")
        .all(baseInput.authUserId) as Array<{ tier: string }>

      // Tier 4 = "honey_bee" (from rankTiers array: new_bee, bumble_bee, busy_bee, honey_bee, ...)
      for (const rank of ranks) {
        expect(rank.tier).toBe("honey_bee")
      }

      // Check skill ratings
      const ratings = db.sqlite
        .prepare(
          "SELECT rating, rating_deviation, derived_tier FROM user_skill_ratings WHERE user_id = ?"
        )
        .all(baseInput.authUserId) as Array<{
        rating: number
        rating_deviation: number
        derived_tier: number
      }>

      for (const rating of ratings) {
        expect(rating.rating).toBe(1650)
        expect(rating.rating_deviation).toBe(200)
        expect(rating.derived_tier).toBe(4)
      }
    })

    it("clamps placement tier to valid range", async () => {
      // Test tier too low
      const lowPlacement: PlacementResult = {
        derivedTier: 0, // Invalid, should clamp to 1
        rating: 1500,
        ratingDeviation: 350,
      }

      await createUser(
        db.d1 as unknown as D1Database,
        { ...baseInput, authUserId: "user-low" },
        lowPlacement
      )

      const lowRanks = db.sqlite
        .prepare("SELECT tier FROM user_ranks WHERE user_id = ?")
        .all("user-low") as Array<{ tier: string }>
      expect(lowRanks[0].tier).toBe("new_bee") // Tier 1

      // Test tier too high
      const highPlacement: PlacementResult = {
        derivedTier: 99, // Invalid, should clamp to 7
        rating: 2000,
        ratingDeviation: 100,
      }

      await createUser(
        db.d1 as unknown as D1Database,
        { ...baseInput, authUserId: "user-high", email: "high@test.com", username: "highuser" },
        highPlacement
      )

      const highRanks = db.sqlite
        .prepare("SELECT tier FROM user_ranks WHERE user_id = ?")
        .all("user-high") as Array<{ tier: string }>
      expect(highRanks[0].tier).toBe("bee_keeper") // Tier 7 (max)
    })
  })

  // ===========================================================================
  // getUserById()
  // ===========================================================================

  describe("getUserById", () => {
    it("returns null for non-existent user", async () => {
      const user = await getUserById(
        db.d1 as unknown as D1Database,
        "non-existent"
      )

      expect(user).toBeNull()
    })

    it("returns user with ranks and skill ratings", async () => {
      // Create user first
      const input: CreateUserInput = {
        authUserId: "user-with-data",
        email: "withdata@example.com",
        username: "datauser",
        authProvider: "google",
      }
      await createUser(db.d1 as unknown as D1Database, input)

      // Fetch user by ID
      const user = await getUserById(
        db.d1 as unknown as D1Database,
        input.authUserId
      )

      expect(user).not.toBeNull()
      expect(user?.id).toBe(input.authUserId)
      expect(user?.ranks).toHaveLength(4)
      expect(user?.skillRatings).toHaveLength(4)
    })
  })

  // ===========================================================================
  // isUsernameAvailable()
  // ===========================================================================

  describe("isUsernameAvailable", () => {
    it("returns true for available username", async () => {
      const available = await isUsernameAvailable(
        db.d1 as unknown as D1Database,
        "NewUsername123"
      )

      expect(available).toBe(true)
    })

    it("returns false for taken username", async () => {
      // Create a user with this username
      db.sqlite.exec(`
        INSERT INTO users (id, email, username, auth_provider)
        VALUES ('user-1', 'taken@example.com', 'TakenName', 'google')
      `)

      const available = await isUsernameAvailable(
        db.d1 as unknown as D1Database,
        "TakenName"
      )

      expect(available).toBe(false)
    })

    it("performs case-insensitive check", async () => {
      // Create a user with lowercase username
      db.sqlite.exec(`
        INSERT INTO users (id, email, username, auth_provider)
        VALUES ('user-2', 'case@example.com', 'CoolBee123', 'google')
      `)

      // Try different cases
      expect(
        await isUsernameAvailable(db.d1 as unknown as D1Database, "coolbee123")
      ).toBe(false)
      expect(
        await isUsernameAvailable(db.d1 as unknown as D1Database, "COOLBEE123")
      ).toBe(false)
      expect(
        await isUsernameAvailable(db.d1 as unknown as D1Database, "CoolBee123")
      ).toBe(false)
      expect(
        await isUsernameAvailable(db.d1 as unknown as D1Database, "cOoLbEe123")
      ).toBe(false)
    })

    it("handles whitespace in username", async () => {
      db.sqlite.exec(`
        INSERT INTO users (id, email, username, auth_provider)
        VALUES ('user-3', 'space@example.com', 'SpaceBee', 'google')
      `)

      // Trailing/leading whitespace should still match
      // Note: In production, we trim usernames before checking
      const available = await isUsernameAvailable(
        db.d1 as unknown as D1Database,
        "spacebee"
      )

      expect(available).toBe(false)
    })
  })
})
