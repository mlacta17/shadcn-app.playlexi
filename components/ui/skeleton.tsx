import { cn } from "@/lib/utils"

/**
 * Skeleton loading placeholder component.
 *
 * Used to show a loading state while content is being fetched.
 * Displays an animated pulsing effect to indicate loading.
 *
 * @example
 * ```tsx
 * // Text placeholder
 * <Skeleton className="h-4 w-[200px]" />
 *
 * // Avatar placeholder
 * <Skeleton className="h-12 w-12 rounded-full" />
 *
 * // Card placeholder
 * <div className="space-y-2">
 *   <Skeleton className="h-4 w-full" />
 *   <Skeleton className="h-4 w-3/4" />
 * </div>
 * ```
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
