"use client"

/**
 * Daily Spell Session Hook — PlayLexi
 *
 * State management for Daily Spell game sessions.
 * Simpler than useGameSession because:
 * - Fixed 5 rounds (not infinite)
 * - No hearts/lives (every player completes all 5 words)
 * - Words are pre-loaded from today's puzzle (not fetched randomly)
 * - Voice input only (no keyboard option)
 *
 * ## State Machine
 *
 * ```
 * idle → loading → ready → playing → checking → feedback → (ready | complete)
 *                    ↑                              ↓
 *                    └──────────────────────────────┘
 * ```
 *
 * ## Differences from useGameSession
 *
 * | Aspect | useGameSession | useDailySpellSession |
 * |--------|----------------|---------------------|
 * | Rounds | Infinite/timed | Fixed 5 |
 * | Hearts | 3 (Endless) | None |
 * | Words | Fetched randomly | Pre-loaded from puzzle |
 * | End condition | No hearts / time up | All 5 words completed |
 * | End flow | → Results page | → Streak → Results |
 *
 * @see hooks/use-game-session.ts for comparison
 * @see lib/services/daily-spell-service.ts for puzzle/result APIs
 */

import * as React from "react"
import {
  type Word,
  type WordTier,
  getTimerDuration,
  playWordIntro,
  playWordSentence,
  playWordDefinition,
} from "@/lib/word-service"
import {
  validateAnswer,
  isEmptyAnswer,
  type InputMode,
} from "@/lib/answer-validation"
import { showErrorToast } from "@/lib/toast-utils"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Game phase for Daily Spell.
 */
export type DailySpellPhase =
  | "idle"      // Not started, waiting for puzzle load
  | "loading"   // Loading puzzle from API
  | "ready"     // Word loaded, about to play audio
  | "playing"   // Player is spelling (timer running)
  | "checking"  // Answer submitted, validating
  | "feedback"  // Showing correct/wrong overlay
  | "complete"  // All 5 words done

/**
 * Word from the puzzle with game state.
 */
export interface PuzzleWord extends Word {
  /** 1-indexed position in puzzle */
  position: number
  /** Difficulty tier (from API, may differ from Word.tier naming) */
  difficultyTier: number
}

/**
 * Record of a single answer attempt.
 */
export interface DailySpellAnswer {
  /** The word that was presented */
  word: PuzzleWord
  /** What the player answered */
  playerAnswer: string
  /** Whether the answer was correct */
  isCorrect: boolean
  /** Time taken to answer (seconds) */
  timeTaken: number
  /** Round number (1-5) */
  round: number
}

/**
 * Complete Daily Spell session state.
 */
export interface DailySpellState {
  /** Current game phase */
  phase: DailySpellPhase
  /** Puzzle ID */
  puzzleId: string | null
  /** Puzzle number (for display: "Daily Spell #47") */
  puzzleNumber: number | null
  /** All 5 words in the puzzle */
  words: PuzzleWord[]
  /** Current round (1-5) */
  currentRound: number
  /** Current word being spelled */
  currentWord: PuzzleWord | null
  /** Timer duration for current word (seconds) */
  timerDuration: number
  /** All answers in this session */
  answers: DailySpellAnswer[]
  /** Whether the last answer was correct (for feedback) */
  lastAnswerCorrect: boolean | null
  /** Error message if something went wrong */
  error: string | null
  /** Whether user has already played today */
  alreadyPlayed: boolean
}

/**
 * Options for answer submission.
 */
export interface DailySpellSubmitOptions {
  /** Audio-level timing for anti-cheat */
  audioTiming?: {
    wordCount: number
    avgGapSec: number
    looksLikeSpelling: boolean
  }
  /** User-specific phonetic mappings */
  userMappings?: Map<string, string>
}

/**
 * Actions for controlling the Daily Spell session.
 */
export interface DailySpellActions {
  /** Load today's puzzle and start the game */
  startGame: () => Promise<void>
  /** Submit an answer for the current word */
  submitAnswer: (answer: string, options?: DailySpellSubmitOptions) => void
  /** Handle timer expiration */
  handleTimeUp: () => void
  /** Play the current word's audio */
  playWord: () => void
  /** Play the current word in a sentence */
  playSentence: () => void
  /** Play the current word's definition */
  playDefinition: () => void
}

/**
 * Return type of useDailySpellSession hook.
 */
export interface UseDailySpellSessionReturn {
  /** Current game state */
  state: DailySpellState
  /** Actions to control the game */
  actions: DailySpellActions
  /** Computed values */
  computed: {
    /** Total correct answers */
    correctCount: number
    /** Total wrong answers */
    wrongCount: number
    /** Accuracy percentage (0-100) */
    accuracy: number
    /** Score out of 5 */
    score: number
    /** Emoji row (e.g., "✅❌✅✅✅") */
    emojiRow: string
    /** Whether the game is active */
    isActive: boolean
    /** Whether all 5 words are done */
    isComplete: boolean
    /** Whether a word is loading */
    isLoading: boolean
    /** Progress (e.g., "Round 2 of 5") */
    progressText: string
  }
  /**
   * Promise that resolves when result submission completes.
   * Consumers should await this before navigating away to ensure
   * the result is persisted and available for the result page.
   */
  submitResultPromise: React.RefObject<Promise<void> | null>
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Total words in Daily Spell */
const TOTAL_WORDS = 5

/** Feedback display duration (ms) */
const FEEDBACK_DURATION = 400

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

interface ApiWordResult {
  answer: string
  correct: boolean
  timeTaken: number
}

interface ApiWord {
  id: string
  word: string
  definition: string
  exampleSentence: string
  audioUrl: string
  introAudioUrl: string | null
  sentenceAudioUrl: string | null
  definitionAudioUrl: string | null
  difficultyTier: number
}

interface ApiResponse {
  hasPlayed: boolean
  puzzle: {
    id: string
    number: number
    words: ApiWord[]
  }
  userResult?: {
    wordResults: ApiWordResult[]
  }
}

// =============================================================================
// INITIAL STATE
// =============================================================================

function createInitialState(): DailySpellState {
  return {
    phase: "idle",
    puzzleId: null,
    puzzleNumber: null,
    words: [],
    currentRound: 0,
    currentWord: null,
    timerDuration: 30, // Default, will be updated per word
    answers: [],
    lastAnswerCorrect: null,
    error: null,
    alreadyPlayed: false,
  }
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Daily Spell session hook.
 *
 * @param visitorId - Anonymous visitor ID (for users without accounts)
 * @returns State, actions, and computed values
 *
 * @example
 * ```tsx
 * const { state, actions, computed } = useDailySpellSession()
 *
 * // Start the game
 * useEffect(() => { actions.startGame() }, [])
 *
 * // Submit answer
 * const handleSubmit = (transcript: string) => {
 *   actions.submitAnswer(transcript)
 * }
 *
 * // Show progress
 * return <h1>{computed.progressText}</h1>
 * ```
 */
export function useDailySpellSession(
  visitorId?: string
): UseDailySpellSessionReturn {
  const [state, setState] = React.useState<DailySpellState>(createInitialState)

  // Refs for stable callbacks
  const stateRef = React.useRef(state)
  React.useEffect(() => {
    stateRef.current = state
  }, [state])

  // ---------------------------------------------------------------------------
  // Load Puzzle
  // ---------------------------------------------------------------------------

  const startGame = React.useCallback(async () => {
    setState((prev) => ({ ...prev, phase: "loading", error: null }))

    try {
      const params = visitorId ? `?visitorId=${visitorId}` : ""
      const response = await fetch(`/api/daily-spell${params}`)

      if (!response.ok) {
        throw new Error("Failed to load today's puzzle")
      }

      const data = (await response.json()) as ApiResponse

      // Check if already played
      if (data.hasPlayed) {
        setState((prev) => ({
          ...prev,
          phase: "complete",
          alreadyPlayed: true,
          puzzleId: data.puzzle.id,
          puzzleNumber: data.puzzle.number,
          answers: data.userResult?.wordResults?.map((r, i) => {
            const apiWord = data.puzzle.words[i]
            const puzzleWord: PuzzleWord = {
              id: apiWord.id,
              word: apiWord.word,
              tier: apiWord.difficultyTier as WordTier,
              definition: apiWord.definition,
              sentence: apiWord.exampleSentence,
              audioUrl: apiWord.audioUrl,
              introAudioUrl: apiWord.introAudioUrl ?? undefined,
              sentenceAudioUrl: apiWord.sentenceAudioUrl ?? undefined,
              definitionAudioUrl: apiWord.definitionAudioUrl ?? undefined,
              position: i + 1,
              difficultyTier: apiWord.difficultyTier,
            }
            return {
              word: puzzleWord,
              playerAnswer: r.answer,
              isCorrect: r.correct,
              timeTaken: r.timeTaken,
              round: i + 1,
            }
          }) || [],
        }))
        return
      }

      // Transform words to PuzzleWord format
      const words: PuzzleWord[] = data.puzzle.words.map((w, i) => ({
        ...w,
        id: w.id,
        word: w.word,
        tier: w.difficultyTier as WordTier,
        definition: w.definition,
        sentence: w.exampleSentence,
        audioUrl: w.audioUrl,
        introAudioUrl: w.introAudioUrl ?? undefined,
        sentenceAudioUrl: w.sentenceAudioUrl ?? undefined,
        definitionAudioUrl: w.definitionAudioUrl ?? undefined,
        position: i + 1,
        difficultyTier: w.difficultyTier,
      }))

      // Start with first word
      const firstWord = words[0]
      const timerDuration = getTimerDuration(firstWord.difficultyTier as WordTier, "voice")

      setState((prev) => ({
        ...prev,
        phase: "ready",
        puzzleId: data.puzzle.id,
        puzzleNumber: data.puzzle.number,
        words,
        currentRound: 1,
        currentWord: firstWord,
        timerDuration,
      }))
    } catch (error) {
      console.error("[DailySpell] Failed to start game:", error)
      setState((prev) => ({
        ...prev,
        phase: "idle",
        error: error instanceof Error ? error.message : "Failed to load puzzle",
      }))
      showErrorToast("Failed to load today's puzzle")
    }
  }, [visitorId])

  // ---------------------------------------------------------------------------
  // Play Audio Helpers
  // ---------------------------------------------------------------------------

  const playWord = React.useCallback(() => {
    const { currentWord } = stateRef.current
    if (currentWord) {
      playWordIntro(currentWord)
    }
  }, [])

  const playSentence = React.useCallback(() => {
    const { currentWord } = stateRef.current
    if (currentWord) {
      playWordSentence(currentWord)
    }
  }, [])

  const playDefinition = React.useCallback(() => {
    const { currentWord } = stateRef.current
    if (currentWord) {
      playWordDefinition(currentWord)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Submit Answer
  // ---------------------------------------------------------------------------

  const submitAnswer = React.useCallback(
    (answer: string, options?: DailySpellSubmitOptions) => {
      const current = stateRef.current

      if (current.phase !== "playing" || !current.currentWord) {
        return
      }

      // Move to checking phase
      setState((prev) => ({ ...prev, phase: "checking" }))

      // Validate answer
      const validationResult = validateAnswer(
        answer,
        current.currentWord.word,
        "voice" as InputMode,
        {
          audioTiming: options?.audioTiming,
          userMappings: options?.userMappings,
        }
      )

      const isCorrect = validationResult.isCorrect
      const timeTaken = current.timerDuration // TODO: Track actual time

      // Record the answer
      const answerRecord: DailySpellAnswer = {
        word: current.currentWord,
        playerAnswer: answer,
        isCorrect,
        timeTaken,
        round: current.currentRound,
      }

      // Show feedback
      setState((prev) => ({
        ...prev,
        phase: "feedback",
        lastAnswerCorrect: isCorrect,
        answers: [...prev.answers, answerRecord],
      }))

      // After feedback, advance to next word or complete
      setTimeout(() => {
        const updatedState = stateRef.current

        if (updatedState.currentRound >= TOTAL_WORDS) {
          // All 5 words done
          setState((prev) => ({ ...prev, phase: "complete" }))
        } else {
          // Move to next word
          const nextRound = updatedState.currentRound + 1
          const nextWord = updatedState.words[nextRound - 1]
          const nextTimerDuration = getTimerDuration(
            nextWord.difficultyTier as WordTier,
            "voice"
          )

          setState((prev) => ({
            ...prev,
            phase: "ready",
            currentRound: nextRound,
            currentWord: nextWord,
            timerDuration: nextTimerDuration,
            lastAnswerCorrect: null,
          }))
        }
      }, FEEDBACK_DURATION)
    },
    []
  )

  // ---------------------------------------------------------------------------
  // Handle Time Up
  // ---------------------------------------------------------------------------

  const handleTimeUp = React.useCallback(() => {
    // Treat as wrong answer with empty response
    submitAnswer("")
  }, [submitAnswer])

  // ---------------------------------------------------------------------------
  // Auto-play word intro when entering "ready" phase
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    if (state.phase === "ready" && state.currentWord) {
      // Small delay before playing
      const timer = setTimeout(() => {
        playWord()
        // Move to playing phase after intro
        setState((prev) => ({ ...prev, phase: "playing" }))
      }, 300)

      return () => clearTimeout(timer)
    }
  }, [state.phase, state.currentWord, playWord])

  // ---------------------------------------------------------------------------
  // Submit Results When Complete
  // ---------------------------------------------------------------------------

  const hasSubmittedResultRef = React.useRef(false)
  const submitResultPromiseRef = React.useRef<Promise<void> | null>(null)

  React.useEffect(() => {
    if (state.phase !== "complete" || state.alreadyPlayed) return
    if (hasSubmittedResultRef.current) return
    if (!state.puzzleId || state.answers.length !== TOTAL_WORDS) return

    hasSubmittedResultRef.current = true

    // Submit results to API — store the promise so consumers
    // can await it before navigating (prevents race condition
    // where the result page loads before the POST completes).
    const submitResults = async () => {
      try {
        const wordResults = state.answers.map((answer) => ({
          wordId: answer.word.id,
          word: answer.word.word,
          answer: answer.playerAnswer,
          correct: answer.isCorrect,
          timeTaken: answer.timeTaken,
          difficulty: answer.word.difficultyTier,
        }))

        const body: Record<string, unknown> = {
          puzzleId: state.puzzleId,
          wordResults,
        }

        // Include visitorId for anonymous users
        if (visitorId) {
          body.visitorId = visitorId
        }

        const response = await fetch("/api/daily-spell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          console.error("[DailySpell] Failed to submit results:", response.status)
        }
      } catch (error) {
        console.error("[DailySpell] Error submitting results:", error)
      }
    }

    submitResultPromiseRef.current = submitResults()
  }, [state.phase, state.alreadyPlayed, state.puzzleId, state.answers, visitorId])

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const computed = React.useMemo(() => {
    const correctCount = state.answers.filter((a) => a.isCorrect).length
    const wrongCount = state.answers.filter((a) => !a.isCorrect).length
    const totalAnswered = state.answers.length
    const accuracy =
      totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0

    const emojiRow = state.answers
      .map((a) => (a.isCorrect ? "✅" : "❌"))
      .join("")

    return {
      correctCount,
      wrongCount,
      accuracy,
      score: correctCount,
      emojiRow,
      isActive: !["idle", "complete"].includes(state.phase),
      isComplete: state.phase === "complete",
      isLoading: state.phase === "loading",
      progressText: `Round ${state.currentRound} of ${TOTAL_WORDS}`,
    }
  }, [state.answers, state.phase, state.currentRound])

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    state,
    actions: {
      startGame,
      submitAnswer,
      handleTimeUp,
      playWord,
      playSentence,
      playDefinition,
    },
    computed,
    submitResultPromise: submitResultPromiseRef,
  }
}
