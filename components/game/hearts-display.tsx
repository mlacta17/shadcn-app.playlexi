"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { HeartIcon } from "@/lib/icons"

/**
 * Design System Tokens
 *
 * Colors:
 * - Filled hearts use `--destructive` (red) via `fill-destructive stroke-destructive`
 * - Respects light/dark mode automatically through CSS variables
 *
 * Sizing:
 * - Hearts are 20px (size-5) per Figma design
 * - Gap between hearts is 2px (gap-0.5) per Figma design
 *
 * Animation:
 * - Loss animation: shake + fade out (respects prefers-reduced-motion)
 * - Duration: 300ms per STYLE_GUIDE.md micro-interaction guidelines
 */

export interface HeartsDisplayProps {
  /** Number of hearts remaining (0-3) */
  remaining: number
  /** Total number of hearts (default: 3) */
  total?: number
  /** Additional class names */
  className?: string
  /** Callback when heart loss animation completes */
  onHeartLost?: () => void
}

/**
 * Displays player's remaining lives as heart icons.
 *
 * This is a **presentational component** that shows hearts visually.
 * Game logic (when to decrement hearts) lives in the parent component or hook.
 *
 * ## Design System Compliance
 * - Uses `--destructive` color token for filled hearts
 * - 20px heart size, 2px gap (matches Figma)
 * - Follows `data-slot`, `data-state` attribute patterns
 * - Includes ARIA label for accessibility
 *
 * ## Architecture
 * Located in `components/game/` as a game-specific component.
 * While presentational (no hooks), it's domain-specific to PlayLexi.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <HeartsDisplay remaining={2} />
 *
 * // With animation callback
 * <HeartsDisplay
 *   remaining={hearts}
 *   onHeartLost={() => playSound('heart-lost')}
 * />
 * ```
 */
function HeartsDisplay({
  remaining,
  total = 3,
  className,
  onHeartLost,
}: HeartsDisplayProps) {
  const prevRemainingRef = React.useRef(remaining)
  const [animatingIndex, setAnimatingIndex] = React.useState<number | null>(null)

  // Detect heart loss and trigger animation
  React.useEffect(() => {
    if (remaining < prevRemainingRef.current) {
      // Heart was lost - animate the heart that's being removed
      const lostIndex = remaining // The index of the heart being removed (0-indexed)
      setAnimatingIndex(lostIndex)

      // Clear animation after it completes
      const timer = setTimeout(() => {
        setAnimatingIndex(null)
        onHeartLost?.()
      }, 300)

      prevRemainingRef.current = remaining
      return () => clearTimeout(timer)
    }
    prevRemainingRef.current = remaining
  }, [remaining, onHeartLost])

  // Clamp remaining to valid range
  const clampedRemaining = Math.max(0, Math.min(remaining, total))

  // Generate array of heart states
  const hearts = Array.from({ length: total }, (_, index) => {
    const isFilled = index < clampedRemaining
    const isAnimating = index === animatingIndex
    return { isFilled, isAnimating, index }
  })

  // Filter to only show filled hearts (per Figma design)
  const visibleHearts = hearts.filter(h => h.isFilled || h.isAnimating)

  return (
    <div
      data-slot="hearts-display"
      data-remaining={clampedRemaining}
      role="status"
      aria-live="polite"
      aria-label={`${clampedRemaining} of ${total} hearts remaining`}
      className={cn(
        "flex items-center gap-0.5",
        className
      )}
    >
      {visibleHearts.map(({ index, isAnimating }) => (
        <div
          key={index}
          data-slot="heart"
          data-state={isAnimating ? "losing" : "filled"}
          className={cn(
            "size-5 transition-all duration-300",
            isAnimating && "animate-heart-loss"
          )}
        >
          <HeartIcon
            className={cn(
              "size-5 fill-destructive stroke-destructive",
              // Ensure icon fills completely
              "[&>path]:fill-inherit [&>path]:stroke-inherit"
            )}
            aria-hidden="true"
          />
        </div>
      ))}

      {/* Empty state - show nothing when all hearts are lost */}
      {clampedRemaining === 0 && !animatingIndex && (
        <span className="sr-only">No hearts remaining</span>
      )}
    </div>
  )
}

export { HeartsDisplay }
