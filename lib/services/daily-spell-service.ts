/**
 * Daily Spell Service — PlayLexi
 *
 * Business logic for the Daily Spell game mode.
 * Handles puzzle retrieval, result submission, streak tracking, and challenge links.
 *
 * ## Key Concepts
 *
 * - **Puzzle**: 5 words in fixed order, same for everyone on a given day
 * - **Streak**: Consecutive days of completion (any score counts)
 * - **Challenge Link**: Reusable referral link per user for tracking invites
 *
 * ## Date Handling
 *
 * All dates use UTC. "Today" is determined by UTC midnight.
 * This ensures all players worldwide see the same puzzle on the same calendar date.
 *
 * @see db/schema.ts for table definitions
 */

import { eq, and, desc, sql, isNotNull } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import {
  dailySpellPuzzles,
  dailySpellResults,
  dailySpellStreaks,
  challengeLinks,
  challengeReferrals,
  words,
} from "@/db/schema"
import { generatePuzzleForDate } from "./puzzle-generator"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Word result from a daily spell attempt.
 */
export interface WordResult {
  wordId: string
  word: string
  answer: string
  correct: boolean
  timeTaken: number
  difficulty: number
}

/**
 * Today's puzzle with user status.
 */
export interface TodayPuzzle {
  puzzleId: string
  puzzleNumber: number
  puzzleDate: string
  words: {
    id: string
    word: string
    definition: string
    exampleSentence: string
    audioUrl: string
    introAudioUrl: string | null
    sentenceAudioUrl: string | null
    definitionAudioUrl: string | null
    difficultyTier: number
  }[]
  userResult: {
    score: number
    emojiRow: string
    wordResults: WordResult[]
    percentile: number | null
    completedAt: Date
  } | null
}

/**
 * User's daily spell statistics.
 */
export interface DailySpellStats {
  currentStreak: number
  bestStreak: number
  totalGamesPlayed: number
  totalWins: number
  winRate: number
  lastPlayedDate: string | null
}

/**
 * Result submission input.
 */
export interface SubmitResultInput {
  puzzleId: string
  userId: string
  isAuthenticated: boolean
  wordResults: WordResult[]
}

/**
 * Challenge link info.
 */
export interface ChallengeInfo {
  code: string
  acceptedCount: number
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get today's date in YYYY-MM-DD format (UTC).
 */
export function getTodayDate(): string {
  const now = new Date()
  return now.toISOString().split("T")[0]
}

/**
 * Get yesterday's date in YYYY-MM-DD format (UTC).
 */
function getYesterdayDate(): string {
  const now = new Date()
  now.setUTCDate(now.getUTCDate() - 1)
  return now.toISOString().split("T")[0]
}

/**
 * Generate emoji row from word results.
 */
function generateEmojiRow(wordResults: WordResult[]): string {
  return wordResults.map((r) => (r.correct ? "✅" : "❌")).join("")
}

/**
 * Generate a random 8-character alphanumeric code.
 */
function generateChallengeCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

// =============================================================================
// PUZZLE FUNCTIONS
// =============================================================================

/**
 * Get today's puzzle with user's result if they've played.
 */
export async function getTodayPuzzle(
  db: D1Database,
  userId: string | null
): Promise<TodayPuzzle | null> {
  const orm = drizzle(db)
  const today = getTodayDate()

  // Get today's puzzle
  let puzzle = await orm
    .select()
    .from(dailySpellPuzzles)
    .where(eq(dailySpellPuzzles.puzzleDate, today))
    .get()

  if (!puzzle) {
    // On-demand fallback: generate a puzzle so the game never breaks
    console.warn("[DailySpell] No puzzle found for today:", today, "— generating on-demand")
    try {
      await generatePuzzleForDate(db, today)
    } catch (error) {
      console.error("[DailySpell] On-demand generation failed:", error)
    }
    // Re-query (handles both our generation and concurrent creation)
    puzzle = await orm
      .select()
      .from(dailySpellPuzzles)
      .where(eq(dailySpellPuzzles.puzzleDate, today))
      .get()
  }

  if (!puzzle) {
    console.error("[DailySpell] No puzzle for today even after fallback:", today)
    return null
  }

  // Parse word IDs and fetch words
  const wordIds = JSON.parse(puzzle.wordIds) as string[]
  const puzzleWords = await Promise.all(
    wordIds.map(async (wordId) => {
      const word = await orm
        .select()
        .from(words)
        .where(eq(words.id, wordId))
        .get()
      return word
    })
  )

  // Filter out any null words (shouldn't happen, but be safe)
  const validWords = puzzleWords.filter((w) => w !== undefined)

  // Get user's result if they've played
  let userResult = null
  if (userId) {
    const result = await orm
      .select()
      .from(dailySpellResults)
      .where(
        and(
          eq(dailySpellResults.puzzleId, puzzle.id),
          eq(dailySpellResults.userId, userId)
        )
      )
      .get()

    if (result) {
      // completedAt is a timestamp - Drizzle returns it as a Date when mode is "timestamp"
      const completedAt = result.completedAt instanceof Date
        ? result.completedAt
        : new Date((result.completedAt as number) * 1000)

      userResult = {
        score: result.score,
        emojiRow: result.emojiRow,
        wordResults: JSON.parse(result.wordResults) as WordResult[],
        percentile: result.percentile,
        completedAt,
      }
    }
  }

  return {
    puzzleId: puzzle.id,
    puzzleNumber: puzzle.puzzleNumber,
    puzzleDate: puzzle.puzzleDate,
    words: validWords.map((w) => ({
      id: w!.id,
      word: w!.word,
      definition: w!.definition,
      exampleSentence: w!.exampleSentence,
      audioUrl: w!.audioUrl,
      introAudioUrl: w!.introAudioUrl,
      sentenceAudioUrl: w!.sentenceAudioUrl,
      definitionAudioUrl: w!.definitionAudioUrl,
      difficultyTier: w!.difficultyTier,
    })),
    userResult,
  }
}

/**
 * Check if user has played today's puzzle.
 */
export async function hasPlayedToday(
  db: D1Database,
  userId: string
): Promise<boolean> {
  const orm = drizzle(db)
  const today = getTodayDate()

  // Get today's puzzle
  const puzzle = await orm
    .select({ id: dailySpellPuzzles.id })
    .from(dailySpellPuzzles)
    .where(eq(dailySpellPuzzles.puzzleDate, today))
    .get()

  if (!puzzle) return false

  // Check if user has a result
  const result = await orm
    .select({ id: dailySpellResults.id })
    .from(dailySpellResults)
    .where(
      and(
        eq(dailySpellResults.puzzleId, puzzle.id),
        eq(dailySpellResults.userId, userId)
      )
    )
    .get()

  return result !== undefined
}

// =============================================================================
// RESULT FUNCTIONS
// =============================================================================

/**
 * Submit a daily spell result.
 */
export async function submitResult(
  db: D1Database,
  input: SubmitResultInput
): Promise<{ score: number; emojiRow: string; percentile: number | null }> {
  const orm = drizzle(db)

  // Calculate score
  const score = input.wordResults.filter((r) => r.correct).length
  const emojiRow = generateEmojiRow(input.wordResults)

  // Insert result
  await orm.insert(dailySpellResults).values({
    puzzleId: input.puzzleId,
    userId: input.userId,
    isAuthenticated: input.isAuthenticated,
    score,
    wordResults: JSON.stringify(input.wordResults),
    emojiRow,
  })

  // Update streak
  await updateStreak(db, input.userId, score)

  // Calculate percentile (async, don't wait)
  const percentile = await calculatePercentile(db, input.puzzleId, score)

  // Update the result with percentile
  if (percentile !== null) {
    await orm
      .update(dailySpellResults)
      .set({ percentile })
      .where(
        and(
          eq(dailySpellResults.puzzleId, input.puzzleId),
          eq(dailySpellResults.userId, input.userId)
        )
      )
  }

  return { score, emojiRow, percentile }
}

/**
 * Calculate percentile for a score on a given puzzle.
 */
async function calculatePercentile(
  db: D1Database,
  puzzleId: string,
  score: number
): Promise<number | null> {
  const orm = drizzle(db)

  // Count total results
  const totalResult = await orm
    .select({ count: sql<number>`count(*)` })
    .from(dailySpellResults)
    .where(eq(dailySpellResults.puzzleId, puzzleId))
    .get()

  const total = totalResult?.count ?? 0

  // Need at least 10 players for meaningful percentile
  if (total < 10) return null

  // Count how many scored lower than this player
  const lowerResult = await orm
    .select({ count: sql<number>`count(*)` })
    .from(dailySpellResults)
    .where(
      and(
        eq(dailySpellResults.puzzleId, puzzleId),
        sql`${dailySpellResults.score} < ${score}`
      )
    )
    .get()

  const lower = lowerResult?.count ?? 0

  // Percentile = (lower / total) * 100, but we show "top X%"
  // So if you beat 80% of players, you're in the top 20%
  const percentile = Math.round(100 - (lower / total) * 100)

  return percentile
}

// =============================================================================
// STREAK FUNCTIONS
// =============================================================================

/**
 * Get user's daily spell statistics.
 */
export async function getUserStats(
  db: D1Database,
  userId: string
): Promise<DailySpellStats> {
  const orm = drizzle(db)

  const streak = await orm
    .select()
    .from(dailySpellStreaks)
    .where(eq(dailySpellStreaks.userId, userId))
    .get()

  if (!streak) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalGamesPlayed: 0,
      totalWins: 0,
      winRate: 0,
      lastPlayedDate: null,
    }
  }

  const winRate =
    streak.totalGamesPlayed > 0
      ? Math.round((streak.totalWins / streak.totalGamesPlayed) * 100)
      : 0

  return {
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    totalGamesPlayed: streak.totalGamesPlayed,
    totalWins: streak.totalWins,
    winRate,
    lastPlayedDate: streak.lastPlayedDate,
  }
}

/**
 * Update user's streak after completing a puzzle.
 */
async function updateStreak(
  db: D1Database,
  userId: string,
  score: number
): Promise<void> {
  const orm = drizzle(db)
  const today = getTodayDate()
  const yesterday = getYesterdayDate()
  const isWin = score >= 3 // 3/5 or better is a win

  // Get current streak record
  const existing = await orm
    .select()
    .from(dailySpellStreaks)
    .where(eq(dailySpellStreaks.userId, userId))
    .get()

  if (!existing) {
    // First game ever
    await orm.insert(dailySpellStreaks).values({
      userId,
      currentStreak: 1,
      bestStreak: 1,
      lastPlayedDate: today,
      totalGamesPlayed: 1,
      totalWins: isWin ? 1 : 0,
    })
    return
  }

  // Calculate new streak
  let newStreak: number

  if (existing.lastPlayedDate === yesterday) {
    // Consecutive day - increment streak
    newStreak = existing.currentStreak + 1
  } else if (existing.lastPlayedDate === today) {
    // Already played today (shouldn't happen, but handle it)
    newStreak = existing.currentStreak
  } else {
    // Missed a day - reset streak
    newStreak = 1
  }

  const newBestStreak = Math.max(existing.bestStreak, newStreak)

  await orm
    .update(dailySpellStreaks)
    .set({
      currentStreak: newStreak,
      bestStreak: newBestStreak,
      lastPlayedDate: today,
      totalGamesPlayed: existing.totalGamesPlayed + 1,
      totalWins: existing.totalWins + (isWin ? 1 : 0),
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(dailySpellStreaks.userId, userId))
}

/**
 * Get the current week's activity (Mon-Sun).
 * Returns which days the user played this week.
 */
export async function getWeekActivity(
  db: D1Database,
  userId: string
): Promise<{ day: string; played: boolean }[]> {
  const orm = drizzle(db)

  // Get current week's Monday
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - daysFromMonday)
  monday.setUTCHours(0, 0, 0, 0)

  // Generate all 7 days of the week
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  const weekDates: string[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + i)
    weekDates.push(date.toISOString().split("T")[0])
  }

  // Get puzzles for this week
  const puzzles = await orm
    .select({ id: dailySpellPuzzles.id, puzzleDate: dailySpellPuzzles.puzzleDate })
    .from(dailySpellPuzzles)
    .where(
      sql`${dailySpellPuzzles.puzzleDate} >= ${weekDates[0]} AND ${dailySpellPuzzles.puzzleDate} <= ${weekDates[6]}`
    )

  // Get user's results for these puzzles
  const puzzleIds = puzzles.map((p) => p.id)
  let playedDates: string[] = []

  if (puzzleIds.length > 0) {
    const results = await orm
      .select({ puzzleId: dailySpellResults.puzzleId })
      .from(dailySpellResults)
      .where(
        and(
          eq(dailySpellResults.userId, userId),
          sql`${dailySpellResults.puzzleId} IN (${sql.join(puzzleIds.map(id => sql`${id}`), sql`, `)})`
        )
      )

    const playedPuzzleIds = new Set(results.map((r) => r.puzzleId))
    playedDates = puzzles
      .filter((p) => playedPuzzleIds.has(p.id))
      .map((p) => p.puzzleDate)
  }

  // Build activity array
  return days.map((day, i) => ({
    day,
    played: playedDates.includes(weekDates[i]),
  }))
}

// =============================================================================
// CHALLENGE LINK FUNCTIONS
// =============================================================================

/**
 * Get or create user's challenge link.
 */
export async function getOrCreateChallengeLink(
  db: D1Database,
  userId: string
): Promise<ChallengeInfo> {
  const orm = drizzle(db)

  // Check for existing link
  let link = await orm
    .select()
    .from(challengeLinks)
    .where(eq(challengeLinks.userId, userId))
    .get()

  // Create if doesn't exist
  if (!link) {
    const code = generateChallengeCode()
    await orm.insert(challengeLinks).values({
      userId,
      code,
    })
    link = { id: crypto.randomUUID(), userId, code, createdAt: new Date() }
  }

  // Count accepted invitations (people who played)
  const acceptedResult = await orm
    .select({ count: sql<number>`count(*)` })
    .from(challengeReferrals)
    .where(
      and(
        eq(challengeReferrals.linkId, link.id),
        isNotNull(challengeReferrals.playedAt)
      )
    )
    .get()

  return {
    code: link.code,
    acceptedCount: acceptedResult?.count ?? 0,
  }
}

/**
 * Record a challenge link click.
 */
export async function recordChallengeClick(
  db: D1Database,
  code: string,
  visitorId: string
): Promise<void> {
  const orm = drizzle(db)

  // Find the link
  const link = await orm
    .select()
    .from(challengeLinks)
    .where(eq(challengeLinks.code, code))
    .get()

  if (!link) {
    console.warn("[DailySpell] Challenge link not found:", code)
    return
  }

  // Check if this visitor already clicked
  const existing = await orm
    .select()
    .from(challengeReferrals)
    .where(
      and(
        eq(challengeReferrals.linkId, link.id),
        eq(challengeReferrals.visitorId, visitorId)
      )
    )
    .get()

  if (existing) {
    // Already recorded
    return
  }

  // Record the click
  await orm.insert(challengeReferrals).values({
    linkId: link.id,
    visitorId,
  })
}

/**
 * Mark a referral as "played" when the visitor completes a daily.
 */
export async function markReferralAsPlayed(
  db: D1Database,
  visitorId: string
): Promise<void> {
  const orm = drizzle(db)

  await orm
    .update(challengeReferrals)
    .set({ playedAt: sql`(unixepoch())` })
    .where(eq(challengeReferrals.visitorId, visitorId))
}

/**
 * Link a referral to a user account when they sign up.
 */
export async function linkReferralToUser(
  db: D1Database,
  visitorId: string,
  userId: string
): Promise<void> {
  const orm = drizzle(db)

  await orm
    .update(challengeReferrals)
    .set({ signedUpUserId: userId })
    .where(eq(challengeReferrals.visitorId, visitorId))
}

// =============================================================================
// LEADERBOARD FUNCTIONS
// =============================================================================

/**
 * Get today's leaderboard (top scores).
 */
export async function getTodayLeaderboard(
  db: D1Database,
  limit: number = 100
): Promise<
  {
    rank: number
    userId: string
    score: number
    emojiRow: string
  }[]
> {
  const orm = drizzle(db)
  const today = getTodayDate()

  // Get today's puzzle
  const puzzle = await orm
    .select({ id: dailySpellPuzzles.id })
    .from(dailySpellPuzzles)
    .where(eq(dailySpellPuzzles.puzzleDate, today))
    .get()

  if (!puzzle) return []

  // Get top results
  const results = await orm
    .select({
      userId: dailySpellResults.userId,
      score: dailySpellResults.score,
      emojiRow: dailySpellResults.emojiRow,
    })
    .from(dailySpellResults)
    .where(eq(dailySpellResults.puzzleId, puzzle.id))
    .orderBy(desc(dailySpellResults.score))
    .limit(limit)

  return results.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    score: r.score,
    emojiRow: r.emojiRow,
  }))
}
