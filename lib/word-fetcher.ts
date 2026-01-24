/**
 * Word Fetcher — Async word retrieval with D1/mock abstraction.
 *
 * This module provides the async interface for fetching words,
 * abstracting the difference between:
 * - Mock data (synchronous, in-memory)
 * - D1 database (asynchronous, API call)
 *
 * ## Why This Exists
 *
 * The game session hook (`useGameSession`) needs to load words, but:
 * - React `setState` callbacks must be synchronous
 * - D1 queries are asynchronous
 *
 * This module handles the async loading outside of setState,
 * allowing the hook to manage a "loading" state properly.
 *
 * ## Usage
 *
 * ```typescript
 * const { fetchRandomWord, isUsingDatabase } = useWordFetcher()
 *
 * // In the game hook
 * const word = await fetchRandomWord(tier, excludeIds)
 * if (word) {
 *   setState(prev => ({ ...prev, currentWord: word }))
 * }
 * ```
 *
 * @see hooks/use-game-session.ts
 * @see app/api/words/random/route.ts
 */

import type { Word, WordTier, WordResult } from "./word-service"
import { getRandomWord as getRandomWordSync } from "./word-service"

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Feature flag: Use D1 database instead of mock data.
 *
 * This is the PRIMARY word fetching mechanism for the app.
 *
 * When true (default):
 * - Fetches words from /api/words/random endpoint (D1 database)
 * - Falls back to mock data on API failure
 *
 * When false:
 * - Uses synchronous mock data from word-service.ts
 * - Useful for offline development without database
 *
 * In production, this is always true since D1 is configured.
 */
export const USE_DATABASE = true

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

interface ApiSuccessResponse {
  success: true
  word: Word
}

interface ApiErrorResponse {
  success: false
  error: string
}

type ApiResponse = ApiSuccessResponse | ApiErrorResponse

// =============================================================================
// ASYNC WORD FETCHER
// =============================================================================

/**
 * Fetch a random word from the appropriate data source.
 *
 * When `USE_DATABASE` is true, calls the `/api/words/random` endpoint.
 * When false, uses the synchronous mock data.
 *
 * @param tier - Word difficulty tier (1-7)
 * @param excludeIds - Word IDs to exclude (prevents repeats)
 * @returns Promise resolving to WordResult
 *
 * @example
 * ```typescript
 * const result = await fetchRandomWord(3, ["abc", "def"])
 * if (result.success) {
 *   console.log(result.word.word) // e.g., "castle"
 * } else {
 *   console.error(result.error)
 * }
 * ```
 */
export async function fetchRandomWord(
  tier: WordTier,
  excludeIds: string[] = []
): Promise<WordResult> {
  if (!USE_DATABASE) {
    // Use synchronous mock data
    return getRandomWordSync(tier, excludeIds)
  }

  // Fetch from D1 via API
  try {
    const params = new URLSearchParams({
      tier: tier.toString(),
    })

    if (excludeIds.length > 0) {
      params.set("excludeIds", excludeIds.join(","))
    }

    // Debug: Log what we're sending to the API
    console.log(`[WordFetcher] Fetching tier=${tier}, excluding ${excludeIds.length} words:`, excludeIds)

    const response = await fetch(`/api/words/random?${params.toString()}`)
    const data: ApiResponse = await response.json()

    if (!data.success) {
      return {
        success: false,
        error: data.error || "Failed to fetch word",
      }
    }

    // Debug: Log the word we received
    console.log(`[WordFetcher] Received word: "${data.word.word}" (id=${data.word.id})`)

    return {
      success: true,
      word: data.word,
    }
  } catch (error) {
    console.error("[WordFetcher] API call failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    }
  }
}

/**
 * Check if the word fetcher is using the database.
 * Useful for displaying debug info or adjusting behavior.
 */
export function isUsingDatabase(): boolean {
  return USE_DATABASE
}
