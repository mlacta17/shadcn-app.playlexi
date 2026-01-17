/**
 * Database Types — PlayLexi
 *
 * Type inference from Drizzle schema for use throughout the application.
 * These types are automatically derived from the schema, ensuring consistency.
 *
 * ## Usage
 *
 * ```typescript
 * import type { User, Word, Game } from "@/db/types"
 *
 * function displayUser(user: User) {
 *   console.log(user.username)
 * }
 * ```
 *
 * ## Insert vs Select Types
 *
 * - `User` = SELECT type (all fields, including auto-generated ones)
 * - `NewUser` = INSERT type (only required fields, optional fields optional)
 *
 * @example
 * ```typescript
 * // When creating a new user
 * const newUser: NewUser = {
 *   email: "user@example.com",
 *   username: "player1",
 *   age: 25,
 *   authProvider: "google",
 * }
 *
 * // When reading a user from DB
 * const user: User = await db.query.users.findFirst()
 * // user.id, user.createdAt, etc. are all available
 * ```
 */

import type { InferSelectModel, InferInsertModel } from "drizzle-orm"
import type {
  users,
  userRanks,
  userSkillRatings,
  games,
  gamePlayers,
  gameRounds,
  words,
  friendships,
  friendRequests,
  chatMessages,
  blocks,
  reports,
  notifications,
} from "./schema"

// =============================================================================
// USER & AUTH
// =============================================================================

/** User record from database (all fields) */
export type User = InferSelectModel<typeof users>

/** User data for INSERT (required fields only) */
export type NewUser = InferInsertModel<typeof users>

// =============================================================================
// RANK SYSTEM
// =============================================================================

/** User rank record (XP-based visible progression) */
export type UserRank = InferSelectModel<typeof userRanks>

/** User rank data for INSERT */
export type NewUserRank = InferInsertModel<typeof userRanks>

// =============================================================================
// SKILL RATINGS (Glicko-2)
// =============================================================================

/** User skill rating record (hidden Glicko-2 for difficulty matching) */
export type UserSkillRating = InferSelectModel<typeof userSkillRatings>

/** User skill rating data for INSERT */
export type NewUserSkillRating = InferInsertModel<typeof userSkillRatings>

// =============================================================================
// GAMES
// =============================================================================

/** Game session record */
export type Game = InferSelectModel<typeof games>

/** Game data for INSERT */
export type NewGame = InferInsertModel<typeof games>

/** Player in a game */
export type GamePlayer = InferSelectModel<typeof gamePlayers>

/** Game player data for INSERT */
export type NewGamePlayer = InferInsertModel<typeof gamePlayers>

/** Round within a game */
export type GameRound = InferSelectModel<typeof gameRounds>

/** Game round data for INSERT */
export type NewGameRound = InferInsertModel<typeof gameRounds>

// =============================================================================
// WORDS
// =============================================================================

/** Word record from Merriam-Webster */
export type Word = InferSelectModel<typeof words>

/** Word data for INSERT */
export type NewWord = InferInsertModel<typeof words>

// =============================================================================
// SOCIAL
// =============================================================================

/** Friendship relationship */
export type Friendship = InferSelectModel<typeof friendships>

/** Friendship data for INSERT */
export type NewFriendship = InferInsertModel<typeof friendships>

/** Friend request */
export type FriendRequest = InferSelectModel<typeof friendRequests>

/** Friend request data for INSERT */
export type NewFriendRequest = InferInsertModel<typeof friendRequests>

/** Chat message (preset only) */
export type ChatMessage = InferSelectModel<typeof chatMessages>

/** Chat message data for INSERT */
export type NewChatMessage = InferInsertModel<typeof chatMessages>

/** User block */
export type Block = InferSelectModel<typeof blocks>

/** Block data for INSERT */
export type NewBlock = InferInsertModel<typeof blocks>

/** User report */
export type Report = InferSelectModel<typeof reports>

/** Report data for INSERT */
export type NewReport = InferInsertModel<typeof reports>

// =============================================================================
// NOTIFICATIONS
// =============================================================================

/** Notification */
export type Notification = InferSelectModel<typeof notifications>

/** Notification data for INSERT */
export type NewNotification = InferInsertModel<typeof notifications>

// =============================================================================
// COMPOSITE TYPES (for common query patterns)
// =============================================================================

/**
 * User with their ranks across all tracks.
 * Common pattern for profile pages.
 */
export type UserWithRanks = User & {
  ranks: UserRank[]
}

/**
 * User with their skill ratings (hidden from players).
 * Used for matchmaking and word selection.
 */
export type UserWithSkillRatings = User & {
  skillRatings: UserSkillRating[]
}

/**
 * Game with all players and rounds.
 * Common pattern for game replay/history.
 */
export type GameWithDetails = Game & {
  players: GamePlayer[]
  rounds: GameRound[]
}

/**
 * Game round with the associated word.
 * Common pattern for displaying round results.
 */
export type GameRoundWithWord = GameRound & {
  word: Word
}
