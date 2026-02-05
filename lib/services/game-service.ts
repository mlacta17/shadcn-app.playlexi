/**
 * Game Service — PlayLexi
 *
 * Handles game session persistence and retrieval, including:
 * - Creating new game sessions
 * - Recording game rounds and results
 * - Fetching user game history
 * - Awarding XP on game completion
 *
 * ## Architecture Notes
 *
 * For single-player games, we create:
 * - One `games` record (session metadata)
 * - One `game_players` record (player stats)
 * - Multiple `game_rounds` records (one per word attempted)
 *
 * The game session is finalized when the player runs out of hearts (endless)
 * or time expires (blitz). At that point, XP is calculated and awarded.
 *
 * ## Data Flow
 *
 * 1. Game starts → createGame() creates games + game_players records
 * 2. Each round → recordRound() creates game_rounds record
 * 3. Game ends → finalizeGame() updates stats and awards XP
 *
 * For performance, rounds can be batched and recorded at game end.
 *
 * @see db/schema.ts for table definitions
 * @see hooks/use-game-session.ts for client-side state
 */

import type { D1Database } from "@cloudflare/workers-types"
import { drizzle } from "drizzle-orm/d1"
import { eq, and, desc, sql } from "drizzle-orm"
import * as schema from "@/db/schema"
import type { GameMode, InputMethod, GameType, RankTrack } from "@/db/schema"
import { updateSkillRating } from "./glicko2-service"
import { getTierForXP } from "@/lib/game-constants"

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculate the longest streak of consecutive correct answers.
 *
 * Iterates through rounds in order and tracks the longest run of
 * consecutive correct answers. This is calculated server-side to
 * prevent client manipulation.
 *
 * @param rounds - Array of round results (must be sorted by roundNumber)
 * @returns The longest streak of consecutive correct answers
 *
 * @example
 * ```typescript
 * const rounds = [
 *   { isCorrect: true },   // streak: 1
 *   { isCorrect: true },   // streak: 2
 *   { isCorrect: false },  // streak reset
 *   { isCorrect: true },   // streak: 1
 *   { isCorrect: true },   // streak: 2
 *   { isCorrect: true },   // streak: 3 (new longest)
 * ]
 * calculateLongestStreak(rounds) // returns 3
 * ```
 */
function calculateLongestStreak(rounds: { isCorrect: boolean }[]): number {
  let longestStreak = 0
  let currentStreak = 0

  for (const round of rounds) {
    if (round.isCorrect) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  return longestStreak
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Input for creating a new game session.
 */
export interface CreateGameInput {
  /** User ID (from auth) */
  userId: string
  /** Game mode: "endless" or "blitz" */
  mode: GameMode
  /** Input method: "voice" or "keyboard" */
  inputMethod: InputMethod
  /** Game type: "single" for single-player */
  type: GameType
}

/**
 * A single round result to record.
 */
export interface RoundResult {
  /** Round number (1-indexed) */
  roundNumber: number
  /** Word ID from words table */
  wordId: string
  /** Player's answer */
  answer: string
  /** Whether the answer was correct */
  isCorrect: boolean
  /** Time taken to answer this round (seconds) */
  timeTaken: number
}

/**
 * Input for finalizing a game session.
 */
export interface FinalizeGameInput {
  /** Game ID */
  gameId: string
  /** User ID */
  userId: string
  /** All rounds played (batched for efficiency) */
  rounds: RoundResult[]
  /** Total XP earned (server-calculated) */
  xpEarned: number
  /** Final hearts remaining (endless mode) */
  heartsRemaining: number
  /** Average difficulty tier of words faced (for Glicko-2 updates) */
  averageWordTier?: number
}

/**
 * Game history entry for display in results/leaderboard.
 */
export interface GameHistoryEntry {
  /** Game ID */
  id: string
  /** When the game was played */
  playedAt: Date
  /** Total rounds completed */
  roundsCompleted: number
  /** Correct answers */
  correctAnswers: number
  /** Wrong answers */
  wrongAnswers: number
  /** Accuracy percentage (0-100) */
  accuracy: number
  /** XP earned */
  xpEarned: number
  /** Longest streak of consecutive correct answers in this game */
  longestStreak: number
}

/**
 * Result of creating a new game.
 */
export interface CreateGameResult {
  /** Game ID */
  gameId: string
  /** Game player ID */
  gamePlayerId: string
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Get a game by ID.
 *
 * @param d1 - D1 database binding
 * @param gameId - Game ID
 * @returns Game record or null if not found
 */
export async function getGameById(
  d1: D1Database,
  gameId: string
): Promise<typeof schema.games.$inferSelect | null> {
  const db = drizzle(d1, { schema })

  const game = await db.query.games.findFirst({
    where: eq(schema.games.id, gameId),
  })

  return game ?? null
}

/**
 * Create a new game session.
 *
 * Creates both the game record and the game_player record for the user.
 * For single-player games, the game starts immediately (status = "in_progress").
 *
 * @param d1 - D1 database binding
 * @param input - Game creation parameters
 * @returns Game and player IDs
 *
 * @example
 * ```typescript
 * const { gameId, gamePlayerId } = await createGame(env.DB, {
 *   userId: session.user.id,
 *   mode: "endless",
 *   inputMethod: "voice",
 *   type: "single",
 * })
 * ```
 */
export async function createGame(
  d1: D1Database,
  input: CreateGameInput
): Promise<CreateGameResult> {
  const db = drizzle(d1, { schema })

  // Create game session
  const [game] = await db
    .insert(schema.games)
    .values({
      mode: input.mode,
      inputMethod: input.inputMethod,
      type: input.type,
      status: "in_progress", // Single-player starts immediately
      hostId: input.userId,
      maxPlayers: 1,
      minPlayers: 1,
      startedAt: new Date(),
    })
    .returning({ id: schema.games.id })

  // Create game player record
  const [gamePlayer] = await db
    .insert(schema.gamePlayers)
    .values({
      gameId: game.id,
      userId: input.userId,
      hearts: input.mode === "endless" ? 3 : 0,
    })
    .returning({ id: schema.gamePlayers.id })

  return {
    gameId: game.id,
    gamePlayerId: gamePlayer.id,
  }
}

/**
 * Finalize a game session.
 *
 * Records all rounds, updates player stats, awards XP, and marks game as finished.
 * This is called once when the game ends (out of hearts or time).
 *
 * @param d1 - D1 database binding
 * @param input - Game finalization data
 *
 * @example
 * ```typescript
 * await finalizeGame(env.DB, {
 *   gameId: "abc-123",
 *   userId: session.user.id,
 *   rounds: [{ roundNumber: 1, wordId: "...", answer: "cat", isCorrect: true, timeLimit: 30 }],
 *   xpEarned: 25,
 *   heartsRemaining: 0,
 * })
 * ```
 */
export async function finalizeGame(
  d1: D1Database,
  input: FinalizeGameInput
): Promise<void> {
  const db = drizzle(d1, { schema })

  // Calculate stats from rounds
  const correctAnswers = input.rounds.filter((r) => r.isCorrect).length
  const wrongAnswers = input.rounds.filter((r) => !r.isCorrect).length
  const roundsCompleted = input.rounds.length

  // Calculate longest streak (consecutive correct answers)
  // Rounds must be sorted by roundNumber for accurate calculation
  const sortedRounds = [...input.rounds].sort((a, b) => a.roundNumber - b.roundNumber)
  const longestStreak = calculateLongestStreak(sortedRounds)

  // Step 1: Insert rounds in chunks to avoid SQLite parameter limits
  // D1/SQLite has a limit on bound parameters (~100). With 10 columns per row,
  // we can safely insert ~10 rows per batch. Using 5 to be conservative.
  const CHUNK_SIZE = 5
  if (input.rounds.length > 0) {
    try {
      // Process rounds in chunks
      for (let i = 0; i < input.rounds.length; i += CHUNK_SIZE) {
        const chunk = input.rounds.slice(i, i + CHUNK_SIZE)
        await db.insert(schema.gameRounds).values(
          chunk.map((round) => ({
            gameId: input.gameId,
            roundNumber: round.roundNumber,
            wordId: round.wordId,
            answer: round.answer,
            isCorrect: round.isCorrect,
            timeTaken: round.timeTaken,
            endedAt: new Date(),
          }))
        )
      }
    } catch (error) {
      // Log detailed error for debugging FK/unique constraint issues
      console.error("[finalizeGame] Failed to insert game_rounds:", {
        gameId: input.gameId,
        roundCount: input.rounds.length,
        roundNumbers: input.rounds.map(r => r.roundNumber),
        wordIds: input.rounds.map(r => r.wordId),
        error: error instanceof Error ? error.message : String(error),
      })
      throw new Error(`Failed to save game rounds: ${error instanceof Error ? error.message : "Database error"}`)
    }
  }

  // Step 2: Update game player stats (including streak)
  try {
    await db
      .update(schema.gamePlayers)
      .set({
        roundsCompleted,
        correctAnswers,
        wrongAnswers,
        longestStreak,
        xpEarned: input.xpEarned,
        hearts: input.heartsRemaining,
        isEliminated: input.heartsRemaining === 0,
        eliminatedAt: input.heartsRemaining === 0 ? new Date() : undefined,
      })
      .where(
        and(
          eq(schema.gamePlayers.gameId, input.gameId),
          eq(schema.gamePlayers.userId, input.userId)
        )
      )
  } catch (error) {
    console.error("[finalizeGame] Failed to update game_players:", {
      gameId: input.gameId,
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(`Failed to update player stats: ${error instanceof Error ? error.message : "Database error"}`)
  }

  // Step 3: Mark game as finished
  try {
    await db
      .update(schema.games)
      .set({
        status: "finished",
        endedAt: new Date(),
      })
      .where(eq(schema.games.id, input.gameId))
  } catch (error) {
    console.error("[finalizeGame] Failed to update games status:", {
      gameId: input.gameId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw new Error(`Failed to finish game: ${error instanceof Error ? error.message : "Database error"}`)
  }

  // Step 4: Award XP to user's rank for this track
  // Get the game to determine the track
  const game = await db.query.games.findFirst({
    where: eq(schema.games.id, input.gameId),
  })

  if (game) {
    const track = `${game.mode}_${game.inputMethod}` as RankTrack

    // Step 5: Update user_ranks with XP and best streak
    try {
      // Get current rank
      const currentRank = await db.query.userRanks.findFirst({
        where: and(
          eq(schema.userRanks.userId, input.userId),
          eq(schema.userRanks.track, track)
        ),
      })

      if (!currentRank) {
        console.warn("[finalizeGame] No user_rank found:", {
          userId: input.userId,
          track,
        })
        // Don't throw - this shouldn't block the game save
      } else {
        // Calculate new values
        const newTotalXP = (currentRank.xp ?? 0) + input.xpEarned
        const newTier = getTierForXP(newTotalXP)
        const currentBestStreak = currentRank.bestStreak ?? 0
        const newBestStreak = Math.max(currentBestStreak, longestStreak)

        // Update XP, tier, and best streak atomically
        await db
          .update(schema.userRanks)
          .set({
            xp: newTotalXP,
            tier: newTier,
            bestStreak: newBestStreak,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.userRanks.userId, input.userId),
              eq(schema.userRanks.track, track)
            )
          )
      }
    } catch (error) {
      // Log but don't fail the game save if rank update fails
      console.error("[finalizeGame] Failed to update user_ranks:", {
        userId: input.userId,
        track,
        xpEarned: input.xpEarned,
        longestStreak,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    // Update Glicko-2 skill rating (hidden system for word difficulty)
    // This uses the real Glicko-2 algorithm, not just incrementing games played
    const correctCount = input.rounds.filter((r) => r.isCorrect).length
    const wrongCount = input.rounds.filter((r) => !r.isCorrect).length

    if (correctCount + wrongCount > 0) {
      try {
        await updateSkillRating(d1, input.userId, track, {
          correct: correctCount,
          wrong: wrongCount,
          // Default to tier 4 if not provided (mid-difficulty)
          averageWordTier: input.averageWordTier ?? 4,
        })
      } catch (error) {
        // Log but don't fail the game save if Glicko-2 update fails
        console.error("[finalizeGame] Failed to update skill rating:", error)
      }
    }
  }
}

/**
 * Get user's game history for a specific track.
 *
 * Returns the most recent games, sorted by date descending.
 * Used for the results page leaderboard/history view.
 *
 * @param d1 - D1 database binding
 * @param userId - User ID
 * @param mode - Game mode filter
 * @param inputMethod - Input method filter
 * @param limit - Maximum number of games to return (default: 50)
 * @returns Array of game history entries
 *
 * @example
 * ```typescript
 * const history = await getGameHistory(env.DB, userId, "endless", "voice", 20)
 * // Returns: [{ id, playedAt, roundsCompleted, accuracy, xpEarned, ... }, ...]
 * ```
 */
export async function getGameHistory(
  d1: D1Database,
  userId: string,
  mode: GameMode,
  inputMethod: InputMethod,
  limit: number = 50
): Promise<GameHistoryEntry[]> {
  const db = drizzle(d1, { schema })

  // Query games with player stats
  // Using raw SQL for the join since Drizzle's relational queries can be verbose
  const results = await db
    .select({
      id: schema.games.id,
      endedAt: schema.games.endedAt,
      roundsCompleted: schema.gamePlayers.roundsCompleted,
      correctAnswers: schema.gamePlayers.correctAnswers,
      wrongAnswers: schema.gamePlayers.wrongAnswers,
      xpEarned: schema.gamePlayers.xpEarned,
      longestStreak: schema.gamePlayers.longestStreak,
    })
    .from(schema.games)
    .innerJoin(schema.gamePlayers, eq(schema.games.id, schema.gamePlayers.gameId))
    .where(
      and(
        eq(schema.gamePlayers.userId, userId),
        eq(schema.games.mode, mode),
        eq(schema.games.inputMethod, inputMethod),
        eq(schema.games.status, "finished"),
        eq(schema.games.type, "single") // Only single-player games for now
      )
    )
    .orderBy(desc(schema.games.endedAt))
    .limit(limit)

  return results.map((row) => {
    const total = (row.correctAnswers ?? 0) + (row.wrongAnswers ?? 0)
    const accuracy = total > 0 ? Math.round(((row.correctAnswers ?? 0) / total) * 100) : 0

    return {
      id: row.id,
      playedAt: row.endedAt ?? new Date(),
      roundsCompleted: row.roundsCompleted ?? 0,
      correctAnswers: row.correctAnswers ?? 0,
      wrongAnswers: row.wrongAnswers ?? 0,
      accuracy,
      xpEarned: row.xpEarned ?? 0,
      longestStreak: row.longestStreak ?? 0,
    }
  })
}

/**
 * Get summary statistics for a user's game history.
 *
 * Returns aggregate stats across all games for a track.
 *
 * @param d1 - D1 database binding
 * @param userId - User ID
 * @param mode - Game mode filter
 * @param inputMethod - Input method filter
 * @returns Summary statistics
 */
export async function getGameStats(
  d1: D1Database,
  userId: string,
  mode: GameMode,
  inputMethod: InputMethod
): Promise<{
  totalGames: number
  totalRounds: number
  totalCorrect: number
  totalXp: number
  averageAccuracy: number
  bestRound: number
  bestStreak: number
}> {
  const db = drizzle(d1, { schema })

  // Query aggregate stats from games
  const result = await db
    .select({
      totalGames: sql<number>`COUNT(*)`,
      totalRounds: sql<number>`COALESCE(SUM(${schema.gamePlayers.roundsCompleted}), 0)`,
      totalCorrect: sql<number>`COALESCE(SUM(${schema.gamePlayers.correctAnswers}), 0)`,
      totalWrong: sql<number>`COALESCE(SUM(${schema.gamePlayers.wrongAnswers}), 0)`,
      totalXp: sql<number>`COALESCE(SUM(${schema.gamePlayers.xpEarned}), 0)`,
      bestRound: sql<number>`COALESCE(MAX(${schema.gamePlayers.roundsCompleted}), 0)`,
    })
    .from(schema.games)
    .innerJoin(schema.gamePlayers, eq(schema.games.id, schema.gamePlayers.gameId))
    .where(
      and(
        eq(schema.gamePlayers.userId, userId),
        eq(schema.games.mode, mode),
        eq(schema.games.inputMethod, inputMethod),
        eq(schema.games.status, "finished"),
        eq(schema.games.type, "single")
      )
    )

  // Get best streak from user_ranks (stored as all-time best for this track)
  const track = `${mode}_${inputMethod}` as RankTrack
  const rankResult = await db.query.userRanks.findFirst({
    where: and(
      eq(schema.userRanks.userId, userId),
      eq(schema.userRanks.track, track)
    ),
    columns: { bestStreak: true },
  })

  const stats = result[0]
  const totalAnswers = (stats?.totalCorrect ?? 0) + (stats?.totalWrong ?? 0)
  const averageAccuracy = totalAnswers > 0
    ? Math.round(((stats?.totalCorrect ?? 0) / totalAnswers) * 100)
    : 0

  return {
    totalGames: stats?.totalGames ?? 0,
    totalRounds: stats?.totalRounds ?? 0,
    totalCorrect: stats?.totalCorrect ?? 0,
    totalXp: stats?.totalXp ?? 0,
    averageAccuracy,
    bestStreak: rankResult?.bestStreak ?? 0,
    bestRound: stats?.bestRound ?? 0,
  }
}
