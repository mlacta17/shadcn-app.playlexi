/**
 * Database Test Helper — PlayLexi
 *
 * Provides in-memory SQLite database for testing database services.
 * Uses better-sqlite3 with Drizzle ORM to simulate D1 behavior.
 *
 * ## Why In-Memory SQLite?
 *
 * 1. Fast: No disk I/O, tests run in milliseconds
 * 2. Isolated: Each test gets a fresh database
 * 3. Compatible: D1 is SQLite-based, behavior is nearly identical
 * 4. CI-friendly: No external services required
 *
 * ## Usage
 *
 * ```typescript
 * import { createTestDatabase } from "@/lib/test-utils/db-test-helper"
 *
 * describe("UserService", () => {
 *   let db: TestDatabase
 *
 *   beforeEach(() => {
 *     db = createTestDatabase()
 *   })
 *
 *   afterEach(() => {
 *     db.close()
 *   })
 *
 *   it("creates user", async () => {
 *     // db.drizzle is a Drizzle instance
 *     // db.d1 is a D1-compatible mock for services that expect D1Database
 *     const result = await createUser(db.d1, { ... })
 *   })
 * })
 * ```
 *
 * ## Architecture Note
 *
 * Services like `user-service.ts` take a `D1Database` parameter.
 * The `db.d1` property implements the D1Database interface by wrapping
 * better-sqlite3, allowing these services to work unchanged in tests.
 *
 * @see lib/services/user-service.ts
 * @see lib/services/game-service.ts
 */

import Database from "better-sqlite3"
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3"
import * as schema from "@/db/schema"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result from preparing a statement in D1.
 * This mimics Cloudflare D1's PreparedStatement interface.
 */
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>
  run(): Promise<D1Result>
  all<T = Record<string, unknown>>(): Promise<D1AllResult<T>>
  raw<T = unknown[]>(): Promise<T[]>
}

interface D1Result {
  success: boolean
  meta: {
    changes: number
    last_row_id: number
    duration: number
  }
}

interface D1AllResult<T> {
  success: boolean
  results: T[]
  meta: {
    changes: number
    last_row_id: number
    duration: number
  }
}

/**
 * D1Database interface mock.
 * Wraps better-sqlite3 to provide D1-compatible API.
 */
interface D1DatabaseMock {
  prepare(query: string): D1PreparedStatement
  dump(): Promise<ArrayBuffer>
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result[]>
  exec(query: string): Promise<D1Result>
}

/**
 * Test database instance.
 */
export interface TestDatabase {
  /** Drizzle database instance for direct queries */
  drizzle: BetterSQLite3Database<typeof schema>
  /** D1-compatible mock for service functions */
  d1: D1DatabaseMock
  /** Raw better-sqlite3 instance for advanced operations */
  sqlite: Database.Database
  /** Close the database connection */
  close: () => void
  /** Reset the database (clear all data, keep schema) */
  reset: () => void
}

// =============================================================================
// SCHEMA SQL
// =============================================================================

/**
 * Complete schema SQL for creating all tables.
 *
 * This is a condensed version of the migrations that creates the full schema
 * in one go. Order matters due to foreign key constraints.
 *
 * Tables are created in dependency order:
 * 1. Independent tables first (users, words, games)
 * 2. Dependent tables after (game_players, user_ranks, etc.)
 */
const SCHEMA_SQL = `
-- Independent tables (no foreign keys to other app tables)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  bio TEXT,
  avatar_id INTEGER DEFAULT 1 NOT NULL,
  birth_year INTEGER,
  age INTEGER,
  auth_provider TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  last_online INTEGER DEFAULT (unixepoch()) NOT NULL,
  theme TEXT DEFAULT 'light' NOT NULL,
  email_social INTEGER DEFAULT 1 NOT NULL,
  email_security INTEGER DEFAULT 1 NOT NULL,
  email_marketing INTEGER DEFAULT 0 NOT NULL,
  deletion_requested_at INTEGER
);

CREATE TABLE IF NOT EXISTS words (
  id TEXT PRIMARY KEY NOT NULL,
  word TEXT NOT NULL UNIQUE,
  difficulty_tier INTEGER NOT NULL,
  definition TEXT NOT NULL,
  example_sentence TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  syllables INTEGER,
  etymology TEXT,
  times_served INTEGER DEFAULT 0 NOT NULL,
  correct_rate REAL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY NOT NULL,
  room_code TEXT UNIQUE,
  mode TEXT NOT NULL,
  input_method TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'waiting' NOT NULL,
  host_id TEXT,
  max_players INTEGER DEFAULT 6 NOT NULL,
  min_players INTEGER DEFAULT 4 NOT NULL,
  average_rank TEXT,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  started_at INTEGER,
  ended_at INTEGER
);

-- Dependent tables (have foreign keys to tables above)

CREATE TABLE IF NOT EXISTS user_ranks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  track TEXT NOT NULL,
  tier TEXT DEFAULT 'new_bee' NOT NULL,
  xp INTEGER DEFAULT 0 NOT NULL,
  crown_points INTEGER DEFAULT 0 NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, track)
);

CREATE TABLE IF NOT EXISTS user_skill_ratings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  track TEXT NOT NULL,
  rating REAL DEFAULT 1500 NOT NULL,
  rating_deviation REAL DEFAULT 350 NOT NULL,
  volatility REAL DEFAULT 0.06 NOT NULL,
  derived_tier INTEGER DEFAULT 4 NOT NULL,
  games_played INTEGER DEFAULT 0 NOT NULL,
  last_played_at INTEGER,
  season_highest_rating REAL DEFAULT 1500,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, track)
);

CREATE TABLE IF NOT EXISTS game_players (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  hearts INTEGER DEFAULT 3 NOT NULL,
  is_eliminated INTEGER DEFAULT 0 NOT NULL,
  placement INTEGER,
  rounds_completed INTEGER DEFAULT 0 NOT NULL,
  correct_answers INTEGER DEFAULT 0 NOT NULL,
  wrong_answers INTEGER DEFAULT 0 NOT NULL,
  xp_earned INTEGER,
  joined_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  eliminated_at INTEGER,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(game_id, user_id)
);

CREATE TABLE IF NOT EXISTS game_rounds (
  id TEXT PRIMARY KEY NOT NULL,
  game_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  word_id TEXT NOT NULL,
  active_player_id TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  time_limit INTEGER NOT NULL,
  answer TEXT,
  is_correct INTEGER,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (word_id) REFERENCES words(id),
  UNIQUE(game_id, round_number)
);

CREATE TABLE IF NOT EXISTS recognition_logs (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  word_to_spell TEXT NOT NULL,
  google_transcript TEXT NOT NULL,
  extracted_letters TEXT NOT NULL,
  was_correct INTEGER NOT NULL,
  rejection_reason TEXT,
  input_method TEXT,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_phonetic_mappings (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  heard TEXT NOT NULL,
  intended TEXT NOT NULL,
  source TEXT DEFAULT 'auto_learned' NOT NULL,
  confidence REAL DEFAULT 1 NOT NULL,
  occurrence_count INTEGER DEFAULT 1 NOT NULL,
  times_applied INTEGER DEFAULT 0 NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  updated_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, heard)
);

-- Social tables

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  responded_at INTEGER,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(sender_id, receiver_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY NOT NULL,
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  read_at INTEGER,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_id TEXT NOT NULL,
  reported_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
  reviewed_at INTEGER,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE
);
`

// =============================================================================
// D1 MOCK IMPLEMENTATION
// =============================================================================

/**
 * Create a D1-compatible wrapper around better-sqlite3.
 *
 * This allows service functions that expect D1Database to work
 * with our in-memory test database.
 */
function createD1Mock(sqlite: Database.Database): D1DatabaseMock {
  return {
    prepare(query: string): D1PreparedStatement {
      const stmt = sqlite.prepare(query)
      let boundValues: unknown[] = []

      const prepared: D1PreparedStatement = {
        bind(...values: unknown[]) {
          boundValues = values
          return prepared
        },

        async first<T = Record<string, unknown>>(
          colName?: string
        ): Promise<T | null> {
          const row = stmt.get(...boundValues) as Record<string, unknown> | undefined
          if (!row) return null
          if (colName) return row[colName] as T
          return row as T
        },

        async run(): Promise<D1Result> {
          const info = stmt.run(...boundValues)
          return {
            success: true,
            meta: {
              changes: info.changes,
              last_row_id: Number(info.lastInsertRowid),
              duration: 0,
            },
          }
        },

        async all<T = Record<string, unknown>>(): Promise<D1AllResult<T>> {
          const rows = stmt.all(...boundValues) as T[]
          return {
            success: true,
            results: rows,
            meta: {
              changes: 0,
              last_row_id: 0,
              duration: 0,
            },
          }
        },

        async raw<T = unknown[]>(): Promise<T[]> {
          // Return rows as arrays instead of objects
          const rows = stmt.raw().all(...boundValues) as T[]
          return rows
        },
      }

      return prepared
    },

    async dump(): Promise<ArrayBuffer> {
      const buffer = sqlite.serialize()
      // Convert Uint8Array to ArrayBuffer
      const arrayBuffer = new ArrayBuffer(buffer.byteLength)
      new Uint8Array(arrayBuffer).set(buffer)
      return arrayBuffer
    },

    async batch<T = unknown>(
      statements: D1PreparedStatement[]
    ): Promise<D1Result[]> {
      const results: D1Result[] = []
      for (const stmt of statements) {
        results.push(await stmt.run())
      }
      return results
    },

    async exec(query: string): Promise<D1Result> {
      sqlite.exec(query)
      return {
        success: true,
        meta: {
          changes: sqlite.prepare("SELECT changes()").pluck().get() as number,
          last_row_id: sqlite
            .prepare("SELECT last_insert_rowid()")
            .pluck()
            .get() as number,
          duration: 0,
        },
      }
    },
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Create a fresh in-memory test database.
 *
 * The database is created with the full PlayLexi schema.
 * Call `db.close()` in afterEach to clean up.
 *
 * @returns TestDatabase instance
 *
 * @example
 * ```typescript
 * describe("UserService", () => {
 *   let db: TestDatabase
 *
 *   beforeEach(() => {
 *     db = createTestDatabase()
 *   })
 *
 *   afterEach(() => {
 *     db.close()
 *   })
 *
 *   it("creates user with ranks", async () => {
 *     const user = await createUser(db.d1, {
 *       authUserId: "auth-123",
 *       email: "test@example.com",
 *       username: "testuser",
 *       authProvider: "google",
 *     })
 *     expect(user.id).toBe("auth-123")
 *   })
 * })
 * ```
 */
export function createTestDatabase(): TestDatabase {
  // Create in-memory SQLite database
  const sqlite = new Database(":memory:")

  // Enable foreign keys (disabled by default in SQLite)
  sqlite.pragma("foreign_keys = ON")

  // Create schema
  sqlite.exec(SCHEMA_SQL)

  // Create Drizzle instance
  const db = drizzle(sqlite, { schema })

  // Create D1 mock
  const d1Mock = createD1Mock(sqlite)

  return {
    drizzle: db,
    d1: d1Mock,
    sqlite,
    close: () => sqlite.close(),
    reset: () => {
      // Delete all data but keep schema
      const tables = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        .all() as { name: string }[]

      // Disable foreign keys temporarily for cleanup
      sqlite.pragma("foreign_keys = OFF")
      for (const { name } of tables) {
        sqlite.exec(`DELETE FROM ${name}`)
      }
      sqlite.pragma("foreign_keys = ON")
    },
  }
}

/**
 * Generate a unique ID for test records.
 *
 * Uses a simple incrementing counter with prefix.
 * For tests only — production uses crypto.randomUUID().
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
let idCounter = 0
export function generateTestId(prefix = "test"): string {
  idCounter++
  return `${prefix}-${idCounter.toString().padStart(6, "0")}`
}

/**
 * Reset the test ID counter.
 * Call this in beforeEach if you need predictable IDs.
 */
export function resetTestIdCounter(): void {
  idCounter = 0
}
