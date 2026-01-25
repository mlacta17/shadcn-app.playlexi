/**
 * Leaderboard Service — PlayLexi
 *
 * Handles leaderboard data retrieval, including:
 * - Fetching ranked player lists by track
 * - Finding a user's position in the leaderboard
 * - Aggregating stats for leaderboard display
 *
 * ## Architecture Notes
 *
 * The leaderboard is based on XP (visible progression), not Glicko-2 ratings.
 * Each track (endless_voice, endless_keyboard, blitz_voice, blitz_keyboard)
 * has its own independent leaderboard.
 *
 * ## Performance Considerations
 *
 * - Uses indexed queries on (track, xp) for efficient sorting
 * - Pagination prevents loading entire player base
 * - User position query is separate to allow caching strategies
 *
 * @see db/schema.ts for userRanks table definition
 * @see lib/game-constants.ts for tier/XP thresholds
 */

import type { D1Database } from "@cloudflare/workers-types"
import { drizzle } from "drizzle-orm/d1"
import { eq, and, desc, sql, gt } from "drizzle-orm"
import * as schema from "@/db/schema"
import type { RankTrack, RankTier, GameMode, InputMethod } from "@/db/schema"

// =============================================================================
// TYPES
// =============================================================================

/**
 * A player entry in the leaderboard.
 * Matches the LeaderboardPlayer interface expected by the UI component.
 */
export interface LeaderboardEntry {
  /** User ID */
  id: string
  /** Display name (username) */
  name: string
  /** User's tier name for description */
  description: string
  /** PlayLexi avatar ID (1=dog, 2=person, 3=cat) */
  avatarId?: number
  /** Best round count (from game stats) */
  round: number
  /** Position change from previous period (placeholder for now) */
  delta: number
  /** Average accuracy percentage */
  accuracy: number
  /** Total XP points */
  points: number
  /** Current rank/position in leaderboard */
  rank: number
  /** User's tier */
  tier: RankTier
  /** Whether this is the current user */
  isCurrentUser?: boolean
}

/**
 * Response for leaderboard queries.
 */
export interface LeaderboardResponse {
  /** Paginated list of players */
  players: LeaderboardEntry[]
  /** Total number of players on this track */
  totalPlayers: number
  /** Current page (1-indexed) */
  page: number
  /** Total pages */
  totalPages: number
  /** Current user's position (if authenticated) */
  currentUserPosition?: number
  /** Current user's entry (if in top results or specifically fetched) */
  currentUser?: LeaderboardEntry
}

/**
 * Options for leaderboard queries.
 */
export interface LeaderboardOptions {
  /** Game mode */
  mode: GameMode
  /** Input method */
  inputMethod: InputMethod
  /** Page number (1-indexed) */
  page?: number
  /** Results per page */
  limit?: number
  /** Search filter for usernames */
  search?: string
  /** Current user ID (to mark their entry and find position) */
  currentUserId?: string
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert mode + inputMethod to RankTrack.
 */
function toRankTrack(mode: GameMode, inputMethod: InputMethod): RankTrack {
  return `${mode}_${inputMethod}` as RankTrack
}

/**
 * Convert tier to human-readable label.
 */
function tierToLabel(tier: RankTier): string {
  const labels: Record<RankTier, string> = {
    new_bee: "New Bee",
    bumble_bee: "Bumble Bee",
    busy_bee: "Busy Bee",
    honey_bee: "Honey Bee",
    worker_bee: "Worker Bee",
    royal_bee: "Royal Bee",
    bee_keeper: "Bee Keeper",
  }
  return labels[tier] || tier
}

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Get leaderboard for a specific track.
 *
 * Returns players ranked by XP with pagination support.
 * Optionally includes the current user's position.
 *
 * @param d1 - D1 database binding
 * @param options - Query options
 * @returns Paginated leaderboard response
 *
 * @example
 * ```typescript
 * const leaderboard = await getLeaderboard(env.DB, {
 *   mode: "endless",
 *   inputMethod: "voice",
 *   page: 1,
 *   limit: 20,
 *   currentUserId: session.user.id,
 * })
 * ```
 */
export async function getLeaderboard(
  d1: D1Database,
  options: LeaderboardOptions
): Promise<LeaderboardResponse> {
  const db = drizzle(d1, { schema })
  const track = toRankTrack(options.mode, options.inputMethod)
  const page = Math.max(1, options.page ?? 1)
  const limit = Math.min(100, Math.max(1, options.limit ?? 20))
  const offset = (page - 1) * limit

  // Build the base query - join userRanks with users to get username/avatar
  // Also join with aggregated game stats for accuracy and best round

  // First, get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.userRanks)
    .innerJoin(schema.users, eq(schema.userRanks.userId, schema.users.id))
    .where(
      options.search
        ? and(
            eq(schema.userRanks.track, track),
            sql`LOWER(${schema.users.username}) LIKE ${`%${options.search.toLowerCase()}%`}`
          )
        : eq(schema.userRanks.track, track)
    )

  const totalPlayers = countResult[0]?.count ?? 0
  const totalPages = Math.ceil(totalPlayers / limit)

  // Get the ranked players
  // Using a subquery to get aggregate stats from game_players
  const rankedPlayers = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      avatarId: schema.users.avatarId,
      tier: schema.userRanks.tier,
      xp: schema.userRanks.xp,
    })
    .from(schema.userRanks)
    .innerJoin(schema.users, eq(schema.userRanks.userId, schema.users.id))
    .where(
      options.search
        ? and(
            eq(schema.userRanks.track, track),
            sql`LOWER(${schema.users.username}) LIKE ${`%${options.search.toLowerCase()}%`}`
          )
        : eq(schema.userRanks.track, track)
    )
    .orderBy(desc(schema.userRanks.xp))
    .limit(limit)
    .offset(offset)

  // Get game stats for these players (accuracy, best round)
  // This is done separately to avoid complex join performance issues
  const playerIds = rankedPlayers.map(p => p.id)

  // Get aggregate stats per player for this track's games
  const playerStats = playerIds.length > 0
    ? await db
        .select({
          userId: schema.gamePlayers.userId,
          totalCorrect: sql<number>`COALESCE(SUM(${schema.gamePlayers.correctAnswers}), 0)`,
          totalWrong: sql<number>`COALESCE(SUM(${schema.gamePlayers.wrongAnswers}), 0)`,
          bestRound: sql<number>`COALESCE(MAX(${schema.gamePlayers.roundsCompleted}), 0)`,
        })
        .from(schema.gamePlayers)
        .innerJoin(schema.games, eq(schema.gamePlayers.gameId, schema.games.id))
        .where(
          and(
            sql`${schema.gamePlayers.userId} IN (${sql.join(playerIds.map(id => sql`${id}`), sql`, `)})`,
            eq(schema.games.mode, options.mode),
            eq(schema.games.inputMethod, options.inputMethod),
            eq(schema.games.status, "finished")
          )
        )
        .groupBy(schema.gamePlayers.userId)
    : []

  // Create a map for quick lookup
  const statsMap = new Map(
    playerStats.map(s => [
      s.userId,
      {
        accuracy: s.totalCorrect + s.totalWrong > 0
          ? Math.round((s.totalCorrect / (s.totalCorrect + s.totalWrong)) * 100)
          : 0,
        bestRound: s.bestRound,
      }
    ])
  )

  // Build leaderboard entries
  const players: LeaderboardEntry[] = rankedPlayers.map((player, index) => {
    const stats = statsMap.get(player.id) ?? { accuracy: 0, bestRound: 0 }
    const globalRank = offset + index + 1

    return {
      id: player.id,
      name: player.username,
      description: tierToLabel(player.tier as RankTier),
      avatarId: player.avatarId ?? undefined,
      round: stats.bestRound,
      delta: 0, // Position change tracking would require historical data
      accuracy: stats.accuracy,
      points: player.xp,
      rank: globalRank,
      tier: player.tier as RankTier,
      isCurrentUser: player.id === options.currentUserId,
    }
  })

  // Get current user's position if they're not in the current page
  let currentUserPosition: number | undefined
  let currentUser: LeaderboardEntry | undefined

  if (options.currentUserId) {
    // Check if user is already in the results
    const userInResults = players.find(p => p.isCurrentUser)

    if (userInResults) {
      currentUserPosition = userInResults.rank
      currentUser = userInResults
    } else {
      // Find user's position by counting players with more XP
      const positionResult = await db
        .select({
          position: sql<number>`COUNT(*) + 1`,
        })
        .from(schema.userRanks)
        .innerJoin(schema.users, eq(schema.userRanks.userId, schema.users.id))
        .where(
          and(
            eq(schema.userRanks.track, track),
            gt(
              schema.userRanks.xp,
              sql`(SELECT xp FROM user_ranks WHERE user_id = ${options.currentUserId} AND track = ${track})`
            )
          )
        )

      currentUserPosition = positionResult[0]?.position ?? totalPlayers

      // Fetch the current user's entry
      const userEntry = await db
        .select({
          id: schema.users.id,
          username: schema.users.username,
          avatarId: schema.users.avatarId,
          tier: schema.userRanks.tier,
          xp: schema.userRanks.xp,
        })
        .from(schema.userRanks)
        .innerJoin(schema.users, eq(schema.userRanks.userId, schema.users.id))
        .where(
          and(
            eq(schema.userRanks.userId, options.currentUserId),
            eq(schema.userRanks.track, track)
          )
        )
        .limit(1)

      if (userEntry[0]) {
        const user = userEntry[0]
        const userStats = await db
          .select({
            totalCorrect: sql<number>`COALESCE(SUM(${schema.gamePlayers.correctAnswers}), 0)`,
            totalWrong: sql<number>`COALESCE(SUM(${schema.gamePlayers.wrongAnswers}), 0)`,
            bestRound: sql<number>`COALESCE(MAX(${schema.gamePlayers.roundsCompleted}), 0)`,
          })
          .from(schema.gamePlayers)
          .innerJoin(schema.games, eq(schema.gamePlayers.gameId, schema.games.id))
          .where(
            and(
              eq(schema.gamePlayers.userId, options.currentUserId),
              eq(schema.games.mode, options.mode),
              eq(schema.games.inputMethod, options.inputMethod),
              eq(schema.games.status, "finished")
            )
          )

        const stats = userStats[0] ?? { totalCorrect: 0, totalWrong: 0, bestRound: 0 }
        const accuracy = stats.totalCorrect + stats.totalWrong > 0
          ? Math.round((stats.totalCorrect / (stats.totalCorrect + stats.totalWrong)) * 100)
          : 0

        currentUser = {
          id: user.id,
          name: user.username,
          description: tierToLabel(user.tier as RankTier),
          avatarId: user.avatarId ?? undefined,
          round: stats.bestRound,
          delta: 0,
          accuracy,
          points: user.xp,
          rank: currentUserPosition,
          tier: user.tier as RankTier,
          isCurrentUser: true,
        }
      }
    }
  }

  return {
    players,
    totalPlayers,
    page,
    totalPages,
    currentUserPosition,
    currentUser,
  }
}

/**
 * Get the current user's rank data for display in the leaderboard header.
 *
 * @param d1 - D1 database binding
 * @param userId - User ID
 * @param mode - Game mode
 * @param inputMethod - Input method
 * @returns User's rank data or null if not found
 */
export async function getUserLeaderboardRank(
  d1: D1Database,
  userId: string,
  mode: GameMode,
  inputMethod: InputMethod
): Promise<{
  tier: RankTier
  xp: number
  xpForNextTier: number
  position: number
  totalPlayers: number
} | null> {
  const db = drizzle(d1, { schema })
  const track = toRankTrack(mode, inputMethod)

  // Get user's rank data
  const userRank = await db.query.userRanks.findFirst({
    where: and(
      eq(schema.userRanks.userId, userId),
      eq(schema.userRanks.track, track)
    ),
  })

  if (!userRank) return null

  // Get position (count of users with more XP + 1)
  const positionResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.userRanks)
    .where(
      and(
        eq(schema.userRanks.track, track),
        gt(schema.userRanks.xp, userRank.xp)
      )
    )

  const position = (positionResult[0]?.count ?? 0) + 1

  // Get total players on track
  const totalResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.userRanks)
    .where(eq(schema.userRanks.track, track))

  const totalPlayers = totalResult[0]?.count ?? 0

  // Import XP thresholds to calculate XP for next tier
  const { XP_THRESHOLDS, TIER_ORDER } = await import("@/lib/game-constants")

  const currentTierIndex = TIER_ORDER.indexOf(userRank.tier as RankTier)
  const isMaxTier = currentTierIndex >= TIER_ORDER.length - 1

  const currentThreshold = XP_THRESHOLDS[userRank.tier as RankTier]
  const nextThreshold = isMaxTier
    ? currentThreshold + 100 // Show 100 as placeholder for max tier
    : XP_THRESHOLDS[TIER_ORDER[currentTierIndex + 1]]

  const xpForNextTier = nextThreshold - currentThreshold

  return {
    tier: userRank.tier as RankTier,
    xp: userRank.xp - currentThreshold, // XP within current tier
    xpForNextTier,
    position,
    totalPlayers,
  }
}
