"use client"

import { type ColumnDef } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
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
  /** Avatar image URL */
  avatarUrl?: string
  /** Current round/score */
  round: number
  /** Change from previous position (+/-) */
  delta?: number
  /** Accuracy percentage (0-100) */
  accuracy: number
}

/**
 * Variant mapping for placement badges.
 * Maps rank position to Badge variant.
 */
const PLACEMENT_VARIANTS = {
  1: "gold",
  2: "silver",
  3: "bronze",
} as const

/**
 * PlayerCell — Avatar with name and description.
 *
 * Follows Avatar component patterns from the design system.
 */
interface PlayerCellProps {
  name: string
  description?: string
  avatarUrl?: string
}

function PlayerCell({ name, description, avatarUrl }: PlayerCellProps) {
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
      <Avatar size="lg">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
        <AvatarFallback>{initials || "?"}</AvatarFallback>
      </Avatar>
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
            delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
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
      if (rank <= 3) {
        return (
          <Badge variant={PLACEMENT_VARIANTS[rank as 1 | 2 | 3]}>
            {rank}
          </Badge>
        )
      }
      return <span className="text-muted-foreground">{rank}</span>
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
        avatarUrl={row.original.avatarUrl}
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
]

export { PlayerCell, RoundCell }
