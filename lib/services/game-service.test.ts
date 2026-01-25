/**
 * Game Service Tests
 *
 * Tests for game session management including:
 * - Creating new game sessions
 * - Finalizing games with round data
 * - Fetching game history and statistics
 * - XP and rank updates
 *
 * These tests use an in-memory SQLite database that mirrors the D1 schema.
 *
 * @see lib/services/game-service.ts
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
  createGame,
  finalizeGame,
  getGameById,
  getGameHistory,
  getGameStats,
  type CreateGameInput,
  type FinalizeGameInput,
  type RoundResult,
} from "./game-service"

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a test user with ranks and skill ratings.
 * This is required because game operations reference users.
 */
function createTestUser(db: TestDatabase, userId: string): void {
  // Create user
  db.sqlite.exec(`
    INSERT INTO users (id, email, username, auth_provider)
    VALUES ('${userId}', '${userId}@test.com', 'user_${userId}', 'google')
  `)

  // Create ranks for all 4 tracks
  const tracks = [
    "endless_voice",
    "endless_keyboard",
    "blitz_voice",
    "blitz_keyboard",
  ]
  for (const track of tracks) {
    const rankId = generateTestId("rank")
    db.sqlite.exec(`
      INSERT INTO user_ranks (id, user_id, track, tier, xp)
      VALUES ('${rankId}', '${userId}', '${track}', 'new_bee', 0)
    `)
    const skillId = generateTestId("skill")
    db.sqlite.exec(`
      INSERT INTO user_skill_ratings (id, user_id, track, rating, rating_deviation, volatility, derived_tier, games_played)
      VALUES ('${skillId}', '${userId}', '${track}', 1500, 350, 0.06, 4, 0)
    `)
  }
}

/**
 * Create a test word in the database.
 */
function createTestWord(db: TestDatabase, wordId: string, word: string): void {
  db.sqlite.exec(`
    INSERT INTO words (id, word, difficulty_tier, definition, example_sentence, audio_url, part_of_speech)
    VALUES ('${wordId}', '${word}', 4, 'test definition', 'test sentence', 'https://example.com/audio.mp3', 'noun')
  `)
}

// =============================================================================
// TEST SETUP
// =============================================================================

describe("GameService", () => {
  let db: TestDatabase

  beforeEach(() => {
    resetTestIdCounter()
    db = createTestDatabase()
  })

  afterEach(() => {
    db.close()
  })

  // ===========================================================================
  // createGame()
  // ===========================================================================

  describe("createGame", () => {
    it("creates game and game_player records", async () => {
      const userId = "test-user-1"
      createTestUser(db, userId)

      const input: CreateGameInput = {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      }

      const result = await createGame(db.d1 as unknown as D1Database, input)

      expect(result.gameId).toBeDefined()
      expect(result.gamePlayerId).toBeDefined()

      // Verify game record
      const game = db.sqlite
        .prepare("SELECT * FROM games WHERE id = ?")
        .get(result.gameId) as Record<string, unknown>

      expect(game.mode).toBe("endless")
      expect(game.input_method).toBe("voice")
      expect(game.type).toBe("single")
      expect(game.status).toBe("in_progress")
      expect(game.host_id).toBe(userId)

      // Verify game_player record
      const gamePlayer = db.sqlite
        .prepare("SELECT * FROM game_players WHERE id = ?")
        .get(result.gamePlayerId) as Record<string, unknown>

      expect(gamePlayer.game_id).toBe(result.gameId)
      expect(gamePlayer.user_id).toBe(userId)
      expect(gamePlayer.hearts).toBe(3) // endless mode starts with 3 hearts
    })

    it("sets hearts to 0 for blitz mode", async () => {
      const userId = "blitz-user"
      createTestUser(db, userId)

      const input: CreateGameInput = {
        userId,
        mode: "blitz",
        inputMethod: "keyboard",
        type: "single",
      }

      const result = await createGame(db.d1 as unknown as D1Database, input)

      const gamePlayer = db.sqlite
        .prepare("SELECT hearts FROM game_players WHERE id = ?")
        .get(result.gamePlayerId) as { hearts: number }

      expect(gamePlayer.hearts).toBe(0)
    })
  })

  // ===========================================================================
  // getGameById()
  // ===========================================================================

  describe("getGameById", () => {
    it("returns null for non-existent game", async () => {
      const game = await getGameById(
        db.d1 as unknown as D1Database,
        "non-existent-game"
      )
      expect(game).toBeNull()
    })

    it("returns game for existing game", async () => {
      const userId = "game-user"
      createTestUser(db, userId)

      const { gameId } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })

      const game = await getGameById(db.d1 as unknown as D1Database, gameId)

      expect(game).not.toBeNull()
      expect(game?.id).toBe(gameId)
      expect(game?.mode).toBe("endless")
    })
  })

  // ===========================================================================
  // finalizeGame()
  // ===========================================================================

  describe("finalizeGame", () => {
    it("records rounds and updates game status", async () => {
      const userId = "finalize-user"
      createTestUser(db, userId)

      // Create test words
      createTestWord(db, "word-1", "cat")
      createTestWord(db, "word-2", "dog")
      createTestWord(db, "word-3", "bird")

      // Create game
      const { gameId } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })

      // Define rounds
      const rounds: RoundResult[] = [
        {
          roundNumber: 1,
          wordId: "word-1",
          answer: "cat",
          isCorrect: true,
          timeTaken: 5,
        },
        {
          roundNumber: 2,
          wordId: "word-2",
          answer: "dog",
          isCorrect: true,
          timeTaken: 7,
        },
        {
          roundNumber: 3,
          wordId: "word-3",
          answer: "brid",
          isCorrect: false,
          timeTaken: 10,
        },
      ]

      // Finalize game
      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId,
        userId,
        rounds,
        xpEarned: 25,
        heartsRemaining: 2,
      })

      // Verify game status is finished
      const game = db.sqlite
        .prepare("SELECT status, ended_at FROM games WHERE id = ?")
        .get(gameId) as { status: string; ended_at: number }

      expect(game.status).toBe("finished")
      expect(game.ended_at).toBeDefined()

      // Verify rounds were recorded
      const savedRounds = db.sqlite
        .prepare("SELECT * FROM game_rounds WHERE game_id = ? ORDER BY round_number")
        .all(gameId) as Array<{
        round_number: number
        word_id: string
        answer: string
        is_correct: number
      }>

      expect(savedRounds).toHaveLength(3)
      expect(savedRounds[0].word_id).toBe("word-1")
      expect(savedRounds[0].answer).toBe("cat")
      expect(savedRounds[0].is_correct).toBe(1) // SQLite stores boolean as 1/0
      expect(savedRounds[2].is_correct).toBe(0)
    })

    it("updates game_player stats", async () => {
      const userId = "stats-user"
      createTestUser(db, userId)

      createTestWord(db, "word-a", "apple")
      createTestWord(db, "word-b", "banana")

      const { gameId } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })

      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId,
        userId,
        rounds: [
          {
            roundNumber: 1,
            wordId: "word-a",
            answer: "apple",
            isCorrect: true,
            timeTaken: 5,
          },
          {
            roundNumber: 2,
            wordId: "word-b",
            answer: "banan",
            isCorrect: false,
            timeTaken: 8,
          },
        ],
        xpEarned: 15,
        heartsRemaining: 1,
      })

      const player = db.sqlite
        .prepare(
          "SELECT * FROM game_players WHERE game_id = ? AND user_id = ?"
        )
        .get(gameId, userId) as Record<string, unknown>

      expect(player.rounds_completed).toBe(2)
      expect(player.correct_answers).toBe(1)
      expect(player.wrong_answers).toBe(1)
      expect(player.xp_earned).toBe(15)
      expect(player.hearts).toBe(1)
      expect(player.is_eliminated).toBe(0) // Still has hearts
    })

    it("marks player as eliminated when hearts reach 0", async () => {
      const userId = "eliminated-user"
      createTestUser(db, userId)

      createTestWord(db, "word-x", "zebra")

      const { gameId } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })

      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId,
        userId,
        rounds: [
          {
            roundNumber: 1,
            wordId: "word-x",
            answer: "wrong",
            isCorrect: false,
            timeTaken: 30,
          },
        ],
        xpEarned: 0,
        heartsRemaining: 0,
      })

      const player = db.sqlite
        .prepare(
          "SELECT is_eliminated, eliminated_at FROM game_players WHERE game_id = ? AND user_id = ?"
        )
        .get(gameId, userId) as { is_eliminated: number; eliminated_at: number }

      expect(player.is_eliminated).toBe(1)
      expect(player.eliminated_at).toBeDefined()
    })

    it("awards XP to user rank for the correct track", async () => {
      const userId = "xp-user"
      createTestUser(db, userId)

      createTestWord(db, "word-xp", "test")

      const { gameId } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })

      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId,
        userId,
        rounds: [
          {
            roundNumber: 1,
            wordId: "word-xp",
            answer: "test",
            isCorrect: true,
            timeTaken: 3,
          },
        ],
        xpEarned: 50,
        heartsRemaining: 3,
      })

      // Check the endless_voice track got XP
      const rank = db.sqlite
        .prepare(
          "SELECT xp FROM user_ranks WHERE user_id = ? AND track = 'endless_voice'"
        )
        .get(userId) as { xp: number }

      expect(rank.xp).toBe(50)

      // Other tracks should still have 0 XP
      const otherRank = db.sqlite
        .prepare(
          "SELECT xp FROM user_ranks WHERE user_id = ? AND track = 'endless_keyboard'"
        )
        .get(userId) as { xp: number }

      expect(otherRank.xp).toBe(0)
    })

    it("handles empty rounds array", async () => {
      const userId = "empty-user"
      createTestUser(db, userId)

      const { gameId } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })

      // This should not throw
      await expect(
        finalizeGame(db.d1 as unknown as D1Database, {
          gameId,
          userId,
          rounds: [],
          xpEarned: 0,
          heartsRemaining: 3,
        })
      ).resolves.toBeUndefined()

      // Verify game is still marked as finished
      const game = db.sqlite
        .prepare("SELECT status FROM games WHERE id = ?")
        .get(gameId) as { status: string }

      expect(game.status).toBe("finished")
    })
  })

  // ===========================================================================
  // getGameHistory()
  // ===========================================================================

  describe("getGameHistory", () => {
    it("returns empty array when no games exist", async () => {
      const history = await getGameHistory(
        db.d1 as unknown as D1Database,
        "no-games-user",
        "endless",
        "voice"
      )

      expect(history).toEqual([])
    })

    it("returns games for the specified track only", async () => {
      const userId = "history-user"
      createTestUser(db, userId)

      createTestWord(db, "word-h1", "hello")
      createTestWord(db, "word-h2", "world")

      // Create and finalize endless_voice game
      const { gameId: game1 } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })
      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId: game1,
        userId,
        rounds: [
          { roundNumber: 1, wordId: "word-h1", answer: "hello", isCorrect: true, timeTaken: 5 },
        ],
        xpEarned: 10,
        heartsRemaining: 0,
      })

      // Create and finalize endless_keyboard game
      const { gameId: game2 } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "keyboard",
        type: "single",
      })
      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId: game2,
        userId,
        rounds: [
          { roundNumber: 1, wordId: "word-h2", answer: "world", isCorrect: true, timeTaken: 3 },
        ],
        xpEarned: 10,
        heartsRemaining: 0,
      })

      // Query endless_voice only
      const voiceHistory = await getGameHistory(
        db.d1 as unknown as D1Database,
        userId,
        "endless",
        "voice"
      )

      expect(voiceHistory).toHaveLength(1)
      expect(voiceHistory[0].id).toBe(game1)

      // Query endless_keyboard only
      const keyboardHistory = await getGameHistory(
        db.d1 as unknown as D1Database,
        userId,
        "endless",
        "keyboard"
      )

      expect(keyboardHistory).toHaveLength(1)
      expect(keyboardHistory[0].id).toBe(game2)
    })

    it("calculates accuracy correctly", async () => {
      const userId = "accuracy-user"
      createTestUser(db, userId)

      createTestWord(db, "word-ac1", "one")
      createTestWord(db, "word-ac2", "two")
      createTestWord(db, "word-ac3", "three")
      createTestWord(db, "word-ac4", "four")

      const { gameId } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })

      // 3 correct, 1 wrong = 75% accuracy
      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId,
        userId,
        rounds: [
          { roundNumber: 1, wordId: "word-ac1", answer: "one", isCorrect: true, timeTaken: 5 },
          { roundNumber: 2, wordId: "word-ac2", answer: "two", isCorrect: true, timeTaken: 5 },
          { roundNumber: 3, wordId: "word-ac3", answer: "three", isCorrect: true, timeTaken: 5 },
          { roundNumber: 4, wordId: "word-ac4", answer: "wrong", isCorrect: false, timeTaken: 5 },
        ],
        xpEarned: 30,
        heartsRemaining: 0,
      })

      const history = await getGameHistory(
        db.d1 as unknown as D1Database,
        userId,
        "endless",
        "voice"
      )

      expect(history[0].accuracy).toBe(75)
      expect(history[0].correctAnswers).toBe(3)
      expect(history[0].wrongAnswers).toBe(1)
      expect(history[0].roundsCompleted).toBe(4)
    })
  })

  // ===========================================================================
  // getGameStats()
  // ===========================================================================

  describe("getGameStats", () => {
    it("returns zero stats when no games exist", async () => {
      const stats = await getGameStats(
        db.d1 as unknown as D1Database,
        "no-stats-user",
        "endless",
        "voice"
      )

      expect(stats.totalGames).toBe(0)
      expect(stats.totalRounds).toBe(0)
      expect(stats.totalCorrect).toBe(0)
      expect(stats.totalXp).toBe(0)
      expect(stats.averageAccuracy).toBe(0)
      expect(stats.bestRound).toBe(0)
    })

    it("aggregates stats across multiple games", async () => {
      const userId = "multi-game-user"
      createTestUser(db, userId)

      // Create words
      for (let i = 1; i <= 10; i++) {
        createTestWord(db, `word-m${i}`, `word${i}`)
      }

      // Game 1: 3 rounds, 2 correct, 1 wrong, 20 XP
      const { gameId: game1 } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })
      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId: game1,
        userId,
        rounds: [
          { roundNumber: 1, wordId: "word-m1", answer: "word1", isCorrect: true, timeTaken: 5 },
          { roundNumber: 2, wordId: "word-m2", answer: "word2", isCorrect: true, timeTaken: 5 },
          { roundNumber: 3, wordId: "word-m3", answer: "wrong", isCorrect: false, timeTaken: 5 },
        ],
        xpEarned: 20,
        heartsRemaining: 0,
      })

      // Game 2: 5 rounds, 4 correct, 1 wrong, 40 XP
      const { gameId: game2 } = await createGame(db.d1 as unknown as D1Database, {
        userId,
        mode: "endless",
        inputMethod: "voice",
        type: "single",
      })
      await finalizeGame(db.d1 as unknown as D1Database, {
        gameId: game2,
        userId,
        rounds: [
          { roundNumber: 1, wordId: "word-m4", answer: "word4", isCorrect: true, timeTaken: 5 },
          { roundNumber: 2, wordId: "word-m5", answer: "word5", isCorrect: true, timeTaken: 5 },
          { roundNumber: 3, wordId: "word-m6", answer: "word6", isCorrect: true, timeTaken: 5 },
          { roundNumber: 4, wordId: "word-m7", answer: "word7", isCorrect: true, timeTaken: 5 },
          { roundNumber: 5, wordId: "word-m8", answer: "wrong", isCorrect: false, timeTaken: 5 },
        ],
        xpEarned: 40,
        heartsRemaining: 0,
      })

      const stats = await getGameStats(
        db.d1 as unknown as D1Database,
        userId,
        "endless",
        "voice"
      )

      expect(stats.totalGames).toBe(2)
      expect(stats.totalRounds).toBe(8) // 3 + 5
      expect(stats.totalCorrect).toBe(6) // 2 + 4
      expect(stats.totalXp).toBe(60) // 20 + 40
      expect(stats.averageAccuracy).toBe(75) // 6 correct / 8 total = 75%
      expect(stats.bestRound).toBe(5) // Game 2 had 5 rounds
    })
  })
})
