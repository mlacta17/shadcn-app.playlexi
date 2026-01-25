"use client"

import * as React from "react"
import { useSession } from "@/lib/auth/client"

/**
 * Hook to get the current user ID for phonetic learning.
 *
 * ## Behavior
 *
 * 1. **Authenticated users**: Returns the Better Auth user ID from session
 * 2. **Anonymous users**: Falls back to device ID stored in localStorage
 *
 * This allows:
 * - Recognition logging to work for everyone (authenticated or not)
 * - Phonetic mappings to be created for authenticated users (FK constraint)
 * - Data to persist across sessions on the same device for anonymous users
 *
 * ## Storage Key
 *
 * Uses `playlexi_device_id` in localStorage for anonymous fallback.
 *
 * @returns Object with userId, loading state, and anonymous flag
 *
 * @example
 * ```tsx
 * function GamePage() {
 *   const { userId, isLoading, isAnonymous } = useUserId()
 *
 *   // Use userId for logging (works for all users)
 *   useEffect(() => {
 *     if (userId) {
 *       logRecognitionEvent({ userId, ... })
 *     }
 *   }, [userId])
 *
 *   // isAnonymous tells you if phonetic mappings can be created
 *   // (they require authenticated user due to FK constraint)
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
  const { data: session, isPending: isSessionPending } = useSession()
  const [deviceId, setDeviceId] = React.useState<string | null>(null)
  const [isDeviceIdLoading, setIsDeviceIdLoading] = React.useState(true)

  // Load device ID from localStorage (for anonymous fallback)
  React.useEffect(() => {
    const STORAGE_KEY = "playlexi_device_id"

    try {
      let storedDeviceId = localStorage.getItem(STORAGE_KEY)

      if (!storedDeviceId) {
        // Generate a new device ID
        storedDeviceId = crypto.randomUUID()
        localStorage.setItem(STORAGE_KEY, storedDeviceId)
      }

      setDeviceId(storedDeviceId)
    } catch {
      // localStorage not available (SSR, private browsing, etc.)
      // Generate a session-only ID
      setDeviceId(crypto.randomUUID())
    }

    setIsDeviceIdLoading(false)
  }, [])

  // Determine the user ID to return
  // Priority: authenticated user ID > anonymous device ID
  const isAuthenticated = !!session?.user?.id
  const userId = isAuthenticated ? session.user.id : deviceId
  const isLoading = isSessionPending || isDeviceIdLoading

  return {
    userId,
    isLoading,
    isAnonymous: !isAuthenticated,
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
