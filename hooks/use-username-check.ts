"use client"

import * as React from "react"
import { validateUsernameFormat, USERNAME_MIN_LENGTH } from "@/lib/username-utils"

// =============================================================================
// TYPES
// =============================================================================

export type UsernameStatus =
  | "idle" // No input yet
  | "typing" // User is typing (debounce pending)
  | "checking" // API call in progress
  | "available" // Username is available
  | "taken" // Username is taken
  | "invalid" // Format validation failed

export interface UseUsernameCheckReturn {
  /** Current validation status */
  status: UsernameStatus
  /** Error message (for invalid or taken) */
  error: string | null
  /** Check a username (debounced internally) */
  checkUsername: (username: string) => void
  /** Reset to idle state */
  reset: () => void
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Debounce delay for API calls (ms) */
const DEBOUNCE_DELAY = 400

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for checking username availability with debouncing.
 *
 * ## Flow
 * 1. User types → Instant format validation
 * 2. If format valid → Wait for typing pause (debounce)
 * 3. After pause → API call to check uniqueness
 * 4. Show result (available/taken/error)
 *
 * @example
 * ```tsx
 * function UsernameInput() {
 *   const { status, error, checkUsername } = useUsernameCheck()
 *
 *   return (
 *     <div>
 *       <Input
 *         onChange={(e) => checkUsername(e.target.value)}
 *         aria-invalid={status === "invalid" || status === "taken"}
 *       />
 *       {status === "checking" && <span>Checking...</span>}
 *       {status === "available" && <span className="text-green-600">Available!</span>}
 *       {error && <span className="text-red-600">{error}</span>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useUsernameCheck(): UseUsernameCheckReturn {
  const [status, setStatus] = React.useState<UsernameStatus>("idle")
  const [error, setError] = React.useState<string | null>(null)

  // Refs for cleanup
  const debounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  /**
   * Cleanup function to cancel pending operations.
   */
  const cleanup = React.useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
      debounceTimeoutRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  /**
   * Reset to idle state.
   */
  const reset = React.useCallback(() => {
    cleanup()
    setStatus("idle")
    setError(null)
  }, [cleanup])

  /**
   * Check username availability.
   */
  const checkUsername = React.useCallback(
    (username: string) => {
      // Cancel any pending operations
      cleanup()

      const trimmed = username.trim()

      // Empty input → idle
      if (trimmed.length === 0) {
        setStatus("idle")
        setError(null)
        return
      }

      // Too short → show typing state (don't show error until min length)
      if (trimmed.length < USERNAME_MIN_LENGTH) {
        setStatus("typing")
        setError(null)
        return
      }

      // Validate format first (instant)
      const formatResult = validateUsernameFormat(trimmed)
      if (!formatResult.isValid) {
        setStatus("invalid")
        setError(formatResult.error)
        return
      }

      // Format is valid → start debounce for API check
      setStatus("typing")
      setError(null)

      debounceTimeoutRef.current = setTimeout(async () => {
        setStatus("checking")

        // Create abort controller for this request
        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
          const response = await fetch(
            `/api/users/check-username?username=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal }
          )

          // Check if request was aborted
          if (controller.signal.aborted) return

          const data = (await response.json()) as {
            available: boolean
            reason?: "taken" | "invalid"
            error?: string
          }

          if (data.available) {
            setStatus("available")
            setError(null)
          } else if (data.reason === "taken") {
            setStatus("taken")
            setError("This username is already taken")
          } else if (data.reason === "invalid") {
            setStatus("invalid")
            setError(data.error ?? "Invalid username format")
          } else {
            // Unexpected error
            setStatus("invalid")
            setError(data.error ?? "Unable to check username")
          }
        } catch (err) {
          // Ignore abort errors
          if (err instanceof Error && err.name === "AbortError") return

          // Network or other error
          console.error("[useUsernameCheck] Error:", err)
          setStatus("invalid")
          setError("Unable to check username. Please try again.")
        }
      }, DEBOUNCE_DELAY)
    },
    [cleanup]
  )

  // Cleanup on unmount
  React.useEffect(() => {
    return cleanup
  }, [cleanup])

  return {
    status,
    error,
    checkUsername,
    reset,
  }
}
