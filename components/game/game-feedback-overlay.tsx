"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Design System Tokens
 *
 * Colors:
 * - Correct: Green overlay using semantic success color
 * - Wrong: Red overlay using `--destructive` color
 *
 * Visual Behavior:
 * - Fixed position overlay covering entire viewport
 * - Flash animation: fade in quickly, hold briefly, fade out
 * - Semi-transparent to allow game UI to remain visible
 * - Respects prefers-reduced-motion
 *
 * Architecture:
 * - Presentational component (no hooks, no side effects)
 * - Use with useGameFeedback hook for state management
 * - Rendered at page/layout level, not inside game components
 */

/** Feedback types that can be displayed */
export type FeedbackOverlayType = "correct" | "wrong" | null

export interface GameFeedbackOverlayProps {
  /** Type of feedback to show */
  type: FeedbackOverlayType
  /** Whether the overlay is currently visible */
  isVisible: boolean
  /** Additional class names */
  className?: string
}

/**
 * Full-screen overlay for correct/wrong answer feedback.
 *
 * This is a **presentational component** that displays a colored flash overlay.
 * State and timing logic lives in the `useGameFeedback` hook.
 *
 * ## Design System Compliance
 * - Uses semantic colors: green for correct, `--destructive` for wrong
 * - 400ms flash animation (quick feedback)
 * - 20% opacity for visibility without obscuring game
 * - Follows `data-slot`, `data-state` attribute patterns
 * - Respects `prefers-reduced-motion`
 *
 * ## Placement
 * Render at the page or layout level, NOT inside other game components.
 * The overlay uses `position: fixed` to cover the entire viewport.
 *
 * ```tsx
 * // In your game page/layout
 * <GameFeedbackOverlay type={feedback.type} isVisible={feedback.isShowing} />
 * <GameTimer ... />
 * <SpeechInput ... />
 * ```
 *
 * ## Architecture
 * Located in `components/game/` as a game-specific component.
 * Follows the presentational + hook pattern:
 * - useGameFeedback owns state and timing
 * - GameFeedbackOverlay renders the visual
 *
 * @example
 * ```tsx
 * const feedback = useGameFeedback({
 *   onComplete: () => nextQuestion(),
 * })
 *
 * // In render
 * <GameFeedbackOverlay
 *   type={feedback.feedbackType}
 *   isVisible={feedback.isShowing}
 * />
 *
 * // Trigger feedback
 * <Button onClick={feedback.showCorrect}>Correct!</Button>
 * <Button onClick={feedback.showWrong}>Wrong!</Button>
 * ```
 */
function GameFeedbackOverlay({
  type,
  isVisible,
  className,
}: GameFeedbackOverlayProps) {
  // Don't render if not visible
  if (!isVisible || !type) {
    return null
  }

  return (
    <div
      data-slot="game-feedback-overlay"
      data-state={type}
      aria-hidden="true" // Decorative element
      className={cn(
        // Fixed positioning to cover viewport
        "pointer-events-none fixed inset-0 z-50",
        // Animation
        "animate-feedback-flash",
        // Color based on type - uses semantic tokens
        type === "correct" ? "bg-success-muted" : "bg-destructive/20",
        className
      )}
    />
  )
}

export { GameFeedbackOverlay }
