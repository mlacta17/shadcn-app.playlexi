"use client"

import * as React from "react"

/**
 * Hook to get the current user ID for phonetic learning.
 *
 * ## Current Behavior (No Auth)
 *
 * Returns an anonymous device ID stored in localStorage. This allows:
 * - Recognition logging to work immediately
 * - Data to persist across sessions on the same device
 * - Future migration to authenticated user IDs
 *
 * ## Future Behavior (With Auth)
 *
 * When authentication is integrated, this hook should:
 * 1. Check for authenticated user first
 * 2. Fall back to device ID for anonymous users
 * 3. Optionally merge device data into user account on sign-up
 *
 * ## Storage Key
 *
 * Uses `playlexi_device_id` in localStorage. The ID is a UUID v4.
 *
 * @returns Object with userId and loading state
 *
 * @example
 * ```tsx
 * function GamePage() {
 *   const { userId, isLoading } = useUserId()
 *
 *   // Use userId for logging
 *   useEffect(() => {
 *     if (userId) {
 *       logRecognitionEvent({ userId, ... })
 *     }
 *   }, [userId])
 * }
 * ```
 */
export function useUserId(): {
  /** User ID (authenticated or anonymous device ID) */
  userId: string | null
  /** Whether the ID is still being loaded */
  isLoading: boolean
  /** Whether this is an anonymous (device) ID vs authenticated */
  isAnonymous: boolean
} {
  const [userId, setUserId] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    // TODO: When auth is integrated, check for authenticated user first
    // const authUser = useAuth() // hypothetical
    // if (authUser?.id) {
    //   setUserId(authUser.id)
    //   setIsLoading(false)
    //   return
    // }

    // Fall back to anonymous device ID
    const STORAGE_KEY = "playlexi_device_id"

    try {
      let deviceId = localStorage.getItem(STORAGE_KEY)

      if (!deviceId) {
        // Generate a new device ID
        deviceId = crypto.randomUUID()
        localStorage.setItem(STORAGE_KEY, deviceId)
      }

      setUserId(deviceId)
    } catch {
      // localStorage not available (SSR, private browsing, etc.)
      // Generate a session-only ID
      setUserId(crypto.randomUUID())
    }

    setIsLoading(false)
  }, [])

  return {
    userId,
    isLoading,
    // TODO: Set to false when authenticated user is detected
    isAnonymous: true,
  }
}

/**
 * Get the device ID synchronously (for non-React contexts).
 *
 * Warning: This may return null during SSR or before hydration.
 * Prefer useUserId() hook when possible.
 */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") {
    return null
  }

  const STORAGE_KEY = "playlexi_device_id"

  try {
    let deviceId = localStorage.getItem(STORAGE_KEY)

    if (!deviceId) {
      deviceId = crypto.randomUUID()
      localStorage.setItem(STORAGE_KEY, deviceId)
    }

    return deviceId
  } catch {
    return null
  }
}
