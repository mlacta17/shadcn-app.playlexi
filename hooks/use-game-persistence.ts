/**
 * useGamePersistence Hook — PlayLexi
 *
 * Handles saving game results to the server when a game ends.
 * This is a companion hook to useGameSession that persists results.
 *
 * ## Usage
 *
 * ```tsx
 * const { state, actions, computed } = useGameSession("endless", "voice", { initialTier })
 * const { saveGame, isSaving, error } = useGamePersistence()
 *
 * // When game ends:
 * useEffect(() => {
 *   if (state.phase === "result") {
 *     saveGame({ state, computed })
 *   }
 * }, [state.phase])
 * ```
 *
 * ## Architecture
 *
 * The hook:
 * 1. Creates a game session on the server when saving
 * 2. Sends all rounds in a batch
 * 3. Server calculates XP (client XP is for logging only)
 * 4. Server awards XP and updates user rank
 * 5. Server updates Glicko-2 skill rating
 *
 * ## Trade-offs: Create-on-Finish vs Create-on-Start
 *
 * Current approach: Game session is created on FINISH (not on start).
 *
 * Pros:
 * - Simpler implementation (one API call instead of two)
 * - No orphaned game records from abandoned games
 * - Works well for single-player games
 *
 * Cons:
 * - Mid-game crashes lose all progress (no recovery)
 * - Cannot show "in progress" games on dashboard
 *
 * For multiplayer, we'll need create-on-start for:
 * - Lobby management
 * - Real-time player sync
 * - Crash recovery
 *
 * ## Security Note
 *
 * XP is calculated SERVER-SIDE based on the rounds. The client sends
 * `xpEarned` for logging/debugging purposes only — the server recalculates
 * it to prevent cheating.
 *
 * @see lib/services/game-service.ts for server-side logic
 * @see lib/game-constants.ts for XP calculation formula
 */

import * as React from "react"
import type { GameState, AnswerRecord } from "./use-game-session"
import type { RoundResult } from "@/lib/services/game-service"

// =============================================================================
// TYPES
// =============================================================================

interface GameResultData {
  state: GameState
  computed: {
    correctCount: number
    wrongCount: number
    accuracy: number
    xpEarned: number
  }
}

interface SaveGameResult {
  success: boolean
  gameId?: string
  /** Server-calculated XP (authoritative) */
  xpEarned?: number
  error?: string
}

interface UseGamePersistenceReturn {
  /** Save the completed game to the server */
  saveGame: (data: GameResultData) => Promise<SaveGameResult>
  /** Whether a save is in progress */
  isSaving: boolean
  /** Last save error, if any */
  error: string | null
  /** The saved game ID */
  savedGameId: string | null
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert AnswerRecord array to RoundResult array for the API.
 */
function answersToRounds(answers: AnswerRecord[]): RoundResult[] {
  return answers.map((answer) => ({
    roundNumber: answer.round,
    wordId: answer.word.id,
    answer: answer.playerAnswer,
    isCorrect: answer.isCorrect,
    timeTaken: answer.timeTaken, // Time the player took to answer
  }))
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for persisting game results to the server.
 */
export function useGamePersistence(): UseGamePersistenceReturn {
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [savedGameId, setSavedGameId] = React.useState<string | null>(null)

  // Track if we've already saved this session (prevent duplicate saves)
  const hasSavedRef = React.useRef(false)

  const saveGame = React.useCallback(
    async (data: GameResultData): Promise<SaveGameResult> => {
      // Prevent duplicate saves
      if (hasSavedRef.current) {
        return { success: true, gameId: savedGameId ?? undefined }
      }

      // Don't save if no rounds were played
      if (data.state.answers.length === 0) {
        return { success: true }
      }

      setIsSaving(true)
      setError(null)

      try {
        // Step 1: Create game session
        const createResponse = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: data.state.mode,
            inputMethod: data.state.inputMethod,
          }),
        })

        if (!createResponse.ok) {
          // Handle authentication errors explicitly
          if (createResponse.status === 401) {
            // Session expired or user not authenticated
            // Don't silently skip - this is a real error that the user should know about
            const errorMsg = "Session expired. Your game was not saved. Please sign in again."
            console.warn("[useGamePersistence] Session expired during game save")
            setError(errorMsg)
            return { success: false, error: errorMsg }
          }

          // Try to get error details from response
          let errorDetails = "Failed to create game session"
          try {
            const errorBody = await createResponse.json() as { error?: string; code?: string }
            if (errorBody.error) {
              errorDetails = `${errorDetails}: ${errorBody.error}`
            }
            if (errorBody.code) {
              errorDetails = `${errorDetails} (${errorBody.code})`
            }
          } catch {
            errorDetails = `${errorDetails} (HTTP ${createResponse.status})`
          }
          throw new Error(errorDetails)
        }

        const { gameId } = await createResponse.json() as { gameId: string }

        // Step 2: Finalize game with all rounds
        // Note: Server calculates XP from rounds. We send xpEarned for logging only.
        const finishResponse = await fetch(`/api/games/${gameId}/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rounds: answersToRounds(data.state.answers),
            heartsRemaining: data.state.hearts,
            // Send blitzScore for blitz mode XP calculation
            blitzScore: data.state.mode === "blitz" ? data.state.blitzScore : undefined,
            // Client XP for server-side logging/debugging (not trusted)
            xpEarned: data.computed.xpEarned,
          }),
        })

        if (!finishResponse.ok) {
          // Handle authentication errors explicitly
          if (finishResponse.status === 401) {
            // Session expired during game - game was created but not finished
            const errorMsg = "Session expired while saving. Please sign in again."
            console.warn("[useGamePersistence] Session expired during finish")
            setError(errorMsg)
            return { success: false, error: errorMsg }
          }

          // Try to get more details from the server response
          let errorDetails = "Failed to save game results"
          try {
            const errorBody = await finishResponse.json() as { error?: string; code?: string }
            if (errorBody.error) {
              errorDetails = `${errorDetails}: ${errorBody.error}`
            }
            if (errorBody.code) {
              errorDetails = `${errorDetails} (${errorBody.code})`
            }
          } catch {
            // Couldn't parse error body, use status code
            errorDetails = `${errorDetails} (HTTP ${finishResponse.status})`
          }
          console.error("[useGamePersistence] Finish failed:", errorDetails)
          throw new Error(errorDetails)
        }

        // Server returns the authoritative XP value
        const { xpEarned: serverXP } = await finishResponse.json() as { xpEarned: number }

        hasSavedRef.current = true
        setSavedGameId(gameId)
        return { success: true, gameId, xpEarned: serverXP }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        console.error("[useGamePersistence] Error:", err)
        setError(errorMessage)
        return { success: false, error: errorMessage }
      } finally {
        setIsSaving(false)
      }
    },
    [savedGameId]
  )

  // Reset saved state when hook is remounted (new game)
  React.useEffect(() => {
    return () => {
      hasSavedRef.current = false
    }
  }, [])

  return {
    saveGame,
    isSaving,
    error,
    savedGameId,
  }
}
