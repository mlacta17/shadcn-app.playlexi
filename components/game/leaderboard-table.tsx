"use client"

import * as React from "react"
import { type Table as TanStackTable } from "@tanstack/react-table"

import { DataTable } from "@/components/ui/data-table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSummary,
} from "@/components/ui/pagination"
import {
  leaderboardColumns,
  type LeaderboardPlayer,
} from "./leaderboard-columns"

export interface LeaderboardTableProps {
  /** Array of player data to display */
  data: LeaderboardPlayer[]
  /** Number of rows per page. Default: 7 */
  pageSize?: number
  /** Additional class names */
  className?: string
}

/**
 * LeaderboardTable — Ranked player list with pagination.
 *
 * Displays player rankings with avatars, scores, and accuracy metrics.
 * Built on the reusable DataTable component following shadcn/ui patterns.
 *
 * ## Features
 * - Colored placement badges for top 3 (gold/silver/bronze)
 * - Player avatars with fallback initials
 * - Delta indicators for score changes (+/- in green/red)
 * - Built-in pagination with summary
 *
 * ## Architecture
 * - Uses `DataTable` component for TanStack Table integration
 * - Column definitions in `leaderboard-columns.tsx`
 * - Custom pagination controls with semantic styling
 *
 * ## Usage
 * ```tsx
 * import { LeaderboardTable } from "@/components/game"
 *
 * const players = [
 *   { id: "1", name: "Luffy", round: 11, delta: 1, accuracy: 99 },
 *   { id: "2", name: "Zoro", round: 10, delta: -1, accuracy: 98 },
 * ]
 *
 * <LeaderboardTable data={players} pageSize={7} />
 * ```
 *
 * @see Figma node 2435:33026 for design reference
 * @see https://ui.shadcn.com/docs/components/data-table
 */
function LeaderboardTable({
  data,
  pageSize = 7,
  className,
}: LeaderboardTableProps) {
  /**
   * Render pagination controls.
   *
   * Receives the TanStack Table instance to access pagination state and methods.
   */
  const renderPagination = React.useCallback(
    (table: TanStackTable<LeaderboardPlayer>) => {
      const { pageIndex, pageSize: currentPageSize } = table.getState().pagination
      const pageCount = table.getPageCount()
      const totalRows = data.length
      const startRow = pageIndex * currentPageSize + 1
      const endRow = Math.min((pageIndex + 1) * currentPageSize, totalRows)

      // Generate page numbers with ellipsis for overflow
      const getPageNumbers = (): (number | "ellipsis")[] => {
        const pages: (number | "ellipsis")[] = []
        const maxVisible = 3

        if (pageCount <= maxVisible + 2) {
          // Show all pages if few enough
          for (let i = 0; i < pageCount; i++) {
            pages.push(i)
          }
        } else {
          // Always show first page
          pages.push(0)

          if (pageIndex > 1) {
            pages.push("ellipsis")
          }

          // Show current page and neighbors
          const start = Math.max(1, pageIndex - 1)
          const end = Math.min(pageCount - 2, pageIndex + 1)

          for (let i = start; i <= end; i++) {
            if (!pages.includes(i)) pages.push(i)
          }

          if (pageIndex < pageCount - 2) {
            pages.push("ellipsis")
          }

          // Always show last page
          if (!pages.includes(pageCount - 1)) {
            pages.push(pageCount - 1)
          }
        }

        return pages
      }

      return (
        <Pagination>
          <PaginationSummary>
            {startRow}-{endRow} of {totalRows}
          </PaginationSummary>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              />
            </PaginationItem>
            {getPageNumbers().map((page, i) =>
              page === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={page}>
                  <PaginationLink
                    isActive={page === pageIndex}
                    onClick={() => table.setPageIndex(page)}
                  >
                    {page + 1}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )
    },
    [data.length]
  )

  return (
    <DataTable
      data-slot="leaderboard-table"
      columns={leaderboardColumns}
      data={data}
      pageSize={pageSize}
      emptyMessage="No players found."
      className={className}
      renderPagination={renderPagination}
    />
  )
}

// Re-export types and columns for convenience
export { LeaderboardTable }
export { leaderboardColumns, type LeaderboardPlayer } from "./leaderboard-columns"
