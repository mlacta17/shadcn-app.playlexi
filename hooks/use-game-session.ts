"use client"

import * as React from "react"
import {
  type Word,
  type WordTier,
  getRandomWord,
  getTimerDuration,
  playWordIntro,
  playWordSentence,
  playWordDefinition,
} from "@/lib/word-service"
import {
  validateAnswer,
  isEmptyAnswer,
  type InputMode,
  type VoiceValidationOptions,
} from "@/lib/answer-validation"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Game mode — determines rules and scoring.
 * Per PRD Section 4.
 */
export type GameMode = "endless" | "blitz"

/**
 * Input method — determines how player spells words.
 * Per PRD Section 4.2.
 */
export type InputMethod = "voice" | "keyboard"

/**
 * Game phase — the current state of the game.
 *
 * State transitions:
 * ```
 * idle → ready → playing → checking → feedback → (playing | result)
 *                                          ↑__________↓
 * ```
 *
 * | Phase | Description |
 * |-------|-------------|
 * | idle | Game not started, waiting for player action |
 * | ready | Word loaded, about to play audio intro |
 * | playing | Player is spelling (timer running) |
 * | checking | Answer submitted, validating |
 * | feedback | Showing correct/wrong overlay |
 * | result | Game over, showing final stats |
 */
export type GamePhase =
  | "idle"
  | "ready"
  | "playing"
  | "checking"
  | "feedback"
  | "result"

/**
 * Record of a single answer attempt.
 */
export interface AnswerRecord {
  /** The word that was presented */
  word: Word
  /** What the player answered */
  playerAnswer: string
  /** Whether the answer was correct */
  isCorrect: boolean
  /** Time taken to answer (seconds) */
  timeTaken: number
  /** Round number */
  round: number
}

/**
 * Complete game session state.
 */
export interface GameState {
  /** Current game phase */
  phase: GamePhase
  /** Game mode */
  mode: GameMode
  /** Input method */
  inputMethod: InputMethod
  /** Current round number (1-indexed) */
  currentRound: number
  /** Remaining hearts (Endless mode) */
  hearts: number
  /** Current word being spelled */
  currentWord: Word | null
  /** Current word tier */
  currentTier: WordTier
  /** Timer duration for current word (seconds) */
  timerDuration: number
  /** All answers in this session */
  answers: AnswerRecord[]
  /** Word IDs already used (to avoid repeats) */
  usedWordIds: string[]
  /** Blitz mode: remaining time (seconds) */
  blitzTimeRemaining: number
  /** Blitz mode: words spelled correctly */
  blitzScore: number
  /** Whether the last answer was correct (for feedback) */
  lastAnswerCorrect: boolean | null
  /** Error message if something went wrong */
  error: string | null
}

/**
 * Options for answer submission.
 */
export interface SubmitAnswerOptions {
  /**
   * Recording duration in milliseconds (voice mode only).
   * Used for anti-cheat: spelling takes longer than saying a word.
   */
  durationMs?: number
}

/**
 * Actions returned by the hook for controlling the game.
 */
export interface GameActions {
  /** Start a new game */
  startGame: () => void
  /**
   * Submit an answer (voice transcript or typed text).
   * @param answer - The player's answer
   * @param options - Optional settings (e.g., recording duration for voice anti-cheat)
   */
  submitAnswer: (answer: string, options?: SubmitAnswerOptions) => void
  /** Move to the next word (after feedback) */
  nextWord: () => void
  /** Handle timer expiration */
  handleTimeUp: () => void
  /** Reset the game to initial state */
  resetGame: () => void
  /** Play the current word's audio */
  playWord: () => void
  /** Play the current word in a sentence */
  playSentence: () => void
  /** Play the current word's definition */
  playDefinition: () => void
  /** Pause the game (for multiplayer/settings) */
  pauseGame: () => void
  /** Resume the game */
  resumeGame: () => void
}

/**
 * Return type of useGameSession hook.
 */
export interface UseGameSessionReturn {
  /** Current game state */
  state: GameState
  /** Actions to control the game */
  actions: GameActions
  /** Computed values */
  computed: {
    /** Total correct answers */
    correctCount: number
    /** Total wrong answers */
    wrongCount: number
    /** Accuracy percentage (0-100) */
    accuracy: number
    /** Whether the game is active (not idle or result) */
    isActive: boolean
    /** Whether the game is over */
    isGameOver: boolean
    /** XP earned (calculated based on mode) */
    xpEarned: number
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Starting hearts for Endless mode (per PRD) */
const INITIAL_HEARTS = 3

/** Starting tier for new players */
const INITIAL_TIER: WordTier = 1

/** Blitz mode duration in seconds (per PRD: 3 minutes) */
const BLITZ_DURATION = 180

/** Time penalty for wrong answer in Blitz (seconds) */
const BLITZ_WRONG_PENALTY = 4

/** Feedback display duration (ms) — matches useGameFeedback */
const FEEDBACK_DURATION = 400

// =============================================================================
// INITIAL STATE
// =============================================================================

function createInitialState(
  mode: GameMode,
  inputMethod: InputMethod
): GameState {
  return {
    phase: "idle",
    mode,
    inputMethod,
    currentRound: 0,
    hearts: mode === "endless" ? INITIAL_HEARTS : 0,
    currentWord: null,
    currentTier: INITIAL_TIER,
    timerDuration: getTimerDuration(INITIAL_TIER, inputMethod),
    answers: [],
    usedWordIds: [],
    blitzTimeRemaining: mode === "blitz" ? BLITZ_DURATION : 0,
    blitzScore: 0,
    lastAnswerCorrect: null,
    error: null,
  }
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Game session state machine hook.
 *
 * This is the **single source of truth** for all game state.
 * It manages the game flow, scoring, and transitions between phases.
 *
 * ## Architecture
 * ```
 * useGameSession (owns game state)
 *     │
 *     ├── useGameTimer (manages per-word timer)
 *     ├── useGameFeedback (manages overlay)
 *     ├── useGameSounds (manages audio)
 *     └── useSpeechRecognition (manages voice input)
 *
 * All these hooks are used in the Game Page component,
 * but useGameSession is the orchestrator.
 * ```
 *
 * ## State Machine
 * The game follows a strict state machine to prevent impossible states:
 * - Cannot submit answer when not in "playing" phase
 * - Cannot start new word when in "feedback" phase
 * - Timer only runs during "playing" phase
 *
 * ## Usage
 * ```tsx
 * function GamePage() {
 *   const { state, actions, computed } = useGameSession("endless", "voice")
 *
 *   // Start game
 *   useEffect(() => {
 *     actions.startGame()
 *   }, [])
 *
 *   // Handle answer submission
 *   const handleSubmit = (answer: string) => {
 *     actions.submitAnswer(answer)
 *   }
 *
 *   return (
 *     <div>
 *       <HeartsDisplay remaining={state.hearts} />
 *       <GameTimer totalSeconds={state.timerDuration} ... />
 *       <SpeechInput onStopClick={() => handleSubmit(transcript)} />
 *     </div>
 *   )
 * }
 * ```
 *
 * @param mode - Game mode (endless or blitz)
 * @param inputMethod - Input method (voice or keyboard)
 */
export function useGameSession(
  mode: GameMode,
  inputMethod: InputMethod
): UseGameSessionReturn {
  const [state, setState] = React.useState<GameState>(() =>
    createInitialState(mode, inputMethod)
  )

  // Track time when word was presented (for time tracking)
  const wordStartTimeRef = React.useRef<number>(0)

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  /**
   * Load the next word and transition to ready phase.
   */
  const loadNextWord = React.useCallback(() => {
    setState((prev) => {
      const result = getRandomWord(prev.currentTier, prev.usedWordIds)

      if (!result.success) {
        return { ...prev, error: result.error, phase: "result" }
      }

      const word = result.word
      const timerDuration = getTimerDuration(word.tier, prev.inputMethod)

      return {
        ...prev,
        currentWord: word,
        timerDuration,
        usedWordIds: [...prev.usedWordIds, word.id],
        phase: "ready" as const,
        error: null,
      }
    })
  }, [])

  /**
   * Start a new game.
   */
  const startGame = React.useCallback(() => {
    setState((prev) => ({
      ...createInitialState(prev.mode, prev.inputMethod),
      phase: "idle",
    }))

    // Small delay then load first word
    setTimeout(() => {
      loadNextWord()
    }, 100)
  }, [loadNextWord])

  /**
   * Begin the current round (after word intro plays).
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
   *
   * For voice mode, validates that the player spelled the word letter-by-letter
   * rather than just saying the whole word (anti-cheat).
   *
   * ## Anti-Cheat (Voice Mode)
   * Two mechanisms prevent cheating:
   * 1. **Duration check**: Spelling takes longer than saying a word
   * 2. **Pattern detection**: Transcript must look like spelled letters
   *
   * @param answer - The player's answer (transcript or typed text)
   * @param options - Optional settings including recording duration
   */
  const submitAnswer = React.useCallback(
    (answer: string, options?: SubmitAnswerOptions) => {
      setState((prev) => {
        // Guard: Only accept answers during playing phase
        if (prev.phase !== "playing" || !prev.currentWord) {
          return prev
        }

        // Calculate time taken
        const timeTaken = Math.round((Date.now() - wordStartTimeRef.current) / 1000)

        // Check for empty answer
        if (isEmptyAnswer(answer)) {
          // Treat as wrong answer
          const record: AnswerRecord = {
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

        // Build voice validation options for anti-cheat
        const voiceOptions: VoiceValidationOptions | undefined =
          prev.inputMethod === "voice" && options?.durationMs !== undefined
            ? { durationMs: options.durationMs }
            : undefined

        // Validate the answer with input mode for voice anti-cheat
        const inputMode: InputMode = prev.inputMethod
        const result = validateAnswer(
          answer,
          prev.currentWord.word,
          inputMode,
          voiceOptions
        )

        // If voice mode and player didn't spell it out, treat as wrong
        // The rejectionReason helps with user feedback
        const isCorrect = result.isCorrect && !result.rejectionReason

        if (process.env.NODE_ENV === "development" && result.rejectionReason) {
          console.log(`[GameSession] Answer rejected: ${result.rejectionReason}`)
        }

        const record: AnswerRecord = {
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
   * Process the answer result and show feedback.
   * Called after submitAnswer sets phase to "checking".
   */
  React.useEffect(() => {
    if (state.phase !== "checking") return

    // Transition to feedback phase
    setState((prev) => {
      const isCorrect = prev.lastAnswerCorrect ?? false

      if (prev.mode === "endless") {
        // Endless: lose heart on wrong answer
        const newHearts = isCorrect ? prev.hearts : prev.hearts - 1
        const isGameOver = newHearts <= 0

        return {
          ...prev,
          phase: isGameOver ? "result" : "feedback",
          hearts: newHearts,
        }
      } else {
        // Blitz: no hearts, but time penalty on wrong
        const timePenalty = isCorrect ? 0 : BLITZ_WRONG_PENALTY
        const newTimeRemaining = Math.max(0, prev.blitzTimeRemaining - timePenalty)
        const newScore = isCorrect ? prev.blitzScore + 1 : prev.blitzScore
        const isGameOver = newTimeRemaining <= 0

        return {
          ...prev,
          phase: isGameOver ? "result" : "feedback",
          blitzTimeRemaining: newTimeRemaining,
          blitzScore: newScore,
        }
      }
    })
  }, [state.phase])

  /**
   * Handle timer expiration.
   */
  const handleTimeUp = React.useCallback(() => {
    // Timer expiring is treated as a wrong answer
    submitAnswer("")
  }, [submitAnswer])

  /**
   * Move to the next word after feedback.
   */
  const nextWord = React.useCallback(() => {
    setState((prev) => {
      if (prev.phase !== "feedback") return prev

      // Progress tier in Endless mode (every few rounds)
      let newTier = prev.currentTier
      if (prev.mode === "endless" && prev.lastAnswerCorrect) {
        // Increase tier every 3 correct answers (simplified)
        const correctCount = prev.answers.filter((a) => a.isCorrect).length
        if (correctCount > 0 && correctCount % 3 === 0 && newTier < 7) {
          newTier = (newTier + 1) as WordTier
        }
      }

      return {
        ...prev,
        currentTier: newTier,
        currentWord: null,
        lastAnswerCorrect: null,
      }
    })

    // Load next word
    loadNextWord()
  }, [loadNextWord])

  /**
   * Reset the game.
   */
  const resetGame = React.useCallback(() => {
    setState(createInitialState(mode, inputMethod))
  }, [mode, inputMethod])

  /**
   * Play audio helpers.
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

  /**
   * Pause/resume (placeholder for multiplayer).
   */
  const pauseGame = React.useCallback(() => {
    // TODO: Implement pause logic
  }, [])

  const resumeGame = React.useCallback(() => {
    // TODO: Implement resume logic
  }, [])

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  /**
   * Auto-play word intro when entering "ready" phase.
   *
   * Uses word ID to prevent re-triggering on object reference changes.
   * The 1.5s delay allows "The word is [word]" to be spoken before
   * the timer starts.
   */
  const currentWordId = state.currentWord?.id
  React.useEffect(() => {
    if (state.phase === "ready" && currentWordId) {
      // Play word intro, then transition to playing
      if (state.currentWord) {
        playWordIntro(state.currentWord)
      }

      // Give time for audio to play before starting timer
      const timeout = setTimeout(() => {
        beginPlaying()
      }, 1500) // Approximate time for "The word is [word]"

      return () => clearTimeout(timeout)
    }
  }, [state.phase, currentWordId, state.currentWord, beginPlaying])

  /**
   * Auto-advance after feedback (with delay matching animation).
   */
  React.useEffect(() => {
    if (state.phase === "feedback") {
      const timeout = setTimeout(() => {
        nextWord()
      }, FEEDBACK_DURATION + 200) // Slight delay after animation

      return () => clearTimeout(timeout)
    }
  }, [state.phase, nextWord])

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const correctCount = state.answers.filter((a) => a.isCorrect).length
  const wrongCount = state.answers.filter((a) => !a.isCorrect).length
  const totalAnswers = state.answers.length
  const accuracy = totalAnswers > 0 ? Math.round((correctCount / totalAnswers) * 100) : 0

  const isActive = !["idle", "result"].includes(state.phase)
  const isGameOver = state.phase === "result"

  // XP calculation per PRD Section 15.2.2
  const xpEarned =
    state.mode === "endless"
      ? correctCount * 5 // +5 XP per round survived
      : state.blitzScore * 2 // +2 XP per correct word

  // ==========================================================================
  // RETURN
  // ==========================================================================

  const actions: GameActions = {
    startGame,
    submitAnswer,
    nextWord,
    handleTimeUp,
    resetGame,
    playWord,
    playSentence,
    playDefinition,
    pauseGame,
    resumeGame,
  }

  const computed = {
    correctCount,
    wrongCount,
    accuracy,
    isActive,
    isGameOver,
    xpEarned,
  }

  return { state, actions, computed }
}
