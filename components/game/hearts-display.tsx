"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { HeartIcon } from "@/lib/icons"

/**
 * Design System Tokens
 *
 * Colors:
 * - Filled hearts (active): `fill-destructive stroke-destructive` (full red)
 * - Lost hearts (disabled): Same colors with `opacity-50` (50% opacity)
 * - Follows destructive button pattern: active = full color, disabled = 50% opacity
 * - Respects light/dark mode automatically through CSS variables
 *
 * Sizing:
 * - Hearts are 20px (size-5) per Figma design
 * - Gap between hearts is 2px (gap-0.5) per Figma design
 *
 * Visual Behavior:
 * - All hearts are ALWAYS visible (total prop determines count)
 * - Filled hearts = active/remaining lives
 * - Lost hearts = disabled state with 50% opacity
 * - This provides clear visual feedback of "3 lives total, X remaining"
 *
 * Animation:
 * - Loss animation: shake + fade to 50% opacity (respects prefers-reduced-motion)
 * - Duration: 300ms per STYLE_GUIDE.md micro-interaction guidelines
 * - Defined in: app/globals.css (.animate-heart-loss)
 */

/** Animation duration in ms - must match CSS keyframe duration in globals.css */
const HEART_LOSS_ANIMATION_DURATION = 300

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
 * - Uses `--destructive` color token for all hearts
 * - Filled hearts: full opacity (active state)
 * - Lost hearts: 50% opacity (disabled state, like destructive button disabled)
 * - 20px heart size, 2px gap (matches Figma)
 * - Follows `data-slot`, `data-state` attribute patterns
 * - Includes ARIA label for accessibility
 *
 * ## Visual Behavior
 * All hearts are always visible. This shows players their total lives
 * and how many they've lost, rather than just remaining count.
 * - `data-state="filled"` = active heart (full opacity)
 * - `data-state="losing"` = currently animating out
 * - `data-state="lost"` = disabled heart (50% opacity)
 *
 * ## Architecture
 * Located in `components/game/` as a game-specific component.
 * While presentational (no hooks), it's domain-specific to PlayLexi.
 *
 * @example
 * ```tsx
 * // Basic usage - shows 2 filled + 1 lost heart
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
      }, HEART_LOSS_ANIMATION_DURATION)

      prevRemainingRef.current = remaining
      return () => clearTimeout(timer)
    }
    prevRemainingRef.current = remaining
  }, [remaining, onHeartLost])

  // Clamp remaining to valid range
  const clampedRemaining = Math.max(0, Math.min(remaining, total))

  // Generate array of heart states for ALL hearts (filled + lost)
  const hearts = Array.from({ length: total }, (_, index) => {
    const isFilled = index < clampedRemaining
    const isAnimating = index === animatingIndex
    const isLost = !isFilled && !isAnimating
    return { isFilled, isAnimating, isLost, index }
  })

  /**
   * Determine heart state for data-state attribute
   * - "filled": Active heart (remaining life)
   * - "losing": Currently animating (transitioning to lost)
   * - "lost": Disabled heart (50% opacity)
   */
  const getHeartState = (heart: { isFilled: boolean; isAnimating: boolean; isLost: boolean }) => {
    if (heart.isAnimating) return "losing"
    if (heart.isFilled) return "filled"
    return "lost"
  }

  return (
    <div
      data-slot="hearts-display"
      data-remaining={clampedRemaining}
      data-total={total}
      role="status"
      aria-live="polite"
      aria-label={`${clampedRemaining} of ${total} hearts remaining`}
      className={cn(
        "flex items-center gap-0.5",
        className
      )}
    >
      {hearts.map((heart) => {
        const state = getHeartState(heart)
        return (
          <div
            key={heart.index}
            data-slot="heart"
            data-state={state}
            className={cn(
              "size-5 transition-all duration-300",
              heart.isAnimating && "animate-heart-loss",
              // Lost hearts use 50% opacity (disabled state pattern)
              state === "lost" && "opacity-50"
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
        )
      })}
    </div>
  )
}

export { HeartsDisplay }
