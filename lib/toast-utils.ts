/**
 * Toast Utilities — PlayLexi
 *
 * Centralized toast notifications for consistent UX across the app.
 * Built on Sonner, styled to match shadcn's radix-nova design.
 *
 * ## Usage
 *
 * ```typescript
 * import { showErrorToast, showSuccessToast, showLoadingToast } from "@/lib/toast-utils"
 *
 * // Simple error (title only)
 * showErrorToast("Failed to save game")
 *
 * // Error with description (title + description)
 * showErrorToast("Can't connect", {
 *   description: "Please check your internet connection and try again."
 * })
 *
 * // Error with retry action
 * showErrorToast("Couldn't load word", {
 *   description: "Something went wrong on our end.",
 *   action: {
 *     label: "Retry",
 *     onClick: () => refetch()
 *   }
 * })
 *
 * // Using FriendlyError from error-messages.ts
 * const friendly = toFriendlyError(error)
 * showErrorToast(friendly.title, {
 *   description: friendly.description,
 *   action: friendly.canRetry ? {
 *     label: friendly.actionLabel,
 *     onClick: () => retry()
 *   } : undefined
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
 * 2. **Dismissible**: Users can swipe to dismiss
 * 3. **Title + Description**: Use description for longer context
 * 4. **Action-oriented**: Error toasts can include retry buttons
 * 5. **Accessible**: Screen reader announcements via aria-live
 *
 * @see components/ui/sonner.tsx for toast styling
 * @see lib/error-messages.ts for FriendlyError with title/description
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
  /** Additional description text shown below the title */
  description?: string
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
 * @param title - Short error title to display
 * @param options - Optional toast configuration (including description)
 * @returns Toast ID for programmatic control
 *
 * @example
 * ```typescript
 * // Simple error (title only)
 * showErrorToast("Failed to load word")
 *
 * // Error with description
 * showErrorToast("Can't connect", {
 *   description: "Please check your internet connection."
 * })
 *
 * // Error with description and retry action
 * showErrorToast("Connection lost", {
 *   description: "We couldn't reach the server.",
 *   action: {
 *     label: "Retry",
 *     onClick: () => reconnect()
 *   }
 * })
 * ```
 */
export function showErrorToast(
  title: string,
  options?: ToastOptions
): string | number {
  return toast.error(title, {
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
 * @param title - Short success title to display
 * @param options - Optional toast configuration (including description)
 * @returns Toast ID for programmatic control
 *
 * @example
 * ```typescript
 * showSuccessToast("Game saved!")
 * showSuccessToast("Profile updated", {
 *   description: "Your changes have been saved.",
 *   duration: 2000
 * })
 * ```
 */
export function showSuccessToast(
  title: string,
  options?: ToastOptions
): string | number {
  return toast.success(title, {
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
 * @param title - Short info title to display
 * @param options - Optional toast configuration (including description)
 * @returns Toast ID for programmatic control
 */
export function showInfoToast(
  title: string,
  options?: ToastOptions
): string | number {
  return toast.info(title, {
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
 * @param title - Short warning title to display
 * @param options - Optional toast configuration (including description)
 * @returns Toast ID for programmatic control
 */
export function showWarningToast(
  title: string,
  options?: ToastOptions
): string | number {
  return toast.warning(title, {
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
 * @param title - Loading title to display
 * @param options - Optional toast configuration (including description)
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
  title: string,
  options?: ToastOptions
): string | number {
  return toast.loading(title, {
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
