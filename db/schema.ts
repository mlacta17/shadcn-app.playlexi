/**
 * Database Schema — PlayLexi
 *
 * This file defines the complete database schema using Drizzle ORM.
 * Drizzle generates TypeScript types from this schema, ensuring type safety
 * across the entire application.
 *
 * ## Why Drizzle over Prisma?
 * - Lighter weight, better edge compatibility
 * - Native D1 driver support (no binary dependencies)
 * - TypeScript-first, works on Cloudflare's edge runtime
 *
 * ## Table Organization
 * 1. USER & AUTH — Users, authentication, settings
 * 2. RANK SYSTEM — XP-based visible progression
 * 3. SKILL RATINGS — Hidden Glicko-2 for difficulty matching (ADR-012)
 * 4. GAMES — Game sessions, players, rounds
 * 5. WORDS — Spelling words from Merriam-Webster (ADR-011)
 * 6. SOCIAL — Friends, messages, blocks, reports
 * 7. NOTIFICATIONS — In-app notifications
 *
 * ## Setup Required
 * ```bash
 * npm install drizzle-orm
 * npm install -D drizzle-kit
 * ```
 *
 * @see docs/ARCHITECTURE.md Section 4 (Database Schema)
 * @see ADR-011 (Merriam-Webster API Integration)
 * @see ADR-012 (Hidden Skill Rating System - Glicko-2)
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  unique,
  index,
} from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

// =============================================================================
// ENUMS (as const arrays for SQLite compatibility)
// =============================================================================
// SQLite doesn't have native enums, so we use string unions.
// These are exported for use in application code.

/** OAuth providers supported for authentication */
export const authProviders = ["google", "apple"] as const
export type AuthProvider = (typeof authProviders)[number]

/** UI theme options */
export const themes = ["light", "dark"] as const
export type Theme = (typeof themes)[number]

/**
 * Rank tracks — each combination of game mode + input method is a separate track.
 * Players have independent ranks on each track.
 */
export const rankTracks = [
  "endless_voice",
  "endless_keyboard",
  "blitz_voice",
  "blitz_keyboard",
] as const
export type RankTrack = (typeof rankTracks)[number]

/**
 * Rank tiers (7 total) — visible progression based on XP.
 * @see PRD Section 3.1 (Rank Tiers)
 */
export const rankTiers = [
  "new_bee",
  "bumble_bee",
  "busy_bee",
  "honey_bee",
  "worker_bee",
  "royal_bee",
  "bee_keeper",
] as const
export type RankTier = (typeof rankTiers)[number]

/** Game modes */
export const gameModes = ["endless", "blitz"] as const
export type GameMode = (typeof gameModes)[number]

/** Input methods for spelling */
export const inputMethods = ["voice", "keyboard"] as const
export type InputMethod = (typeof inputMethods)[number]

/** Game types (single player vs multiplayer variants) */
export const gameTypes = [
  "single",
  "local_multi",
  "online_private",
  "online_public",
] as const
export type GameType = (typeof gameTypes)[number]

/** Game lifecycle states */
export const gameStatuses = [
  "waiting",
  "starting",
  "in_progress",
  "finished",
] as const
export type GameStatus = (typeof gameStatuses)[number]

/** Friend request states */
export const requestStatuses = ["pending", "accepted", "declined"] as const
export type RequestStatus = (typeof requestStatuses)[number]

/** Preset chat messages (no free-text for safety) */
export const presetMessages = ["want_to_play", "good_game", "rematch"] as const
export type PresetMessage = (typeof presetMessages)[number]

/** Report reasons for moderation */
export const reportReasons = [
  "cheating",
  "harassment",
  "inappropriate_username",
  "other",
] as const
export type ReportReason = (typeof reportReasons)[number]

/** Report review states */
export const reportStatuses = [
  "pending",
  "reviewed",
  "actioned",
  "dismissed",
] as const
export type ReportStatus = (typeof reportStatuses)[number]

/** Notification types */
export const notificationTypes = [
  "friend_request",
  "friend_accepted",
  "game_invite",
  "game_finished",
] as const
export type NotificationType = (typeof notificationTypes)[number]

// =============================================================================
// 1. USER & AUTH
// =============================================================================

/**
 * Users table — core user data and settings.
 *
 * Authentication is handled via OAuth (Google/Apple), so we don't store passwords.
 * Settings are denormalized here for simplicity (single query to get user + settings).
 */
export const users = sqliteTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    bio: text("bio"),
    avatarId: integer("avatar_id").notNull().default(1), // 1, 2, or 3
    age: integer("age").notNull(),
    authProvider: text("auth_provider", { enum: authProviders }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastOnline: integer("last_online", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    // Settings (denormalized for single-query access)
    theme: text("theme", { enum: themes }).notNull().default("light"),
    emailSocial: integer("email_social", { mode: "boolean" })
      .notNull()
      .default(true),
    emailSecurity: integer("email_security", { mode: "boolean" })
      .notNull()
      .default(true),
    emailMarketing: integer("email_marketing", { mode: "boolean" })
      .notNull()
      .default(false),

    // GDPR: Account deletion request
    deletionRequestedAt: integer("deletion_requested_at", { mode: "timestamp" }),
  },
  (table) => ({
    usernameIdx: index("idx_users_username").on(table.username),
    emailIdx: index("idx_users_email").on(table.email),
  })
)

// =============================================================================
// 2. RANK SYSTEM (Visible XP-based progression)
// =============================================================================

/**
 * User ranks — XP-based progression visible to players.
 *
 * Each user has one rank per track (4 tracks = 4 ranks per user).
 * This is the VISIBLE progression system shown on leaderboards and profiles.
 *
 * @see PRD Section 3.3 (XP System)
 */
export const userRanks = sqliteTable(
  "user_ranks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    track: text("track", { enum: rankTracks }).notNull(),
    tier: text("tier", { enum: rankTiers }).notNull().default("new_bee"),
    xp: integer("xp").notNull().default(0),
    crownPoints: integer("crown_points").notNull().default(0), // Only for royal_bee
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userTrackUnique: unique().on(table.userId, table.track),
    trackXpIdx: index("idx_user_ranks_track_xp").on(table.track, table.xp),
    trackCrownPointsIdx: index("idx_user_ranks_track_crown_points").on(
      table.track,
      table.crownPoints
    ),
  })
)

// =============================================================================
// 3. SKILL RATINGS (Hidden Glicko-2 for difficulty matching)
// =============================================================================

/**
 * User skill ratings — Glicko-2 system for word difficulty selection.
 *
 * This is the HIDDEN rating system that determines:
 * - Which difficulty words to serve
 * - Multiplayer matchmaking
 *
 * Players never see this rating directly — they see XP/tier from userRanks.
 *
 * Glicko-2 components:
 * - rating: Estimated skill (1000-1900, maps to tiers 1-7)
 * - ratingDeviation (RD): Uncertainty (30-350, lower = more confident)
 * - volatility: How much skill tends to change (0.03-0.10)
 *
 * @see ADR-012 (Hidden Skill Rating System - Glicko-2)
 */
export const userSkillRatings = sqliteTable(
  "user_skill_ratings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    track: text("track", { enum: rankTracks }).notNull(),

    // Glicko-2 components
    rating: real("rating").notNull().default(1500), // ~Tier 4 starting point
    ratingDeviation: real("rating_deviation").notNull().default(350), // Max uncertainty for new players
    volatility: real("volatility").notNull().default(0.06), // Default volatility

    // Derived tier for quick queries (calculated from rating)
    // This is the HIDDEN tier used for word selection, NOT the visible XP tier
    derivedTier: integer("derived_tier").notNull().default(4),

    // Stats for analytics
    gamesPlayed: integer("games_played").notNull().default(0),
    lastPlayedAt: integer("last_played_at", { mode: "timestamp" }),

    // Season tracking (for future seasonal resets)
    seasonHighestRating: real("season_highest_rating").default(1500),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userTrackUnique: unique().on(table.userId, table.track),
    trackRatingIdx: index("idx_skill_ratings_track_rating").on(
      table.track,
      table.rating
    ),
  })
)

// =============================================================================
// 4. GAMES
// =============================================================================

/**
 * Games table — game session metadata.
 *
 * A game can be single player or multiplayer.
 * Multiplayer games have room codes and player limits.
 */
export const games = sqliteTable(
  "games",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roomCode: text("room_code").unique(), // For private games
    mode: text("mode", { enum: gameModes }).notNull(),
    inputMethod: text("input_method", { enum: inputMethods }).notNull(),
    type: text("type", { enum: gameTypes }).notNull(),
    status: text("status", { enum: gameStatuses }).notNull().default("waiting"),

    // Multiplayer settings
    hostId: text("host_id"),
    maxPlayers: integer("max_players").notNull().default(6),
    minPlayers: integer("min_players").notNull().default(4),

    // Calculated average rank for word selection (based on Glicko-2)
    averageRank: text("average_rank", { enum: rankTiers }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    startedAt: integer("started_at", { mode: "timestamp" }),
    endedAt: integer("ended_at", { mode: "timestamp" }),
  },
  (table) => ({
    statusTypeIdx: index("idx_games_status_type").on(table.status, table.type),
    roomCodeIdx: index("idx_games_room_code").on(table.roomCode),
  })
)

/**
 * Game players — join table for users in a game.
 *
 * Tracks per-player state within a game (hearts, elimination, stats).
 */
export const gamePlayers = sqliteTable(
  "game_players",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // State
    hearts: integer("hearts").notNull().default(3),
    isEliminated: integer("is_eliminated", { mode: "boolean" })
      .notNull()
      .default(false),
    placement: integer("placement"), // 1st, 2nd, 3rd, etc.

    // Stats
    roundsCompleted: integer("rounds_completed").notNull().default(0),
    correctAnswers: integer("correct_answers").notNull().default(0),
    wrongAnswers: integer("wrong_answers").notNull().default(0),

    // XP earned (calculated at end)
    xpEarned: integer("xp_earned"),

    joinedAt: integer("joined_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    eliminatedAt: integer("eliminated_at", { mode: "timestamp" }),
  },
  (table) => ({
    gameUserUnique: unique().on(table.gameId, table.userId),
    gameIdIdx: index("idx_game_players_game_id").on(table.gameId),
    userIdIdx: index("idx_game_players_user_id").on(table.userId),
  })
)

/**
 * Game rounds — individual rounds within a game.
 *
 * Each round presents one word to spell.
 * For multiplayer, activePlayerId tracks whose turn it is.
 */
export const gameRounds = sqliteTable(
  "game_rounds",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    wordId: text("word_id")
      .notNull()
      .references(() => words.id),

    // For multiplayer: whose turn
    activePlayerId: text("active_player_id"),

    // Timing
    startedAt: integer("started_at", { mode: "timestamp" }),
    endedAt: integer("ended_at", { mode: "timestamp" }),
    timeLimit: integer("time_limit").notNull(), // seconds

    // Result
    answer: text("answer"),
    isCorrect: integer("is_correct", { mode: "boolean" }),
  },
  (table) => ({
    gameRoundUnique: unique().on(table.gameId, table.roundNumber),
    gameIdIdx: index("idx_game_rounds_game_id").on(table.gameId),
  })
)

// =============================================================================
// 5. WORDS
// =============================================================================

/**
 * Words table — spelling words sourced from Merriam-Webster.
 *
 * Words are pre-cached at build time (zero runtime MW API calls).
 * Audio files are stored in Cloudflare R2.
 *
 * @see ADR-011 (Merriam-Webster API Integration)
 */
export const words = sqliteTable(
  "words",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    word: text("word").notNull().unique(),
    difficultyTier: integer("difficulty_tier").notNull(), // 1-7
    definition: text("definition").notNull(),
    exampleSentence: text("example_sentence").notNull(),
    audioUrl: text("audio_url").notNull(), // R2 URL to cached audio file
    partOfSpeech: text("part_of_speech").notNull(),

    // Metadata (from MW API)
    syllables: integer("syllables"), // Number of syllables
    etymology: text("etymology"), // Word origin (optional)

    // Usage tracking
    timesServed: integer("times_served").notNull().default(0),
    correctRate: real("correct_rate"), // 0.0 - 1.0

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    difficultyTierIdx: index("idx_words_difficulty_tier").on(
      table.difficultyTier
    ),
    wordIdx: index("idx_words_word").on(table.word),
  })
)

// =============================================================================
// 6. SOCIAL
// =============================================================================

/**
 * Friendships — bidirectional friend relationships.
 *
 * When a friend request is accepted, TWO rows are created:
 * - { userId: A, friendId: B }
 * - { userId: B, friendId: A }
 *
 * This makes querying "friends of user X" simple: WHERE userId = X
 */
export const friendships = sqliteTable(
  "friendships",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userFriendUnique: unique().on(table.userId, table.friendId),
    userIdIdx: index("idx_friendships_user_id").on(table.userId),
    friendIdIdx: index("idx_friendships_friend_id").on(table.friendId),
  })
)

/**
 * Friend requests — pending/accepted/declined requests.
 */
export const friendRequests = sqliteTable(
  "friend_requests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: requestStatuses })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    respondedAt: integer("responded_at", { mode: "timestamp" }),
  },
  (table) => ({
    senderReceiverUnique: unique().on(table.senderId, table.receiverId),
    receiverStatusIdx: index("idx_friend_requests_receiver_status").on(
      table.receiverId,
      table.status
    ),
  })
)

/**
 * Chat messages — preset messages only (no free text for safety).
 *
 * @see PRD Section 5.4 (Chat Messages)
 */
export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: text("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    messageType: text("message_type", { enum: presetMessages }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    readAt: integer("read_at", { mode: "timestamp" }),
  },
  (table) => ({
    senderReceiverIdx: index("idx_chat_messages_sender_receiver").on(
      table.senderId,
      table.receiverId
    ),
    receiverReadIdx: index("idx_chat_messages_receiver_read").on(
      table.receiverId,
      table.readAt
    ),
  })
)

/**
 * Blocks — user blocking for safety.
 *
 * Blocked users cannot:
 * - Send friend requests
 * - Join private games
 * - Send messages
 */
export const blocks = sqliteTable(
  "blocks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    blockerId: text("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    blockerBlockedUnique: unique().on(table.blockerId, table.blockedId),
    blockerIdIdx: index("idx_blocks_blocker_id").on(table.blockerId),
  })
)

/**
 * Reports — user reports for moderation.
 */
export const reports = sqliteTable(
  "reports",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedId: text("reported_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason", { enum: reportReasons }).notNull(),
    details: text("details"),
    status: text("status", { enum: reportStatuses }).notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  },
  (table) => ({
    statusIdx: index("idx_reports_status").on(table.status),
  })
)

// =============================================================================
// 7. NOTIFICATIONS
// =============================================================================

/**
 * Notifications — in-app notifications for users.
 */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: notificationTypes }).notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    link: text("link"), // Where to navigate on click
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userReadIdx: index("idx_notifications_user_read").on(
      table.userId,
      table.readAt
    ),
  })
)

// =============================================================================
// 8. PHONETIC LEARNING (Adaptive Speech Recognition)
// =============================================================================

/**
 * Sources for phonetic mappings.
 * - "auto_learned": System inferred from gameplay patterns
 * - "manual": User explicitly configured
 * - "support_added": Added by support team for a specific user
 */
export const phoneticMappingSources = [
  "auto_learned",
  "manual",
  "support_added",
] as const
export type PhoneticMappingSource = (typeof phoneticMappingSources)[number]

/**
 * Recognition logs — records of speech recognition attempts.
 *
 * Used for:
 * 1. Pattern detection (finding learnable phonetic variations)
 * 2. Analytics (understanding where recognition fails)
 * 3. Debugging (investigating user-reported issues)
 *
 * Retention: Logs older than 30 days should be purged to prevent bloat.
 *
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */
export const recognitionLogs = sqliteTable(
  "recognition_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // What the user was trying to spell
    wordToSpell: text("word_to_spell").notNull(),

    // Raw transcript from Google Speech (e.g., "tee ohs")
    googleTranscript: text("google_transcript").notNull(),

    // Letters we extracted from the transcript (e.g., "tos")
    extractedLetters: text("extracted_letters").notNull(),

    // Whether the answer was marked correct
    wasCorrect: integer("was_correct", { mode: "boolean" }).notNull(),

    // Optional: rejection reason if answer was rejected
    rejectionReason: text("rejection_reason"),

    // Optional: input method used
    inputMethod: text("input_method", { enum: inputMethods }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    userIdIdx: index("idx_recognition_logs_user_id").on(table.userId),
    userCreatedIdx: index("idx_recognition_logs_user_created").on(
      table.userId,
      table.createdAt
    ),
    // For cleanup queries (delete logs older than X days)
    createdAtIdx: index("idx_recognition_logs_created_at").on(table.createdAt),
  })
)

/**
 * User phonetic mappings — learned or manually configured mappings per user.
 *
 * These mappings supplement the global SPOKEN_LETTER_NAMES dictionary.
 * When validating answers, user-specific mappings take priority.
 *
 * Example:
 * - heard: "ohs"
 * - intended: "o"
 * - Meaning: When this user says something that Google transcribes as "ohs",
 *            treat it as the letter "O".
 *
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 * @see lib/answer-validation.ts SPOKEN_LETTER_NAMES
 */
export const userPhoneticMappings = sqliteTable(
  "user_phonetic_mappings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // What Google transcribed (e.g., "ohs", "tio", "double-you")
    heard: text("heard").notNull(),

    // What it should map to (single letter, e.g., "o", "t", "w")
    intended: text("intended").notNull(),

    // How this mapping was created
    source: text("source", { enum: phoneticMappingSources })
      .notNull()
      .default("auto_learned"),

    // Confidence score (0.0 - 1.0) for auto-learned mappings
    // Higher = more certain this mapping is correct
    confidence: real("confidence").notNull().default(1.0),

    // How many times this pattern was observed before creating the mapping
    occurrenceCount: integer("occurrence_count").notNull().default(1),

    // How many times this mapping has been applied during validation
    timesApplied: integer("times_applied").notNull().default(0),

    // Timestamps
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => ({
    // Each user can only have one mapping per "heard" value
    userHeardUnique: unique().on(table.userId, table.heard),
    // Fast lookup of all mappings for a user
    userIdIdx: index("idx_phonetic_mappings_user_id").on(table.userId),
  })
)
