"use client"

import * as React from "react"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type Table as TanStackTable,
} from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * DataTable — Reusable TanStack Table wrapper.
 *
 * A generic data table component that handles rendering with TanStack React Table.
 * Built following the shadcn/ui data table pattern for consistency.
 *
 * ## Usage
 * ```tsx
 * // Define columns in a separate file (columns.tsx)
 * export const columns: ColumnDef<Payment>[] = [
 *   { accessorKey: "status", header: "Status" },
 *   { accessorKey: "amount", header: "Amount" },
 * ]
 *
 * // Use in page
 * <DataTable columns={columns} data={payments} />
 * ```
 *
 * @see https://ui.shadcn.com/docs/components/data-table
 */

export interface DataTableProps<TData, TValue> {
  /** Column definitions for the table */
  columns: ColumnDef<TData, TValue>[]
  /** Data to display in the table */
  data: TData[]
  /** Number of rows per page. Default: 10 */
  pageSize?: number
  /** Message when no data. Default: "No results." */
  emptyMessage?: string
  /** Additional class names for the table container */
  className?: string
  /** Render function for custom pagination controls */
  renderPagination?: (table: TanStackTable<TData>) => React.ReactNode
}

/**
 * Generic data table component with built-in pagination support.
 *
 * @typeParam TData - The type of data in each row
 * @typeParam TValue - The type of values in columns
 */
function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 10,
  emptyMessage = "No results.",
  className,
  renderPagination,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  })

  return (
    <div data-slot="data-table" className={cn("space-y-4", className)}>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={
                      header.column.getSize() !== 150
                        ? { width: header.column.getSize() }
                        : undefined
                    }
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      {renderPagination && renderPagination(table)}
    </div>
  )
}

export { DataTable }
