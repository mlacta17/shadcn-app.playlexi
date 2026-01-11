"use client"

import * as React from "react"

/** Feedback types that can be shown */
export type FeedbackType = "correct" | "wrong" | null

/** Animation duration in milliseconds - matches CSS animation */
export const FEEDBACK_ANIMATION_DURATION = 400

export interface UseGameFeedbackOptions {
  /** Callback when feedback animation completes */
  onComplete?: () => void
  /** Duration of the feedback flash in ms (default: 400) */
  duration?: number
}

export interface UseGameFeedbackReturn {
  /** Current feedback type being shown (null = none) */
  feedbackType: FeedbackType
  /** Whether feedback animation is currently playing */
  isShowing: boolean
  /** Trigger correct answer feedback */
  showCorrect: () => void
  /** Trigger wrong answer feedback */
  showWrong: () => void
  /** Manually clear feedback (usually not needed - auto-clears) */
  clear: () => void
}

/**
 * Hook for managing game feedback overlay state.
 *
 * This hook owns the feedback state and timing. The GameFeedbackOverlay
 * component is presentational and renders based on this hook's values.
 *
 * ## Architecture
 * ```
 * useGameFeedback (owns state + timing)
 *     │
 *     └── feedbackType, isShowing → GameFeedbackOverlay (presentational)
 * ```
 *
 * ## Features
 * - Auto-clears after animation duration
 * - Prevents overlapping feedback (new feedback replaces old)
 * - Callback on completion for chaining actions
 * - Memoized trigger functions
 *
 * ## Usage
 * ```tsx
 * function GameScreen() {
 *   const feedback = useGameFeedback({
 *     onComplete: () => moveToNextQuestion(),
 *   })
 *
 *   const handleAnswer = (isCorrect: boolean) => {
 *     if (isCorrect) {
 *       feedback.showCorrect()
 *     } else {
 *       feedback.showWrong()
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <GameFeedbackOverlay
 *         type={feedback.feedbackType}
 *         isVisible={feedback.isShowing}
 *       />
 *       <AnswerButton onClick={() => handleAnswer(true)} />
 *     </>
 *   )
 * }
 * ```
 *
 * @param options - Configuration options
 */
function useGameFeedback(
  options: UseGameFeedbackOptions = {}
): UseGameFeedbackReturn {
  const { onComplete, duration = FEEDBACK_ANIMATION_DURATION } = options

  const [feedbackType, setFeedbackType] = React.useState<FeedbackType>(null)
  const [isShowing, setIsShowing] = React.useState(false)

  // Refs for callbacks to avoid stale closures
  const onCompleteRef = React.useRef(onComplete)
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Keep ref updated
  React.useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Internal trigger function
  const triggerFeedback = React.useCallback(
    (type: "correct" | "wrong") => {
      // Clear any existing timeout (prevents race conditions)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Set feedback state
      setFeedbackType(type)
      setIsShowing(true)

      // Auto-clear after duration
      timeoutRef.current = setTimeout(() => {
        setIsShowing(false)
        setFeedbackType(null)
        onCompleteRef.current?.()
      }, duration)
    },
    [duration]
  )

  // Public trigger functions
  const showCorrect = React.useCallback(() => {
    triggerFeedback("correct")
  }, [triggerFeedback])

  const showWrong = React.useCallback(() => {
    triggerFeedback("wrong")
  }, [triggerFeedback])

  const clear = React.useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsShowing(false)
    setFeedbackType(null)
  }, [])

  // Memoize the return object to provide stable reference
  // This prevents unnecessary effect re-runs in consuming components
  return React.useMemo(
    () => ({
      feedbackType,
      isShowing,
      showCorrect,
      showWrong,
      clear,
    }),
    [feedbackType, isShowing, showCorrect, showWrong, clear]
  )
}

export { useGameFeedback }
