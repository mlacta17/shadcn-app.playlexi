import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "@/lib/icons"

/**
 * Pagination — Root container for pagination controls.
 *
 * Layout: `justify-between` per Figma design (node 2435:34161)
 * - Left: PaginationSummary (e.g., "1-7 of 120")
 * - Right: PaginationContent with controls
 *
 * @example
 * ```tsx
 * <Pagination>
 *   <PaginationSummary>1-7 of 120</PaginationSummary>
 *   <PaginationContent>
 *     <PaginationItem><PaginationPrevious /></PaginationItem>
 *     <PaginationItem><PaginationLink>1</PaginationLink></PaginationItem>
 *     <PaginationItem><PaginationNext /></PaginationItem>
 *   </PaginationContent>
 * </Pagination>
 * ```
 */
function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("flex w-full items-center justify-between", className)}
      {...props}
    />
  )
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("gap-1 flex items-center", className)}
      {...props}
    />
  )
}

/** Displays item count summary (e.g., "1-7 of 120"). */
function PaginationSummary({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="pagination-summary"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  isActive?: boolean
} & React.ComponentProps<typeof Button>

/**
 * Clickable page number button.
 *
 * Uses Button component directly for TanStack Table integration.
 * For URL-based pagination, wrap with Next.js Link using asChild.
 */
function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      variant={isActive ? "outline" : "ghost"}
      size={size}
      className={cn(className)}
      {...props}
    />
  )
}

/**
 * Previous page navigation button.
 *
 * Ghost variant (transparent) per Figma design.
 */
function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      aria-label="Go to previous page"
      variant="ghost"
      size="default"
      data-slot="pagination-previous"
      className={cn(className)}
      {...props}
    >
      <ChevronLeftIcon data-icon="inline-start" />
      <span>Previous</span>
    </Button>
  )
}

/**
 * Next page navigation button.
 *
 * Secondary variant (gray background) per Figma design.
 */
function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      aria-label="Go to next page"
      variant="secondary"
      size="default"
      data-slot="pagination-next"
      className={cn(className)}
      {...props}
    >
      <span>Next</span>
      <ChevronRightIcon data-icon="inline-end" />
    </Button>
  )
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "size-10 flex items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSummary,
}
