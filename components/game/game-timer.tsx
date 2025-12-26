"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

/**
 * Design System Tokens
 *
 * Colors (uses existing semantic colors):
 * - Normal state: `--primary` (yellow/amber) - default, plenty of time
 * - Critical state: `--destructive` (red) - urgency, ≤5 seconds remaining
 *
 * Sizing:
 * - Height: 8px (h-2) per Figma design
 * - Width: Full width of parent container
 * - Border radius: Inherits from Progress component (rounded-4xl)
 *
 * Visual Behavior:
 * - Progress bar fills from left to right (100% = full time, 0% = time's up)
 * - Color transitions smoothly when entering critical state
 * - Respects light/dark mode automatically through CSS variables
 *
 * Architecture:
 * - Presentational component (no hooks, no side effects)
 * - Wraps shadcn Progress component (wrapper pattern per COMPONENT_INVENTORY.md)
 * - Use with useGameTimer hook for countdown logic
 */

/** Critical threshold in seconds - bar turns red at this point */
const CRITICAL_THRESHOLD_SECONDS = 5

export type GameTimerState = "normal" | "critical"

export interface GameTimerProps {
  /** Total time for this round in seconds */
  totalSeconds: number
  /** Remaining time in seconds */
  remainingSeconds: number
  /** Additional class names */
  className?: string
  /** Override the critical threshold (default: 5 seconds) */
  criticalThreshold?: number
}

/**
 * Countdown timer progress bar for game rounds.
 *
 * This is a **presentational component** that displays time remaining visually.
 * Countdown logic (interval, pause/resume) lives in the `useGameTimer` hook.
 *
 * ## Design System Compliance
 * - Uses `--primary` for normal state (yellow/amber)
 * - Uses `--destructive` for critical state (red, ≤5 seconds)
 * - 8px height per Figma design
 * - Wraps shadcn Progress component (no modifications to shadcn)
 * - Follows `data-slot`, `data-state` attribute patterns
 * - Includes ARIA attributes for accessibility
 *
 * ## Visual Behavior
 * - Bar decreases from right to left as time runs out
 * - Transitions to red color when ≤5 seconds remain
 * - Smooth color transition for visual continuity
 *
 * ## Architecture
 * Located in `components/game/` as a game-specific wrapper component.
 * Follows the "wrapper pattern" documented in COMPONENT_INVENTORY.md:
 * - Progress component stays generic and reusable
 * - GameTimer adds domain-specific logic (state calculation, ARIA labels)
 *
 * @example
 * ```tsx
 * // Basic usage with useGameTimer hook
 * const { totalSeconds, remainingSeconds } = useGameTimer(15)
 *
 * <GameTimer
 *   totalSeconds={totalSeconds}
 *   remainingSeconds={remainingSeconds}
 * />
 *
 * // Manual control (for demos/testing)
 * <GameTimer totalSeconds={30} remainingSeconds={10} />
 * ```
 */
function GameTimer({
  totalSeconds,
  remainingSeconds,
  className,
  criticalThreshold = CRITICAL_THRESHOLD_SECONDS,
}: GameTimerProps) {
  // Calculate percentage (0-100) for progress bar
  // Clamp to valid range to prevent visual glitches
  const percentage = Math.max(0, Math.min(100, (remainingSeconds / totalSeconds) * 100))

  // Determine visual state based on remaining time
  const state: GameTimerState = remainingSeconds <= criticalThreshold ? "critical" : "normal"

  // Format time for screen readers (e.g., "10 seconds remaining")
  const ariaLabel = `${Math.ceil(remainingSeconds)} second${Math.ceil(remainingSeconds) !== 1 ? "s" : ""} remaining`

  return (
    <div
      data-slot="game-timer"
      data-state={state}
      data-remaining={Math.ceil(remainingSeconds)}
      data-total={totalSeconds}
      role="timer"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cn("w-full", className)}
    >
      <Progress
        value={percentage}
        className={cn(
          "h-2 transition-colors duration-300",
          // Override indicator color based on state
          // Uses CSS custom property approach for cleaner state management
          "[&>[data-slot=progress-indicator]]:transition-colors",
          "[&>[data-slot=progress-indicator]]:duration-300",
          state === "critical"
            ? "[&>[data-slot=progress-indicator]]:bg-destructive"
            : "[&>[data-slot=progress-indicator]]:bg-primary"
        )}
        aria-hidden="true" // Parent div handles accessibility
      />
    </div>
  )
}

export { GameTimer, CRITICAL_THRESHOLD_SECONDS }
