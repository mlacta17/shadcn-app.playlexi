"use client"

import * as React from "react"
import { FilterIcon } from "@/lib/icons"

import { RankBadge, LeaderboardTable, type LeaderboardPlayer } from "@/components/game"
import { HexPattern } from "@/components/ui/hex-pattern"
import { Progress } from "@/components/ui/progress"
import { SearchInput } from "@/components/ui/search-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Leaderboard Page — Ranked player standings.
 *
 * Displays player rankings across different game modes (Endless, Multiplayer, Blitz)
 * with search, filtering, and pagination capabilities.
 *
 * ## Features
 * - League badge with rank progress
 * - Game mode tabs
 * - Player search
 * - Filter dropdown
 * - Paginated results
 *
 * @see Figma node 2435:33026 for design reference
 */

// Mock data for demonstration
const MOCK_PLAYERS: LeaderboardPlayer[] = [
  { id: "1", name: "Luffy", description: "Description Text", round: 11, delta: 1, accuracy: 99, points: 15420 },
  { id: "2", name: "felicia.reid@example.com", description: "Description Text", round: 10, delta: -1, accuracy: 99, points: 14850 },
  { id: "3", name: "georgia.young@example.com", description: "Description Text", round: 9, delta: -1, accuracy: 99, points: 14200 },
  { id: "4", name: "alma.lawson@example.com", description: "Description Text", round: 8, delta: 1, accuracy: 99, points: 13500 },
  { id: "5", name: "dolores.chambers@example.com", description: "Description Text", round: 7, delta: -1, accuracy: 99, points: 12900 },
  { id: "6", name: "alma.lawson@example.com", description: "Description Text", round: 6, delta: -1, accuracy: 99, points: 12100 },
  { id: "7", name: "dolores.chambers@example.com", description: "Description Text", round: 5, delta: 1, accuracy: 99, points: 11500 },
  // Additional mock data for pagination
  { id: "8", name: "player8@example.com", description: "Description Text", round: 4, delta: 0, accuracy: 98, points: 10800 },
  { id: "9", name: "player9@example.com", description: "Description Text", round: 3, delta: 2, accuracy: 97, points: 10200 },
  { id: "10", name: "player10@example.com", description: "Description Text", round: 2, delta: -2, accuracy: 96, points: 9500 },
]

// Generate more mock data
const EXTENDED_MOCK_PLAYERS: LeaderboardPlayer[] = [
  ...MOCK_PLAYERS,
  ...Array.from({ length: 110 }, (_, i) => ({
    id: `${i + 11}`,
    name: `player${i + 11}@example.com`,
    description: "Description Text",
    round: Math.max(1, 100 - i),
    delta: Math.random() > 0.5 ? 1 : -1,
    accuracy: Math.floor(Math.random() * 10) + 90,
    points: Math.max(100, 9000 - i * 80),
  })),
]

type GameMode = "endless" | "multiplayer" | "blitz"

export default function LeaderboardPage() {
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<string>("all")
  const [activeTab, setActiveTab] = React.useState<GameMode>("endless")

  // Filter players based on search
  const filteredPlayers = React.useMemo(() => {
    return EXTENDED_MOCK_PLAYERS.filter((player) =>
      player.name.toLowerCase().includes(search.toLowerCase())
    )
  }, [search])

  // TODO: Connect to actual rank from user state
  const currentRank = "new-bee" as const
  const rankRating = 57
  const maxRating = 100

  return (
    <div className="relative flex-1">
      {/* Decorative background */}
      <HexPattern className="fixed inset-0 -z-10" />

      {/* Main content — Navbar is provided by (shell)/layout.tsx */}
      <main className="container mx-auto max-w-4xl px-6 py-8">
        {/* League header */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <RankBadge rank={currentRank} size="lg" />
          <h1 className="text-xl font-bold">Bronze League</h1>
          <div className="w-full max-w-xs space-y-2">
            <Progress value={(rankRating / maxRating) * 100} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>RANK RATING</span>
              <span>
                {rankRating}/{maxRating}
              </span>
            </div>
          </div>
        </div>

        {/* Game mode tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as GameMode)}
          className="w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="endless" className="flex-1">
              Endless
            </TabsTrigger>
            <TabsTrigger value="multiplayer" className="flex-1">
              Multiplayer
            </TabsTrigger>
            <TabsTrigger value="blitz" className="flex-1">
              Blitz
            </TabsTrigger>
          </TabsList>

          {/* Search and filter row */}
          <div className="mt-6 flex items-center gap-4">
            <SearchInput
              placeholder="Search players"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              containerClassName="flex-1"
            />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-auto">
                <FilterIcon className="size-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Players</SelectItem>
                <SelectItem value="friends">Friends Only</SelectItem>
                <SelectItem value="region">My Region</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tab content - all share the same table for now */}
          <TabsContent value="endless" className="mt-6">
            <LeaderboardTable data={filteredPlayers} pageSize={7} />
          </TabsContent>
          <TabsContent value="multiplayer" className="mt-6">
            <LeaderboardTable data={filteredPlayers} pageSize={7} />
          </TabsContent>
          <TabsContent value="blitz" className="mt-6">
            <LeaderboardTable data={filteredPlayers} pageSize={7} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
