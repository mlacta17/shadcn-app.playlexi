"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { TopNavbar } from "@/components/ui/top-navbar"
import { GameTimer } from "@/components/game/game-timer"
import { HeartsDisplay } from "@/components/game/hearts-display"
import { SpeechInput } from "@/components/ui/speech-input"
import { GameFeedbackOverlay } from "@/components/game/game-feedback-overlay"
import { VoiceWaveform } from "@/components/ui/voice-waveform"
import { PhoneticDebugPanel } from "@/components/debug/phonetic-debug-panel"

import { useGameSession } from "@/hooks/use-game-session"
import { useGameTimer } from "@/hooks/use-game-timer"
import { useGameFeedback } from "@/hooks/use-game-feedback"
import { useGameSounds } from "@/hooks/use-game-sounds"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { usePhoneticLearning } from "@/hooks/use-phonetic-learning"
import { useUserTier } from "@/hooks/use-user-tier"
import { useGamePersistence } from "@/hooks/use-game-persistence"
import { formatTranscriptForDisplay, extractLettersFromVoice } from "@/lib/answer-validation"
import { showErrorToast, showWarningToast } from "@/lib/toast-utils"

/**
 * Endless Mode Game Screen
 *
 * The main gameplay page for Endless mode where players:
 * 1. Listen to a word being spoken
 * 2. Spell the word using voice or keyboard
 * 3. Get feedback (correct/wrong)
 * 4. Advance to the next round or lose a heart
 *
 * ## Layout (per Figma design node 2364:41588)
 * - TopNavbar with close button and "Game mode: Endless" center text
 * - GameTimer (progress bar) below navbar
 * - Round title and instruction
 * - VoiceWaveform visualization
 * - HeartsDisplay (3 hearts above SpeechInput)
 * - SpeechInput with helper buttons
 *
 * ## State Management
 * - useGameSession: Owns all game state (round, hearts, words, phase)
 * - useGameTimer: Manages per-word countdown
 * - useGameFeedback: Manages correct/wrong overlay
 * - useGameSounds: Plays feedback sounds
 * - useSpeechRecognition: Handles voice input and visualization
 *
 * @see PRD Section 4.1.1 — Endless Mode
 */
export default function EndlessGamePage() {
  const router = useRouter()

  // ---------------------------------------------------------------------------
  // User Tier (for word difficulty matching)
  // ---------------------------------------------------------------------------
  // Fetch user's skill tier to select appropriate difficulty words.
  // Falls back to tier 1 if user is not logged in or fetch fails.
  const { tier: userTier, isLoading: isTierLoading } = useUserTier("endless_voice")

  // ---------------------------------------------------------------------------
  // Game Session State
  // ---------------------------------------------------------------------------
  // Pass user's tier to ensure word difficulty matches their skill level
  const { state: gameState, actions: gameActions, computed } = useGameSession(
    "endless",
    "voice",
    { initialTier: userTier }
  )

  // ---------------------------------------------------------------------------
  // Timer Hook
  // ---------------------------------------------------------------------------
  const timer = useGameTimer(gameState.timerDuration, {
    onTimeUp: gameActions.handleTimeUp,
    autoStart: false,
  })

  // ---------------------------------------------------------------------------
  // Feedback Hook
  // ---------------------------------------------------------------------------
  const feedback = useGameFeedback()

  // ---------------------------------------------------------------------------
  // Sound Effects
  // ---------------------------------------------------------------------------
  const { playCorrect, playWrong, unlock: unlockSounds } = useGameSounds()

  // ---------------------------------------------------------------------------
  // Voice Recording
  // ---------------------------------------------------------------------------
  // Uses provider abstraction: Google Cloud Speech (~95%+) > Web Speech API (fallback)
  // Google is selected automatically if speech server is running (npm run dev:speech)
  const {
    isRecording,
    startRecording,
    stopRecording, // Returns duration in ms for anti-cheat
    analyserNode,
    transcript,
    error: speechError,
  } = useSpeechRecognition({
    spellingMode: true,
    onError: (error) => {
      // Show toast for speech recognition errors
      showErrorToast(error.message || "Microphone error", {
        action: {
          label: "Retry",
          onClick: () => startRecording(),
        },
      })
    },
  })

  // ---------------------------------------------------------------------------
  // Phonetic Learning Integration
  // ---------------------------------------------------------------------------
  // Logs voice recognition events for the adaptive learning system.
  // This is fire-and-forget — errors don't affect gameplay.
  // Also provides userMappings for personalized phonetic recognition.
  const { logAnswer, triggerLearning, fetchMappings, userMappings, userId } = usePhoneticLearning()

  // Debug panel refresh trigger - increments on each answer to refresh stats
  const [debugRefreshTrigger, setDebugRefreshTrigger] = React.useState(0)

  // ---------------------------------------------------------------------------
  // Game Persistence
  // ---------------------------------------------------------------------------
  // Saves game results to the server when game ends.
  // This awards XP and records game history.
  const { saveGame } = useGamePersistence()

  // ---------------------------------------------------------------------------
  // Answer Submission Logic
  // ---------------------------------------------------------------------------
  // Two ways to submit:
  // 1. Auto-submit: After 1.2s of silence (debounced)
  // 2. Manual submit: Press "Stop" button anytime
  //
  // The auto-submit timer resets whenever new speech is detected.
  // Manual submit cancels any pending auto-submit.

  /** How long to wait after last speech before auto-submitting */
  const AUTO_SUBMIT_DELAY_MS = 1200

  /** Ref to track the auto-submit timeout */
  const autoSubmitTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  /** Ref to track if we've already submitted (prevents double-submit) */
  const hasSubmittedRef = React.useRef(false)

  /** Ref to track the last submitted transcript (for logging) */
  const lastSubmittedTranscriptRef = React.useRef<string | null>(null)

  /**
   * Submit the current answer.
   * Called by both auto-submit and manual Stop button.
   * Idempotent - safe to call multiple times.
   *
   * Uses letter timing for anti-cheat:
   * - Spelling "C-A-T": Letters appear gradually (200-400ms gaps)
   * - Saying "cat": All letters appear at once (<100ms total)
   * - If letters arrived too fast, answer is rejected
   */
  const submitCurrentAnswer = React.useCallback(async () => {
    // Prevent double-submission
    if (hasSubmittedRef.current) return
    if (!transcript) return
    if (gameState.phase !== "playing") return

    hasSubmittedRef.current = true

    // Clear any pending auto-submit
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current)
      autoSubmitTimeoutRef.current = null
    }

    // Stop recording and wait for FINAL result (with word timing)
    // This is critical for anti-cheat: we MUST wait for the final result
    // because word timing data only arrives with the final recognition result
    const metrics = await stopRecording()

    // Store transcript for logging after validation
    lastSubmittedTranscriptRef.current = transcript

    // Submit answer with timing data for anti-cheat validation
    // Priority: audio timing (from Google word timestamps) > letter timing (fallback)
    // Also pass user-specific phonetic mappings for personalized recognition
    gameActions.submitAnswer(transcript, {
      // PRIMARY: Audio-level timing from speech provider (more reliable)
      audioTiming: {
        wordCount: metrics.audioWordCount,
        avgGapSec: metrics.avgAudioGapSec,
        looksLikeSpelling: metrics.looksLikeSpellingFromAudio,
      },
      // FALLBACK: Transcript-based timing (less reliable due to provider buffering)
      letterTiming: {
        averageLetterGapMs: metrics.averageLetterGapMs,
        looksLikeSpelling: metrics.looksLikeSpelling,
        letterCount: metrics.letterTimings.length,
      },
      // User-specific phonetic mappings for personalized recognition
      userMappings,
    })
  }, [transcript, gameState.phase, stopRecording, gameActions, userMappings])

  /**
   * Reset submission state when starting a new recording.
   */
  React.useEffect(() => {
    if (isRecording) {
      hasSubmittedRef.current = false
    }
  }, [isRecording])

  /**
   * Auto-submit effect: Start timer when transcript changes.
   * Timer resets on each new transcript (debounce pattern).
   */
  React.useEffect(() => {
    // Clear existing timer
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current)
      autoSubmitTimeoutRef.current = null
    }

    // Only start timer if actively recording with a transcript
    if (isRecording && transcript && gameState.phase === "playing") {
      autoSubmitTimeoutRef.current = setTimeout(() => {
        submitCurrentAnswer()
      }, AUTO_SUBMIT_DELAY_MS)
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current)
      }
    }
  }, [transcript, isRecording, gameState.phase, submitCurrentAnswer])

  // ---------------------------------------------------------------------------
  // Local UI State
  // ---------------------------------------------------------------------------

  /**
   * Track which helper button is currently "pressed" (audio playing).
   * Only one can be active at a time. Auto-clears after audio duration.
   *
   * - "play": Word is being spoken
   * - "sentence": Word is being used in a sentence
   * - "definition": Definition is shown (and optionally read aloud)
   * - null: No helper active
   */
  const [activeHelper, setActiveHelper] = React.useState<
    "play" | "sentence" | "definition" | null
  >(null)

  // Track if game has been started (prevents double-start in StrictMode)
  const hasStartedRef = React.useRef(false)

  // ---------------------------------------------------------------------------
  // Effects: Coordinate game phase with timer and feedback
  // ---------------------------------------------------------------------------

  // Auto-start game once tier is loaded (only once)
  // Also fetch user's phonetic mappings for personalized recognition
  React.useEffect(() => {
    // Wait for user tier to load before starting game
    // This ensures word difficulty matches user's skill level
    if (isTierLoading) return
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      // Fetch user mappings in parallel with game start
      fetchMappings()
      gameActions.startGame()
    }
  }, [gameActions, fetchMappings, isTierLoading])

  // Store timer methods in refs to avoid dependency array issues during HMR
  const timerRestartRef = React.useRef(timer.restart)
  const timerPauseRef = React.useRef(timer.pause)
  React.useEffect(() => {
    timerRestartRef.current = timer.restart
    timerPauseRef.current = timer.pause
  })

  // Start timer when entering "playing" phase
  React.useEffect(() => {
    if (gameState.phase === "playing") {
      timerRestartRef.current(gameState.timerDuration)
    } else if (gameState.phase !== "ready") {
      timerPauseRef.current()
    }
  }, [gameState.phase, gameState.timerDuration])

  // Store feedback/sound methods in refs to prevent double-firing
  const feedbackRef = React.useRef({ showCorrect: feedback.showCorrect, showWrong: feedback.showWrong })
  const soundsRef = React.useRef({ playCorrect, playWrong })
  React.useEffect(() => {
    feedbackRef.current = { showCorrect: feedback.showCorrect, showWrong: feedback.showWrong }
    soundsRef.current = { playCorrect, playWrong }
  })

  // Track if feedback has been played for current phase (prevents double-fire in StrictMode)
  const hasPlayedFeedbackRef = React.useRef(false)

  // Show feedback overlay when answer is checked
  // Uses refs to ensure sound/feedback only fires once per phase change
  React.useEffect(() => {
    if (gameState.phase === "feedback" && gameState.lastAnswerCorrect !== null) {
      // Guard against double-firing (React StrictMode or HMR)
      if (hasPlayedFeedbackRef.current) return
      hasPlayedFeedbackRef.current = true

      if (gameState.lastAnswerCorrect) {
        feedbackRef.current.showCorrect()
        soundsRef.current.playCorrect()
      } else {
        feedbackRef.current.showWrong()
        soundsRef.current.playWrong()
      }
    } else {
      // Reset guard when phase changes away from feedback
      hasPlayedFeedbackRef.current = false
    }
  }, [gameState.phase, gameState.lastAnswerCorrect])

  // ---------------------------------------------------------------------------
  // Phonetic Learning: Log Recognition Event
  // ---------------------------------------------------------------------------
  // Tracks the last logged word ID to prevent double-logging
  const lastLoggedWordIdRef = React.useRef<string | null>(null)

  // Log voice answers for phonetic learning (fire-and-forget)
  React.useEffect(() => {
    // Only log during feedback phase with voice input
    if (gameState.phase !== "feedback") return
    if (gameState.inputMethod !== "voice") return
    if (gameState.lastAnswerCorrect === null) return
    if (!gameState.currentWord) return

    // Prevent double-logging
    if (lastLoggedWordIdRef.current === gameState.currentWord.id) return
    lastLoggedWordIdRef.current = gameState.currentWord.id

    const rawTranscript = lastSubmittedTranscriptRef.current
    if (!rawTranscript) return

    // Extract letters to log what we extracted (use userMappings for consistency)
    const extractedLetters = extractLettersFromVoice(rawTranscript, userMappings)

    // Fire-and-forget logging
    logAnswer({
      wordToSpell: gameState.currentWord.word,
      googleTranscript: rawTranscript,
      extractedLetters,
      wasCorrect: gameState.lastAnswerCorrect,
    })

    // Trigger debug panel refresh
    setDebugRefreshTrigger((prev) => prev + 1)
  }, [
    gameState.phase,
    gameState.inputMethod,
    gameState.lastAnswerCorrect,
    gameState.currentWord,
    logAnswer,
    userMappings,
  ])

  // ---------------------------------------------------------------------------
  // Game End: Save Results & Navigate
  // ---------------------------------------------------------------------------
  // Track if we've already handled game end (prevent double-fire)
  const hasHandledEndRef = React.useRef(false)

  // Store navigation timeout ref so cleanup doesn't kill it prematurely
  const navigationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // Capture computed values in refs for stable dependency
  const computedRef = React.useRef(computed)
  const gameStateRef = React.useRef(gameState)
  React.useEffect(() => {
    computedRef.current = computed
    gameStateRef.current = gameState
  })

  React.useEffect(() => {
    // Only trigger on phase change to "result"
    // Using gameState.phase specifically (not full gameState object) prevents
    // the effect from re-running on unrelated state changes which was causing
    // the cleanup function to clear the navigation timeout prematurely
    if (gameState.phase !== "result") {
      hasHandledEndRef.current = false
      return
    }

    if (hasHandledEndRef.current) return
    hasHandledEndRef.current = true

    // Trigger phonetic learning analysis (fire-and-forget)
    triggerLearning()

    // Save game results to server (fire-and-forget)
    // Use refs to get current values without adding them to dependencies
    saveGame({ state: gameStateRef.current, computed: computedRef.current })

    // Navigate to results after a brief delay
    // Store in ref so subsequent effect runs don't clear it
    navigationTimeoutRef.current = setTimeout(() => {
      // Get current computed values from ref
      const currentComputed = computedRef.current
      const currentState = gameStateRef.current

      // Build URL params with all game stats
      const params = new URLSearchParams({
        mode: "endless",
        input: "voice",
        rounds: String(currentState.currentRound),
        accuracy: String(currentComputed.accuracy),
        correct: String(currentComputed.correctCount),
        wrong: String(currentComputed.wrongCount),
        streak: String(currentComputed.longestStreak),
      })

      router.push(`/game/result?${params.toString()}`)
    }, 800)

    // Don't return cleanup - we WANT the navigation to complete
    // even if the component re-renders. The timeout is fire-and-forget.
  }, [gameState.phase, triggerLearning, saveGame, router])

  // ---------------------------------------------------------------------------
  // Error State Notifications
  // ---------------------------------------------------------------------------
  // Show warning toast when game ends due to an error (not regular game over)
  React.useEffect(() => {
    if (gameState.phase === "result" && gameState.error) {
      showWarningToast("Game ended due to an error. Your progress has been saved.")
    }
  }, [gameState.phase, gameState.error])

  // Reset helper state when word changes
  React.useEffect(() => {
    setActiveHelper(null)
  }, [gameState.currentWord?.id])

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    // TODO: Show confirmation dialog before leaving mid-game
    router.push("/")
  }

  const handleRecordStart = async () => {
    if (gameState.phase !== "playing") return
    // Unlock sounds on first user interaction (required by browser autoplay policy)
    unlockSounds()
    await startRecording()
  }

  const handleRecordStop = () => {
    // Use the shared submission function (handles cleanup + prevents double-submit)
    submitCurrentAnswer()
  }

  /**
   * Helper button handlers.
   *
   * Each handler:
   * 1. Cancels any pending auto-clear timeout (prevents glitching)
   * 2. Sets the active helper state (shows footer message)
   * 3. Triggers the audio playback
   * 4. Auto-clears after estimated speech duration
   *
   * Speech Synthesis timing varies, but we estimate:
   * - Word: ~2 seconds ("The word is [word]")
   * - Sentence: ~4-6 seconds (full sentence)
   * - Definition: stays visible (not auto-cleared)
   */
  const helperTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const clearHelperTimeout = () => {
    if (helperTimeoutRef.current) {
      clearTimeout(helperTimeoutRef.current)
      helperTimeoutRef.current = null
    }
  }

  const handlePlayWord = () => {
    clearHelperTimeout()
    setActiveHelper("play")
    gameActions.playWord()
    // Clear after estimated speech duration
    helperTimeoutRef.current = setTimeout(() => setActiveHelper(null), 2500)
  }

  const handlePlaySentence = () => {
    clearHelperTimeout()
    setActiveHelper("sentence")
    gameActions.playSentence()
    // Clear after estimated speech duration (sentences are longer)
    helperTimeoutRef.current = setTimeout(() => setActiveHelper(null), 5000)
  }

  const handlePlayDefinition = () => {
    clearHelperTimeout()
    // Definition stays visible until user dismisses or word changes
    setActiveHelper("definition")
    gameActions.playDefinition()
  }

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      clearHelperTimeout()
      // Also clear navigation timeout if component unmounts before navigation
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const currentWord = gameState.currentWord

  // Transform raw transcript to display-friendly letter format
  // Shows "R-U-N" instead of "are you in" for better UX
  // Uses user-specific phonetic mappings for personalized display
  const displayTranscript = React.useMemo(
    () => formatTranscriptForDisplay(transcript, userMappings),
    [transcript, userMappings]
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-slot="endless-game-page"
      className="bg-background flex min-h-screen flex-col"
    >
      {/* Feedback Overlay (renders on top of everything) */}
      <GameFeedbackOverlay
        type={feedback.feedbackType}
        isVisible={feedback.isShowing}
      />

      {/* Top Navigation */}
      <TopNavbar
        onClose={handleClose}
        centerContent="Game mode: Endless"
        hideSkip
      />

      {/* Timer Progress Bar */}
      <GameTimer
        totalSeconds={timer.totalSeconds}
        remainingSeconds={timer.remainingSeconds}
      />

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center overflow-hidden p-6">
        <div className="flex w-full max-w-3xl flex-1 flex-col items-center gap-10 py-4">
          {/* Round Title and Instruction */}
          <div className="flex w-full flex-col items-center gap-2 text-center">
            <h1 className="text-3xl font-bold text-card-foreground">
              Round {gameState.currentRound || 1}
            </h1>
            <p className="text-sm text-muted-foreground">
              {computed.isLoading ? "Loading next word..." : "Spell the word that you hear:"}
            </p>
          </div>

          {/* Voice Waveform + Hearts + Speech Input */}
          <div className="flex w-full max-w-lg flex-col items-center gap-2">
            {/* Voice Waveform - shows audio visualization when recording */}
            <VoiceWaveform
              analyserNode={isRecording ? analyserNode : null}
              className="mb-4"
            />

            {/* Hearts Display - left-aligned above SpeechInput per Figma (node 2582:22581) */}
            <HeartsDisplay
              remaining={gameState.hearts}
              total={3}
              className="self-start"
            />

            {/* Speech Input - without integrated waveform since we show it separately above */}
            {/* Uses displayTranscript to show interpreted letters (e.g., "R-U-N") instead of raw speech */}
            {/* Disabled during loading to prevent interaction while fetching */}
            <SpeechInput
              mode="voice"
              state={computed.isLoading ? "default" : isRecording ? "recording" : "default"}
              inputText={computed.isLoading ? "" : displayTranscript}
              definition={currentWord?.definition}
              playPressed={activeHelper === "play"}
              sentencePressed={activeHelper === "sentence"}
              dictionaryPressed={activeHelper === "definition"}
              onRecordClick={computed.isLoading ? undefined : handleRecordStart}
              onStopClick={handleRecordStop}
              onPlayClick={computed.isLoading ? undefined : handlePlayWord}
              onDictionaryClick={computed.isLoading ? undefined : handlePlayDefinition}
              onSentenceClick={computed.isLoading ? undefined : handlePlaySentence}
            />
          </div>
        </div>
      </main>

      {/* Phonetic Debug Panel (development only) */}
      <PhoneticDebugPanel userId={userId} refreshTrigger={debugRefreshTrigger} />
    </div>
  )
}
