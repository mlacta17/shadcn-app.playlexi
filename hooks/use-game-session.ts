"use client"

/**
 * Game Session Hook — PlayLexi
 *
 * Central state management for spelling game sessions (Endless & Blitz modes).
 *
 * ## File Structure (771 lines)
 *
 * | Lines | Section | Purpose |
 * |-------|---------|---------|
 * | 1-113 | Types | GamePhase, GameState, AnswerRecord interfaces |
 * | 114-178 | More Types | SubmitAnswerOptions, GameActions, Return type |
 * | 179-251 | Constants | INITIAL_HEARTS, FEEDBACK_DURATION, createInitialState |
 * | 252-320 | Hook JSDoc | Architecture diagram, usage examples |
 * | 321-470 | Core Actions | loadNextWord, startGame, beginPlaying |
 * | 471-557 | Submit Logic | submitAnswer with anti-cheat integration |
 * | 558-682 | Other Actions | handleTimeUp, nextWord, resetGame, audio helpers |
 * | 683-723 | Effects | Auto-play word intro, auto-advance after feedback |
 * | 724-771 | Computed + Return | correctCount, accuracy, isGameOver, etc. |
 *
 * ## Why One Large File?
 *
 * This hook is intentionally kept as a single file because:
 *
 * 1. **State machine visibility**: All 7 phases and transitions in one place
 * 2. **Ref patterns**: Refs prevent stale closures — splitting would complicate this
 * 3. **Testing**: One file = one test file with clear boundaries
 * 4. **Onboarding**: New devs see the complete flow without jumping between files
 *
 * The complexity is **inherent** (game logic is complex), not **accidental**
 * (poor organization). Extracting a state machine library (XState) was considered
 * but rejected as the current pattern works and is well-understood.
 *
 * ## Related Files
 *
 * - app/(focused)/game/endless/page.tsx — Consumes this hook
 * - hooks/use-game-timer.ts — Timer logic (separate hook)
 * - hooks/use-game-feedback.ts — Overlay logic (separate hook)
 * - hooks/use-speech-recognition.ts — Voice input (separate hook)
 *
 * @see PRD Section 4 — Game Modes
 * @see ADR-012 — Hidden Skill Rating System
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
import { fetchRandomWord, type FetchWordOptions } from "@/lib/word-fetcher"
import {
  validateAnswer,
  isEmptyAnswer,
  type InputMode,
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
 * idle → loading → ready → playing → checking → feedback → (loading | result)
 *            ↑                                       ↓
 *            └───────────────────────────────────────┘
 * ```
 *
 * | Phase | Description |
 * |-------|-------------|
 * | idle | Game not started, waiting for player action |
 * | loading | Fetching word from API (shows loading indicator) |
 * | ready | Word loaded, about to play audio intro |
 * | playing | Player is spelling (timer running) |
 * | checking | Answer submitted, validating |
 * | feedback | Showing correct/wrong overlay |
 * | result | Game over, showing final stats |
 */
export type GamePhase =
  | "idle"
  | "loading"
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
 * Includes timing data for voice anti-cheat detection.
 */
export interface SubmitAnswerOptions {
  /**
   * Letter timing data for voice mode anti-cheat (transcript-based).
   * Less reliable due to provider buffering - use audioTiming instead.
   */
  letterTiming?: {
    averageLetterGapMs: number
    looksLikeSpelling: boolean
    letterCount: number
  }
  /**
   * Audio-level timing data for voice mode anti-cheat (more reliable).
   * Based on actual audio timestamps from Google Speech, not transcript arrival.
   *
   * This is the PRIMARY anti-cheat signal:
   * - Spelling "C-A-T": Multiple word segments with gaps in audio
   * - Saying "cat": Single continuous word segment
   */
  audioTiming?: {
    wordCount: number
    avgGapSec: number
    looksLikeSpelling: boolean
  }
  /**
   * User-specific phonetic mappings learned from gameplay.
   * Takes priority over global SPOKEN_LETTER_NAMES for personalized recognition.
   * Map format: heard → intended (e.g., "ah" → "a")
   */
  userMappings?: Map<string, string>
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
    /** Longest streak of consecutive correct answers in this game */
    longestStreak: number
    /** Whether the game is active (not idle or result) */
    isActive: boolean
    /** Whether the game is over */
    isGameOver: boolean
    /** Whether a word is currently being loaded */
    isLoading: boolean
    /** XP earned (calculated based on mode) */
    xpEarned: number
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Starting hearts for Endless mode (per PRD) */
const INITIAL_HEARTS = 3

/** Default starting tier for new players (used when no user tier provided) */
const DEFAULT_INITIAL_TIER: WordTier = 1

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
  inputMethod: InputMethod,
  initialTier: WordTier = DEFAULT_INITIAL_TIER
): GameState {
  return {
    phase: "idle",
    mode,
    inputMethod,
    currentRound: 0,
    hearts: mode === "endless" ? INITIAL_HEARTS : 0,
    currentWord: null,
    currentTier: initialTier,
    timerDuration: getTimerDuration(initialTier, inputMethod),
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
/**
 * Options for configuring the game session.
 */
export interface UseGameSessionOptions {
  /**
   * Initial tier for word difficulty.
   * Should be the user's current skill tier from their profile.
   * Defaults to tier 1 if not provided.
   */
  initialTier?: WordTier
}

export function useGameSession(
  mode: GameMode,
  inputMethod: InputMethod,
  options?: UseGameSessionOptions
): UseGameSessionReturn {
  const initialTier = options?.initialTier ?? DEFAULT_INITIAL_TIER

  // Store the initial tier in a ref so it persists across re-renders
  // and is accessible in startGame() even if options change
  const initialTierRef = React.useRef<WordTier>(initialTier)

  // Update ref when initialTier changes (e.g., when user tier loads)
  React.useEffect(() => {
    initialTierRef.current = initialTier
  }, [initialTier])

  const [state, setState] = React.useState<GameState>(() =>
    createInitialState(mode, inputMethod, initialTier)
  )

  // Track time when word was presented (for time tracking)
  const wordStartTimeRef = React.useRef<number>(0)

  // Track used word IDs in a ref for immediate (synchronous) updates.
  // This prevents race conditions when loadNextWord is called multiple times
  // before state updates propagate.
  const usedWordIdsRef = React.useRef<Set<string>>(new Set())

  // Track the last word ID for anti-repeat safeguard
  const lastWordIdRef = React.useRef<string | undefined>(undefined)

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  /**
   * Load the next word and transition to ready phase.
   *
   * This is now async to support fetching words from the D1 database.
   * The function:
   * 1. Sets phase to "loading" (shows loading UI)
   * 2. Fetches word from API or mock data
   * 3. Sets phase to "ready" with the new word
   *
   * @see lib/word-fetcher.ts for the data source abstraction
   */
  /**
   * Load the next word and transition to ready phase.
   *
   * @param tierOverride - Optional tier to use instead of reading from state.
   *                       Use this when the tier was just updated in setState
   *                       but the update hasn't been applied yet due to batching.
   */
  const loadNextWord = React.useCallback(async (tierOverride?: WordTier) => {
    // Capture current values for the async fetch
    // Use ref for usedWordIds to prevent race conditions when this function
    // is called multiple times before state updates propagate
    let currentTier: WordTier = tierOverride ?? initialTierRef.current
    let currentInputMethod: InputMethod = "voice"

    // IMPORTANT: setState callback runs synchronously, but we need to capture
    // the values BEFORE the await, so this pattern works correctly
    setState((prev) => {
      // Read tier from state if not overridden, but only if state has a valid tier
      // Otherwise fall back to the initialTierRef
      if (tierOverride === undefined) {
        currentTier = prev.currentTier
      }
      currentInputMethod = prev.inputMethod
      return { ...prev, phase: "loading" as const }
    })

    // Get used word IDs from the ref (synchronously updated, race-condition safe)
    const usedWordIds = Array.from(usedWordIdsRef.current)

    // Debug: Log what we're fetching
    console.log(`[GameSession] loadNextWord - tier=${currentTier}, usedWordIds.length=${usedWordIds.length}`)

    // Build fetch options with anti-repeat and adaptive mixing
    // Enable adaptive mixing for skilled players (tier 3+) to keep gameplay varied
    const fetchOptions: FetchWordOptions = {
      excludeIds: usedWordIds,
      lastWordId: lastWordIdRef.current,
      enableAdaptiveMixing: currentTier >= 3,
    }

    // Fetch word asynchronously with enhanced options
    const result = await fetchRandomWord(currentTier, fetchOptions)

    if (!result.success) {
      setState((prev) => ({
        ...prev,
        error: result.error,
        phase: "result" as const,
      }))
      return
    }

    const word = result.word
    const timerDuration = getTimerDuration(word.tier, currentInputMethod)

    // DEFENSIVE CHECK: Warn if we received a duplicate word
    if (usedWordIdsRef.current.has(word.id)) {
      console.warn(`[GameSession] ⚠️ DUPLICATE WORD DETECTED: "${word.word}" (id=${word.id}) was already used!`)
      console.warn(`[GameSession] Current usedWordIds:`, Array.from(usedWordIdsRef.current))
    }

    // Add word ID to ref IMMEDIATELY (prevents duplicates on concurrent calls)
    usedWordIdsRef.current.add(word.id)

    // Update last word ID for anti-repeat safeguard
    lastWordIdRef.current = word.id

    // Debug: Log the word we received and current ref state
    console.log(`[GameSession] Received word: "${word.word}" (id=${word.id}), usedWordIdsRef now has ${usedWordIdsRef.current.size} entries`)

    // Update state with the loaded word
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
   * Start a new game.
   */
  const startGame = React.useCallback(async () => {
    // Clear used word IDs ref and last word ID for the new game
    usedWordIdsRef.current.clear()
    lastWordIdRef.current = undefined

    // Use the tier from the ref (updated when options.initialTier changes)
    const tierToUse = initialTierRef.current

    console.log(`[GameSession] startGame - using tier ${tierToUse}`)

    setState((prev) => ({
      ...createInitialState(prev.mode, prev.inputMethod, tierToUse),
      phase: "idle",
    }))

    // Small delay then load first word with the correct tier
    await new Promise((resolve) => setTimeout(resolve, 100))
    await loadNextWord(tierToUse)
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
   * Uses letter timing detection to prevent cheating:
   * - Spelling "C-A-T": Letters appear gradually (200-400ms gaps)
   * - Saying "cat": All letters appear at once (<100ms total)
   *
   * This approach doesn't punish fast spellers while catching cheaters.
   *
   * @param answer - The player's answer (transcript or typed text)
   * @param options - Optional settings including letter timing for anti-cheat
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

        // Validate the answer with timing data for anti-cheat
        // Priority: audio timing (more reliable) > letter timing (fallback)
        // Also pass user-specific phonetic mappings for personalized recognition
        const inputMode: InputMode = prev.inputMethod
        const result = validateAnswer(answer, prev.currentWord.word, inputMode, {
          letterTiming: options?.letterTiming,
          audioTiming: options?.audioTiming,
          userMappings: options?.userMappings,
        })
        const isCorrect = result.isCorrect

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
  const nextWord = React.useCallback(async () => {
    // Start with the current tier from ref (will be updated from state if available)
    let newTierForFetch: WordTier = initialTierRef.current

    setState((prev) => {
      if (prev.phase !== "feedback") return prev

      // Progress tier in Endless mode (every few rounds)
      let newTier = prev.currentTier
      if (prev.mode === "endless" && prev.lastAnswerCorrect) {
        // Increase tier every 3 correct answers (simplified)
        const correctCount = prev.answers.filter((a) => a.isCorrect).length
        if (correctCount > 0 && correctCount % 3 === 0 && newTier < 7) {
          newTier = (newTier + 1) as WordTier
          console.log(`[GameSession] Tier increasing from ${prev.currentTier} to ${newTier} (correctCount=${correctCount})`)
        }
      }

      // Capture the new tier for the fetch (due to state batching,
      // loadNextWord needs this passed explicitly)
      newTierForFetch = newTier

      return {
        ...prev,
        currentTier: newTier,
        currentWord: null,
        lastAnswerCorrect: null,
      }
    })

    // Load next word with the new tier (pass explicitly to avoid state batching issues)
    await loadNextWord(newTierForFetch)
  }, [loadNextWord])

  /**
   * Reset the game.
   */
  const resetGame = React.useCallback(() => {
    usedWordIdsRef.current.clear()
    lastWordIdRef.current = undefined
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

  // Calculate longest streak of consecutive correct answers
  // Iterate through answers in order to find the longest run
  let longestStreak = 0
  let currentStreak = 0
  for (const answer of state.answers) {
    if (answer.isCorrect) {
      currentStreak++
      longestStreak = Math.max(longestStreak, currentStreak)
    } else {
      currentStreak = 0
    }
  }

  const isActive = !["idle", "result"].includes(state.phase)
  const isGameOver = state.phase === "result"
  const isLoading = state.phase === "loading"

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
    longestStreak,
    isActive,
    isGameOver,
    isLoading,
    xpEarned,
  }

  return { state, actions, computed }
}
