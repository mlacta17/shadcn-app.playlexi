"use client"

import * as React from "react"
import { logRecognitionEvent } from "@/lib/phonetic-learning"
import { useUserId } from "./use-user-id"
import type { Word } from "@/lib/word-service"

/**
 * Integration hook for phonetic learning system.
 *
 * This hook handles:
 * 1. Logging recognition events after voice answers
 * 2. Fetching user-specific phonetic mappings (future)
 * 3. Triggering learning after game ends (future)
 *
 * ## Design Principle
 *
 * This hook is **separate** from the game session hook intentionally:
 * - Game session handles core gameplay logic
 * - This hook handles learning/logging side effects
 * - Neither depends on the other's internals
 *
 * ## Usage
 *
 * ```tsx
 * function GamePage() {
 *   const { state, actions } = useGameSession("endless", "voice")
 *   const { logAnswer } = usePhoneticLearning()
 *
 *   // After submitting an answer, log it
 *   const handleSubmit = async () => {
 *     const metrics = await stopRecording()
 *     actions.submitAnswer(transcript)
 *
 *     // Log for learning (fire-and-forget)
 *     logAnswer({
 *       wordToSpell: state.currentWord.word,
 *       googleTranscript: transcript,
 *       extractedLetters: extractedLetters,
 *       wasCorrect: result.isCorrect,
 *       rejectionReason: result.rejectionReason,
 *     })
 *   }
 * }
 * ```
 *
 * @see lib/phonetic-learning/ for the learning system implementation
 */
export function usePhoneticLearning() {
  const { userId, isLoading: isUserLoading, isAnonymous } = useUserId()

  // Track if we've already fetched mappings this session
  const hasFetchedMappingsRef = React.useRef(false)

  // User's learned phonetic mappings (for future validation integration)
  const [userMappings, setUserMappings] = React.useState<Map<string, string>>(
    new Map()
  )

  /**
   * Log a recognition event for learning.
   *
   * This is fire-and-forget — errors are logged but don't affect gameplay.
   * Only logs voice input (keyboard is skipped).
   *
   * @param params - Recognition event data
   */
  const logAnswer = React.useCallback(
    (params: {
      wordToSpell: string
      googleTranscript: string
      extractedLetters: string
      wasCorrect: boolean
      rejectionReason?: string
    }) => {
      if (!userId) {
        // User ID not ready yet, skip logging
        return
      }

      // Fire and forget
      logRecognitionEvent({
        userId,
        wordToSpell: params.wordToSpell,
        googleTranscript: params.googleTranscript,
        extractedLetters: params.extractedLetters,
        wasCorrect: params.wasCorrect,
        rejectionReason: params.rejectionReason,
        inputMethod: "voice",
      }).catch(() => {
        // Silently ignore - logging shouldn't affect gameplay
      })
    },
    [userId]
  )

  /**
   * Fetch user's learned phonetic mappings.
   *
   * Called at game start to load personalized mappings.
   * Results are cached for the session.
   */
  const fetchMappings = React.useCallback(async () => {
    if (!userId || isAnonymous) {
      // Anonymous users don't have persistent mappings
      // (mappings require authenticated user due to FK constraint)
      return
    }

    if (hasFetchedMappingsRef.current) {
      // Already fetched this session
      return
    }

    try {
      const response = await fetch(
        `/api/phonetic-learning/mappings?userId=${encodeURIComponent(userId)}`
      )

      if (!response.ok) {
        console.warn("[PhoneticLearning] Failed to fetch mappings")
        return
      }

      const data = (await response.json()) as {
        success: boolean
        mappings?: Array<{ heard: string; intended: string }>
      }

      if (data.success && Array.isArray(data.mappings)) {
        const mappingsMap = new Map<string, string>(
          data.mappings.map((m) => [m.heard, m.intended])
        )
        setUserMappings(mappingsMap)
        hasFetchedMappingsRef.current = true

        if (process.env.NODE_ENV === "development" && mappingsMap.size > 0) {
          console.log(
            `[PhoneticLearning] Loaded ${mappingsMap.size} user mappings`
          )
        }
      }
    } catch (error) {
      console.warn("[PhoneticLearning] Error fetching mappings:", error)
    }
  }, [userId, isAnonymous])

  /**
   * Trigger learning analysis after a game ends.
   *
   * This analyzes the user's recent recognition logs and
   * creates new learned mappings if patterns are found.
   */
  const triggerLearning = React.useCallback(async () => {
    if (!userId || isAnonymous) {
      // Anonymous users can't have persistent mappings
      return
    }

    try {
      const response = await fetch("/api/phonetic-learning/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        console.warn("[PhoneticLearning] Learning request failed")
        return
      }

      const data = (await response.json()) as {
        success: boolean
        mappingsCreated?: number
        newMappings?: Array<{ heard: string; intended: string }>
      }

      if (data.success && data.mappingsCreated && data.mappingsCreated > 0) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            `[PhoneticLearning] Created ${data.mappingsCreated} new mappings:`,
            data.newMappings
          )
        }

        // Update local cache with new mappings
        if (data.newMappings) {
          setUserMappings((prev) => {
            const updated = new Map(prev)
            for (const m of data.newMappings!) {
              updated.set(m.heard, m.intended)
            }
            return updated
          })
        }
      }
    } catch (error) {
      console.warn("[PhoneticLearning] Error triggering learning:", error)
    }
  }, [userId, isAnonymous])

  return {
    /** Whether user ID is still loading */
    isLoading: isUserLoading,

    /** Current user ID (authenticated or anonymous) */
    userId,

    /** Whether user is anonymous (device-based ID) */
    isAnonymous,

    /** User's learned phonetic mappings */
    userMappings,

    /** Log a voice answer for learning */
    logAnswer,

    /** Fetch user's mappings (call at game start) */
    fetchMappings,

    /** Trigger learning analysis (call after game ends) */
    triggerLearning,
  }
}

/**
 * Effect hook to auto-log answers from game state changes.
 *
 * This is a convenience wrapper that observes game state and
 * automatically logs voice answers when they're submitted.
 *
 * @param gameState - Current game state from useGameSession
 * @param currentWord - The word being spelled
 * @param rawTranscript - Raw speech transcript (before letter extraction)
 * @param extractedLetters - Letters extracted from transcript
 */
export function useAutoLogAnswers(
  gameState: {
    phase: string
    lastAnswerCorrect: boolean | null
    inputMethod: string
  },
  currentWord: Word | null,
  rawTranscript: string,
  extractedLetters: string
) {
  const { logAnswer } = usePhoneticLearning()
  const lastLoggedRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    // Only log when transitioning to feedback phase with voice input
    if (
      gameState.phase !== "feedback" ||
      gameState.inputMethod !== "voice" ||
      !currentWord ||
      !rawTranscript
    ) {
      return
    }

    // Prevent duplicate logging
    const logKey = `${currentWord.id}:${rawTranscript}`
    if (lastLoggedRef.current === logKey) {
      return
    }
    lastLoggedRef.current = logKey

    logAnswer({
      wordToSpell: currentWord.word,
      googleTranscript: rawTranscript,
      extractedLetters,
      wasCorrect: gameState.lastAnswerCorrect ?? false,
    })
  }, [
    gameState.phase,
    gameState.lastAnswerCorrect,
    gameState.inputMethod,
    currentWord,
    rawTranscript,
    extractedLetters,
    logAnswer,
  ])
}
