/**
 * Toast Utilities — PlayLexi
 *
 * Centralized toast notifications for consistent UX across the app.
 * Built on Sonner, styled to match PlayLexi's design system.
 *
 * ## Usage
 *
 * ```typescript
 * import { showErrorToast, showSuccessToast, showLoadingToast } from "@/lib/toast-utils"
 *
 * // Simple error
 * showErrorToast("Failed to save game")
 *
 * // Error with retry action
 * showErrorToast("Couldn't load word", {
 *   action: {
 *     label: "Retry",
 *     onClick: () => refetch()
 *   }
 * })
 *
 * // Success toast
 * showSuccessToast("Game saved!")
 *
 * // Loading toast that updates
 * const toastId = showLoadingToast("Saving game...")
 * // Later:
 * toast.success("Saved!", { id: toastId })
 * ```
 *
 * ## Design Decisions
 *
 * 1. **Non-blocking**: Toasts don't interrupt gameplay
 * 2. **Dismissible**: Users can swipe/click to dismiss
 * 3. **Action-oriented**: Error toasts can include retry buttons
 * 4. **Accessible**: Screen reader announcements via aria-live
 *
 * @see components/ui/sonner.tsx for toast styling
 * @see https://sonner.emilkowal.ski for full API
 */

import { toast, type ExternalToast } from "sonner"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for toast notifications.
 * Extends Sonner's ExternalToast type with PlayLexi-specific options.
 */
export interface ToastOptions extends ExternalToast {
  /** Action button configuration */
  action?: {
    label: string
    onClick: () => void
  }
}

// =============================================================================
// TOAST FUNCTIONS
// =============================================================================

/**
 * Show an error toast notification.
 *
 * Use for:
 * - API failures
 * - Validation errors
 * - Network issues
 *
 * @param message - Error message to display
 * @param options - Optional toast configuration
 * @returns Toast ID for programmatic control
 *
 * @example
 * ```typescript
 * // Simple error
 * showErrorToast("Failed to load word")
 *
 * // With retry action
 * showErrorToast("Connection lost", {
 *   action: {
 *     label: "Retry",
 *     onClick: () => reconnect()
 *   }
 * })
 * ```
 */
export function showErrorToast(
  message: string,
  options?: ToastOptions
): string | number {
  return toast.error(message, {
    duration: 5000, // Longer for errors so users can read
    ...options,
  })
}

/**
 * Show a success toast notification.
 *
 * Use for:
 * - Successful saves
 * - Completed actions
 * - Positive feedback
 *
 * @param message - Success message to display
 * @param options - Optional toast configuration
 * @returns Toast ID for programmatic control
 *
 * @example
 * ```typescript
 * showSuccessToast("Game saved!")
 * showSuccessToast("Profile updated", { duration: 2000 })
 * ```
 */
export function showSuccessToast(
  message: string,
  options?: ToastOptions
): string | number {
  return toast.success(message, {
    duration: 3000,
    ...options,
  })
}

/**
 * Show an info toast notification.
 *
 * Use for:
 * - Helpful tips
 * - Status updates
 * - Non-critical information
 *
 * @param message - Info message to display
 * @param options - Optional toast configuration
 * @returns Toast ID for programmatic control
 */
export function showInfoToast(
  message: string,
  options?: ToastOptions
): string | number {
  return toast.info(message, {
    duration: 4000,
    ...options,
  })
}

/**
 * Show a warning toast notification.
 *
 * Use for:
 * - Degraded functionality
 * - Approaching limits
 * - Non-fatal issues
 *
 * @param message - Warning message to display
 * @param options - Optional toast configuration
 * @returns Toast ID for programmatic control
 */
export function showWarningToast(
  message: string,
  options?: ToastOptions
): string | number {
  return toast.warning(message, {
    duration: 4000,
    ...options,
  })
}

/**
 * Show a loading toast notification.
 *
 * Returns a toast ID that can be used to update the toast when
 * the operation completes (success or error).
 *
 * @param message - Loading message to display
 * @param options - Optional toast configuration
 * @returns Toast ID for updating the toast later
 *
 * @example
 * ```typescript
 * const toastId = showLoadingToast("Saving game...")
 *
 * try {
 *   await saveGame()
 *   toast.success("Game saved!", { id: toastId })
 * } catch {
 *   toast.error("Failed to save", { id: toastId })
 * }
 * ```
 */
export function showLoadingToast(
  message: string,
  options?: ToastOptions
): string | number {
  return toast.loading(message, {
    duration: Infinity, // Loading toasts don't auto-dismiss
    ...options,
  })
}

/**
 * Dismiss a specific toast by ID.
 *
 * @param toastId - The toast ID returned from show* functions
 */
export function dismissToast(toastId: string | number): void {
  toast.dismiss(toastId)
}

/**
 * Dismiss all toasts.
 */
export function dismissAllToasts(): void {
  toast.dismiss()
}

/**
 * Promise-based toast that shows loading, then success or error.
 *
 * Automatically handles the full lifecycle of an async operation.
 *
 * @param promise - The promise to track
 * @param messages - Messages for each state
 * @returns The original promise result
 *
 * @example
 * ```typescript
 * const result = await toastPromise(
 *   saveGameResults(gameData),
 *   {
 *     loading: "Saving game...",
 *     success: "Game saved!",
 *     error: "Failed to save game"
 *   }
 * )
 * ```
 */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string
    success: string
    error: string
  }
): Promise<T> {
  toast.promise(promise, messages)
  return promise
}

// Re-export toast for direct access when needed
export { toast }
