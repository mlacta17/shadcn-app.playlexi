"use client"

import * as React from "react"
import {
  type Word,
  type WordTier,
  getTimerDuration,
  playWordIntro,
  playWordSentence,
  playWordDefinition,
} from "@/lib/word-service"
import { fetchRandomWord } from "@/lib/word-fetcher"
import { validateAnswer, isEmptyAnswer } from "@/lib/answer-validation"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Placement session phase.
 *
 * Simpler than GamePhase since placement has no hearts/lives.
 */
export type PlacementPhase =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "checking"
  | "feedback"
  | "complete"

/**
 * Record of a single placement answer.
 */
export interface PlacementAnswer {
  word: Word
  playerAnswer: string
  isCorrect: boolean
  timeTaken: number
  round: number
}

/**
 * Placement session state.
 */
export interface PlacementState {
  phase: PlacementPhase
  currentRound: number
  totalRounds: number
  currentWord: Word | null
  currentTier: WordTier
  timerDuration: number
  answers: PlacementAnswer[]
  usedWordIds: string[]
  lastAnswerCorrect: boolean | null
  error: string | null
}

/**
 * Options for answer submission with timing data for anti-cheat.
 */
export interface PlacementSubmitOptions {
  letterTiming?: {
    averageLetterGapMs: number
    looksLikeSpelling: boolean
    letterCount: number
  }
  audioTiming?: {
    wordCount: number
    avgGapSec: number
    looksLikeSpelling: boolean
  }
}

/**
 * Actions for controlling the placement session.
 */
export interface PlacementActions {
  startPlacement: () => void
  submitAnswer: (answer: string, options?: PlacementSubmitOptions) => void
  handleTimeUp: () => void
  playWord: () => void
  playSentence: () => void
  playDefinition: () => void
}

/**
 * Return type of usePlacementSession hook.
 */
export interface UsePlacementSessionReturn {
  state: PlacementState
  actions: PlacementActions
  computed: {
    correctCount: number
    wrongCount: number
    accuracy: number
    isLoading: boolean
    /** Derived tier based on performance (1-7) */
    derivedTier: WordTier
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Number of words in placement test.
 * Per PRD Section 2.2.1: "10-15 words to find your level"
 * Using 10 for quicker onboarding.
 */
const PLACEMENT_ROUNDS = 10

/**
 * Starting tier for placement (middle of the range).
 */
const INITIAL_TIER: WordTier = 3

/**
 * Feedback display duration (ms).
 */
const FEEDBACK_DURATION = 400

/**
 * SessionStorage key for placement results.
 * Must match the key used in rank-result page.
 */
const PLACEMENT_STORAGE_KEY = "playlexi_placement_result"

// =============================================================================
// INITIAL STATE
// =============================================================================

function createInitialState(): PlacementState {
  return {
    phase: "idle",
    currentRound: 0,
    totalRounds: PLACEMENT_ROUNDS,
    currentWord: null,
    currentTier: INITIAL_TIER,
    timerDuration: getTimerDuration(INITIAL_TIER, "voice"),
    answers: [],
    usedWordIds: [],
    lastAnswerCorrect: null,
    error: null,
  }
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Placement test session hook.
 *
 * A simplified version of useGameSession specifically for the placement test.
 * Key differences from game session:
 * - No hearts/lives system
 * - Fixed number of rounds (10)
 * - Adaptive difficulty (tier changes based on performance)
 * - Results stored in sessionStorage for OAuth flow
 *
 * ## Adaptive Tier Algorithm
 * Starts at tier 3 (middle). After each answer:
 * - Correct: Increase tier by 1 (max 7)
 * - Wrong: Decrease tier by 1 (min 1)
 *
 * Final tier is derived from overall performance.
 *
 * @see PRD Section 2.2.1 — Placement Test
 */
export function usePlacementSession(): UsePlacementSessionReturn {
  const [state, setState] = React.useState<PlacementState>(createInitialState)

  const wordStartTimeRef = React.useRef<number>(0)

  // ---------------------------------------------------------------------------
  // ACTIONS
  // ---------------------------------------------------------------------------

  /**
   * Load the next word.
   */
  const loadNextWord = React.useCallback(async () => {
    let currentTier: WordTier = INITIAL_TIER
    let usedWordIds: string[] = []

    setState((prev) => {
      currentTier = prev.currentTier
      usedWordIds = prev.usedWordIds
      return { ...prev, phase: "loading" as const }
    })

    const result = await fetchRandomWord(currentTier, usedWordIds)

    if (!result.success) {
      setState((prev) => ({
        ...prev,
        error: result.error,
        phase: "complete" as const,
      }))
      return
    }

    const word = result.word
    const timerDuration = getTimerDuration(word.tier, "voice")

    setState((prev) => ({
      ...prev,
      currentWord: word,
      timerDuration,
      usedWordIds: [...prev.usedWordIds, word.id],
      phase: "ready" as const,
      error: null,
    }))
  }, [])

  /**
   * Start the placement test.
   */
  const startPlacement = React.useCallback(async () => {
    setState(createInitialState())
    await new Promise((resolve) => setTimeout(resolve, 100))
    await loadNextWord()
  }, [loadNextWord])

  /**
   * Begin the current round.
   */
  const beginPlaying = React.useCallback(() => {
    wordStartTimeRef.current = Date.now()
    setState((prev) => ({
      ...prev,
      phase: "playing",
      currentRound: prev.currentRound + 1,
    }))
  }, [])

  /**
   * Submit an answer.
   */
  const submitAnswer = React.useCallback(
    (answer: string, options?: PlacementSubmitOptions) => {
      setState((prev) => {
        if (prev.phase !== "playing" || !prev.currentWord) {
          return prev
        }

        const timeTaken = Math.round((Date.now() - wordStartTimeRef.current) / 1000)

        if (isEmptyAnswer(answer)) {
          const record: PlacementAnswer = {
            word: prev.currentWord,
            playerAnswer: "",
            isCorrect: false,
            timeTaken,
            round: prev.currentRound,
          }

          return {
            ...prev,
            phase: "checking",
            answers: [...prev.answers, record],
            lastAnswerCorrect: false,
          }
        }

        const result = validateAnswer(answer, prev.currentWord.word, "voice", {
          letterTiming: options?.letterTiming,
          audioTiming: options?.audioTiming,
        })
        const isCorrect = result.isCorrect

        const record: PlacementAnswer = {
          word: prev.currentWord,
          playerAnswer: answer,
          isCorrect,
          timeTaken,
          round: prev.currentRound,
        }

        return {
          ...prev,
          phase: "checking",
          answers: [...prev.answers, record],
          lastAnswerCorrect: isCorrect,
        }
      })
    },
    []
  )

  /**
   * Handle timer expiration.
   */
  const handleTimeUp = React.useCallback(() => {
    submitAnswer("")
  }, [submitAnswer])

  /**
   * Audio helpers.
   */
  const playWord = React.useCallback(() => {
    if (state.currentWord) {
      playWordIntro(state.currentWord)
    }
  }, [state.currentWord])

  const playSentence = React.useCallback(() => {
    if (state.currentWord) {
      playWordSentence(state.currentWord)
    }
  }, [state.currentWord])

  const playDefinition = React.useCallback(() => {
    if (state.currentWord) {
      playWordDefinition(state.currentWord)
    }
  }, [state.currentWord])

  // ---------------------------------------------------------------------------
  // EFFECTS
  // ---------------------------------------------------------------------------

  /**
   * Process answer result after checking phase.
   */
  React.useEffect(() => {
    if (state.phase !== "checking") return

    setState((prev) => {
      const isCorrect = prev.lastAnswerCorrect ?? false
      const isLastRound = prev.currentRound >= prev.totalRounds

      // Adaptive tier: adjust based on answer
      let newTier = prev.currentTier
      if (isCorrect && newTier < 7) {
        newTier = (newTier + 1) as WordTier
      } else if (!isCorrect && newTier > 1) {
        newTier = (newTier - 1) as WordTier
      }

      return {
        ...prev,
        phase: isLastRound ? "complete" : "feedback",
        currentTier: newTier,
      }
    })
  }, [state.phase])

  /**
   * Auto-play word intro when ready.
   */
  const currentWordId = state.currentWord?.id
  React.useEffect(() => {
    if (state.phase === "ready" && currentWordId) {
      if (state.currentWord) {
        playWordIntro(state.currentWord)
      }

      const timeout = setTimeout(() => {
        beginPlaying()
      }, 1500)

      return () => clearTimeout(timeout)
    }
  }, [state.phase, currentWordId, state.currentWord, beginPlaying])

  /**
   * Auto-advance after feedback.
   */
  React.useEffect(() => {
    if (state.phase === "feedback") {
      const timeout = setTimeout(async () => {
        setState((prev) => ({
          ...prev,
          currentWord: null,
          lastAnswerCorrect: null,
        }))
        await loadNextWord()
      }, FEEDBACK_DURATION + 200)

      return () => clearTimeout(timeout)
    }
  }, [state.phase, loadNextWord])

  /**
   * Store results in sessionStorage when complete.
   */
  React.useEffect(() => {
    if (state.phase === "complete") {
      const correctCount = state.answers.filter((a) => a.isCorrect).length
      const accuracy = state.answers.length > 0
        ? correctCount / state.answers.length
        : 0

      // Calculate derived tier based on performance
      // Simple algorithm: base tier + adjustment for accuracy
      const baseTier = 1
      const tierBonus = Math.round(accuracy * 6) // 0-6 bonus based on accuracy
      const derivedTier = Math.min(7, Math.max(1, baseTier + tierBonus)) as WordTier

      // Estimate rating (simplified Glicko-2 approximation)
      const baseRating = 800
      const ratingBonus = Math.round(accuracy * 700) // Up to 700 bonus
      const rating = baseRating + ratingBonus

      try {
        sessionStorage.setItem(
          PLACEMENT_STORAGE_KEY,
          JSON.stringify({
            derivedTier,
            rating,
            ratingDeviation: 200,
            correctCount,
            totalRounds: state.totalRounds,
            accuracy: Math.round(accuracy * 100),
            timestamp: Date.now(),
          })
        )
      } catch {
        // sessionStorage not available
      }
    }
  }, [state.phase, state.answers, state.totalRounds])

  // ---------------------------------------------------------------------------
  // COMPUTED VALUES
  // ---------------------------------------------------------------------------

  const correctCount = state.answers.filter((a) => a.isCorrect).length
  const wrongCount = state.answers.filter((a) => !a.isCorrect).length
  const totalAnswers = state.answers.length
  const accuracy = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0
  const isLoading = state.phase === "loading"

  // Calculate derived tier
  const derivedAccuracy = totalAnswers > 0 ? correctCount / totalAnswers : 0
  const derivedTier = Math.min(7, Math.max(1, 1 + Math.round(derivedAccuracy * 6))) as WordTier

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  const actions: PlacementActions = {
    startPlacement,
    submitAnswer,
    handleTimeUp,
    playWord,
    playSentence,
    playDefinition,
  }

  const computed = {
    correctCount,
    wrongCount,
    accuracy,
    isLoading,
    derivedTier,
  }

  return { state, actions, computed }
}
