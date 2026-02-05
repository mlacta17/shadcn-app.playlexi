"use client"

import * as React from "react"

import { RankBadge, LeaderboardTable, type LeaderboardPlayer } from "@/components/game"
import type { RankTier as BadgeRankTier, RANK_LABELS } from "@/components/game/rank-badge"
import { HexPattern } from "@/components/ui/hex-pattern"
import { Progress } from "@/components/ui/progress"
import { SearchInput } from "@/components/ui/search-input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useLeaderboard, type UserRankData } from "@/hooks/use-leaderboard"
import type { GameMode, InputMethod, RankTier } from "@/db/schema"

/**
 * Leaderboard Page — Ranked player standings.
 *
 * Displays player rankings across different game modes (Endless, Blitz)
 * with search and pagination capabilities.
 *
 * ## Features
 * - League badge with rank progress (when authenticated)
 * - Game mode tabs with input method subtabs
 * - Player search
 * - Paginated results
 * - Current user highlighting
 *
 * ## Data Flow
 *
 * 1. User selects track via tabs (e.g., Endless Voice)
 * 2. useLeaderboard hook fetches from /api/leaderboard
 * 3. API queries userRanks joined with users and game stats
 * 4. Results paginated and displayed in LeaderboardTable
 *
 * @see lib/services/leaderboard-service.ts for data fetching
 * @see hooks/use-leaderboard.ts for client-side state
 */

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Human-readable labels for each rank tier.
 */
const TIER_LABELS: Record<string, string> = {
  new_bee: "New Bee",
  bumble_bee: "Bumble Bee",
  busy_bee: "Busy Bee",
  honey_bee: "Honey Bee",
  worker_bee: "Worker Bee",
  royal_bee: "Royal Bee",
  bee_keeper: "Bee Keeper",
}

/**
 * Convert database tier format (underscore) to badge format (hyphen).
 * Database: "new_bee" → Badge: "new-bee"
 */
function tierToBadgeFormat(tier: RankTier | string): BadgeRankTier {
  return tier.replace(/_/g, "-") as BadgeRankTier
}

/**
 * Get tier label from tier name.
 */
function getTierLabel(tier: RankTier | string): string {
  return TIER_LABELS[tier] || tier
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Loading skeleton for the leaderboard header.
 */
function HeaderSkeleton() {
  return (
    <div className="mb-8 flex flex-col items-center gap-4">
      <Skeleton className="h-24 w-24 rounded-full" />
      <Skeleton className="h-6 w-32" />
      <div className="w-full max-w-xs space-y-2">
        <Skeleton className="h-2 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

/**
 * Loading skeleton for the leaderboard table.
 */
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

/**
 * Rank header showing user's current rank and progress.
 */
interface RankHeaderProps {
  userRank: UserRankData | null
  isLoading: boolean
}

function RankHeader({ userRank, isLoading }: RankHeaderProps) {
  if (isLoading) {
    return <HeaderSkeleton />
  }

  // Show default state if no user rank (not authenticated or no games played)
  const tier = userRank?.tier ? tierToBadgeFormat(userRank.tier) : "new-bee"
  const tierLabel = userRank?.tier ? getTierLabel(userRank.tier) : "New Bee"
  const xp = userRank?.xp ?? 0
  const xpForNextTier = userRank?.xpForNextTier ?? 100
  const progress = Math.min(100, (xp / xpForNextTier) * 100)
  const position = userRank?.position ?? 0
  const totalPlayers = userRank?.totalPlayers ?? 0

  return (
    <div className="mb-8 flex flex-col items-center gap-4">
      <RankBadge rank={tier} size="lg" />
      <h1 className="text-xl font-bold">{tierLabel} League</h1>
      <div className="w-full max-w-xs space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>XP PROGRESS</span>
          <span>
            {xp}/{xpForNextTier}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Leaderboard content for a specific track.
 */
interface LeaderboardContentProps {
  mode: GameMode
  inputMethod: InputMethod
  search: string
  onSearchChange: (value: string) => void
}

function LeaderboardContent({
  mode,
  inputMethod,
  search,
  onSearchChange,
}: LeaderboardContentProps) {
  const {
    players,
    isLoading,
    error,
    userRank,
  } = useLeaderboard({
    mode,
    inputMethod,
    pageSize: 7,
  })

  // Transform players for LeaderboardTable component
  const tableData: LeaderboardPlayer[] = React.useMemo(() => {
    return players.map((player) => ({
      id: player.id,
      name: player.isCurrentUser ? `${player.name} (You)` : player.name,
      description: player.description || getTierLabel(player.tier),
      avatarId: player.avatarId,
      round: player.round,
      delta: player.delta,
      accuracy: player.accuracy,
      points: player.points,
    }))
  }, [players])

  // Filter by search (client-side for immediate feedback)
  const filteredData = React.useMemo(() => {
    if (!search) return tableData
    return tableData.filter((player) =>
      player.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [tableData, search])

  return (
    <>
      <RankHeader userRank={userRank} isLoading={isLoading} />

      {/* Search row */}
      <div className="mb-6 flex items-center gap-4">
        <SearchInput
          placeholder="Search players"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          containerClassName="flex-1"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && <TableSkeleton />}

      {/* Empty state */}
      {!isLoading && !error && filteredData.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          {search
            ? `No players found matching "${search}"`
            : "No players on this leaderboard yet. Be the first!"}
        </div>
      )}

      {/* Data table */}
      {!isLoading && !error && filteredData.length > 0 && (
        <LeaderboardTable data={filteredData} pageSize={7} />
      )}
    </>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

type TabValue = "endless_voice" | "endless_keyboard" | "blitz_voice" | "blitz_keyboard"

export default function LeaderboardPage() {
  const [search, setSearch] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<TabValue>("endless_voice")

  // Parse tab value into mode and inputMethod
  const [mode, inputMethod] = React.useMemo((): [GameMode, InputMethod] => {
    const parts = activeTab.split("_")
    return [parts[0] as GameMode, parts[1] as InputMethod]
  }, [activeTab])

  // Clear search when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue)
    setSearch("")
  }

  return (
    <div className="relative flex-1">
      {/* Decorative background */}
      <HexPattern className="fixed inset-0 -z-10" />

      {/* Main content — Navbar is provided by (shell)/layout.tsx */}
      <main className="container mx-auto max-w-4xl px-6 py-8">
        {/* Game mode tabs */}
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="endless_voice" className="text-xs sm:text-sm">
              Endless Voice
            </TabsTrigger>
            <TabsTrigger value="endless_keyboard" className="text-xs sm:text-sm">
              Endless Keyboard
            </TabsTrigger>
            <TabsTrigger value="blitz_voice" className="text-xs sm:text-sm">
              Blitz Voice
            </TabsTrigger>
            <TabsTrigger value="blitz_keyboard" className="text-xs sm:text-sm">
              Blitz Keyboard
            </TabsTrigger>
          </TabsList>

          {/* Tab content - each track has its own content */}
          <TabsContent value="endless_voice" className="mt-6">
            <LeaderboardContent
              mode="endless"
              inputMethod="voice"
              search={search}
              onSearchChange={setSearch}
            />
          </TabsContent>
          <TabsContent value="endless_keyboard" className="mt-6">
            <LeaderboardContent
              mode="endless"
              inputMethod="keyboard"
              search={search}
              onSearchChange={setSearch}
            />
          </TabsContent>
          <TabsContent value="blitz_voice" className="mt-6">
            <LeaderboardContent
              mode="blitz"
              inputMethod="voice"
              search={search}
              onSearchChange={setSearch}
            />
          </TabsContent>
          <TabsContent value="blitz_keyboard" className="mt-6">
            <LeaderboardContent
              mode="blitz"
              inputMethod="keyboard"
              search={search}
              onSearchChange={setSearch}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
