"use client"

import { type ColumnDef } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { PlayerAvatar } from "@/components/ui/player-avatar"
import { Badge } from "@/components/ui/badge"

/**
 * Player data for leaderboard display.
 */
export interface LeaderboardPlayer {
  /** Unique identifier */
  id: string
  /** Display name or email */
  name: string
  /** Secondary text (bio, email, etc.) */
  description?: string
  /** PlayLexi avatar ID (1=dog, 2=person, 3=cat) */
  avatarId?: number
  /** Current round/score */
  round: number
  /** Change from previous position (+/-) */
  delta?: number
  /** Accuracy percentage (0-100) */
  accuracy: number
  /** Points earned (optional - displays "-" if not provided) */
  points?: number
}

/**
 * Get the Badge variant for a given rank position.
 *
 * Per Figma design (node 2599:5079):
 * - 1st place: gold variant
 * - 2nd place: silver variant
 * - 3rd place: bronze variant
 * - 4th place onwards: secondary variant (gray)
 *
 * All ranks use the Badge component for consistent visual alignment.
 */
function getRankVariant(rank: number): "gold" | "silver" | "bronze" | "secondary" {
  switch (rank) {
    case 1:
      return "gold"
    case 2:
      return "silver"
    case 3:
      return "bronze"
    default:
      return "secondary"
  }
}

/**
 * PlayerCell — Avatar with name and description.
 *
 * Uses PlayerAvatar for PlayLexi character display.
 */
interface PlayerCellProps {
  name: string
  description?: string
  avatarId?: number
}

function PlayerCell({ name, description, avatarId }: PlayerCellProps) {
  // Get initials for fallback
  const initials = name
    .split(/[@\s]/) // Split on @ or space for emails
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div data-slot="player-cell" className="flex items-center gap-3">
      <PlayerAvatar
        avatarId={avatarId}
        fallbackInitials={initials}
        size="lg"
      />
      <div className="flex flex-col">
        <span className="font-medium text-foreground">{name}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
    </div>
  )
}

/**
 * RoundCell — Score with delta indicator.
 *
 * Shows positive deltas in green, negative in destructive red.
 * Uses semantic colors from the design system.
 */
interface RoundCellProps {
  round: number
  delta?: number
}

function RoundCell({ round, delta }: RoundCellProps) {
  return (
    <div data-slot="round-cell" className="flex items-center gap-1">
      <span>{round}</span>
      {delta !== undefined && delta !== 0 && (
        <span
          className={cn(
            "text-sm",
            delta > 0 ? "text-success" : "text-destructive"
          )}
        >
          ({delta > 0 ? "+" : ""}
          {delta})
        </span>
      )}
    </div>
  )
}

/**
 * PointsCell — Formatted points display.
 *
 * Displays points with locale-aware formatting (e.g., 15,420).
 * Shows "-" placeholder when points are not available.
 */
interface PointsCellProps {
  points?: number
}

function PointsCell({ points }: PointsCellProps) {
  return (
    <span data-slot="points-cell">
      {points !== undefined ? points.toLocaleString() : "-"}
    </span>
  )
}

/**
 * Column definitions for the leaderboard table.
 *
 * Following shadcn/ui data table pattern:
 * - Columns defined separately from component
 * - Use custom cell renderers for complex displays
 * - Column sizes specified for layout control
 *
 * @see https://ui.shadcn.com/docs/components/data-table
 */
export const leaderboardColumns: ColumnDef<LeaderboardPlayer>[] = [
  {
    id: "rank",
    header: "Rank",
    cell: ({ row }) => {
      const rank = row.index + 1
      return (
        <Badge variant={getRankVariant(rank)}>
          {rank}
        </Badge>
      )
    },
    size: 80,
  },
  {
    accessorKey: "name",
    header: "Player",
    cell: ({ row }) => (
      <PlayerCell
        name={row.original.name}
        description={row.original.description}
        avatarId={row.original.avatarId}
      />
    ),
  },
  {
    accessorKey: "round",
    header: "Round",
    cell: ({ row }) => (
      <RoundCell round={row.original.round} delta={row.original.delta} />
    ),
    size: 100,
  },
  {
    accessorKey: "accuracy",
    header: "Accuracy",
    cell: ({ row }) => <span>{row.original.accuracy}%</span>,
    size: 100,
  },
  {
    accessorKey: "points",
    header: "Points",
    cell: ({ row }) => <PointsCell points={row.original.points} />,
    size: 100,
  },
]

export { PlayerCell, RoundCell, PointsCell }
