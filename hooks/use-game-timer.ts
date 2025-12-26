"use client"

import * as React from "react"

/**
 * Timer state type for the hook return value.
 * Matches the GameTimer component's data-state values.
 */
export type TimerState = "normal" | "critical"

/** Critical threshold in seconds - matches GameTimer component */
const CRITICAL_THRESHOLD_SECONDS = 5

export interface UseGameTimerOptions {
  /** Callback when timer reaches zero */
  onTimeUp?: () => void
  /** Callback on each tick (useful for sound effects at certain thresholds) */
  onTick?: (remainingSeconds: number) => void
  /** Override the critical threshold (default: 5 seconds) */
  criticalThreshold?: number
  /** Whether to auto-start the timer (default: false) */
  autoStart?: boolean
}

export interface UseGameTimerReturn {
  /** Total time for this timer instance in seconds */
  totalSeconds: number
  /** Current remaining time in seconds */
  remainingSeconds: number
  /** Current timer state based on remaining time */
  state: TimerState
  /** Whether the timer is currently running */
  isRunning: boolean
  /** Whether the timer has reached zero */
  isExpired: boolean
  /** Start or resume the timer */
  start: () => void
  /** Pause the timer */
  pause: () => void
  /** Reset the timer to initial duration */
  reset: () => void
  /** Reset and immediately start with a new duration */
  restart: (newDuration?: number) => void
}

/**
 * Hook for managing countdown timer state.
 *
 * This hook owns the timer logic and provides all values needed by GameTimer.
 * Follows the same pattern as useVoiceRecorder: hook owns logic, component is presentational.
 *
 * ## Architecture
 * ```
 * useGameTimer (owns countdown logic)
 *     │
 *     └── All values → GameTimer (presentational)
 * ```
 *
 * ## Features
 * - Countdown from specified duration to zero
 * - Pause/resume functionality
 * - Reset to original or new duration
 * - Callbacks for time-up and tick events
 * - Automatic state calculation (normal/critical)
 *
 * ## Usage
 * ```tsx
 * function GameScreen() {
 *   const timer = useGameTimer(15, {
 *     onTimeUp: () => handleWrongAnswer(),
 *     autoStart: true,
 *   })
 *
 *   return (
 *     <GameTimer
 *       totalSeconds={timer.totalSeconds}
 *       remainingSeconds={timer.remainingSeconds}
 *     />
 *   )
 * }
 * ```
 *
 * @param initialSeconds - Starting duration in seconds
 * @param options - Configuration options
 */
function useGameTimer(
  initialSeconds: number,
  options: UseGameTimerOptions = {}
): UseGameTimerReturn {
  const {
    onTimeUp,
    onTick,
    criticalThreshold = CRITICAL_THRESHOLD_SECONDS,
    autoStart = false,
  } = options

  // Store initial duration for reset functionality
  const [totalSeconds, setTotalSeconds] = React.useState(initialSeconds)
  const [remainingSeconds, setRemainingSeconds] = React.useState(initialSeconds)
  const [isRunning, setIsRunning] = React.useState(autoStart)

  // Refs for callbacks to avoid stale closures
  const onTimeUpRef = React.useRef(onTimeUp)
  const onTickRef = React.useRef(onTick)

  // Keep refs updated
  React.useEffect(() => {
    onTimeUpRef.current = onTimeUp
    onTickRef.current = onTick
  }, [onTimeUp, onTick])

  // Derived state
  const isExpired = remainingSeconds <= 0
  const state: TimerState = remainingSeconds <= criticalThreshold ? "critical" : "normal"

  // Main countdown effect
  React.useEffect(() => {
    if (!isRunning || isExpired) return

    const intervalId = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = Math.max(0, prev - 1)

        // Fire tick callback
        onTickRef.current?.(next)

        // Fire time-up callback when reaching zero
        if (next === 0) {
          onTimeUpRef.current?.()
        }

        return next
      })
    }, 1000)

    return () => clearInterval(intervalId)
  }, [isRunning, isExpired])

  // Stop running when expired
  React.useEffect(() => {
    if (isExpired && isRunning) {
      setIsRunning(false)
    }
  }, [isExpired, isRunning])

  // Control functions
  const start = React.useCallback(() => {
    if (!isExpired) {
      setIsRunning(true)
    }
  }, [isExpired])

  const pause = React.useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = React.useCallback(() => {
    setIsRunning(false)
    setRemainingSeconds(totalSeconds)
  }, [totalSeconds])

  const restart = React.useCallback((newDuration?: number) => {
    const duration = newDuration ?? totalSeconds
    if (newDuration !== undefined) {
      setTotalSeconds(newDuration)
    }
    setRemainingSeconds(duration)
    setIsRunning(true)
  }, [totalSeconds])

  return {
    totalSeconds,
    remainingSeconds,
    state,
    isRunning,
    isExpired,
    start,
    pause,
    reset,
    restart,
  }
}

export { useGameTimer }
