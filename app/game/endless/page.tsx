"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { TopNavbar } from "@/components/ui/top-navbar"
import { GameTimer } from "@/components/game/game-timer"
import { HeartsDisplay } from "@/components/game/hearts-display"
import { SpeechInput } from "@/components/ui/speech-input"
import { GameFeedbackOverlay } from "@/components/game/game-feedback-overlay"
import { VoiceWaveform } from "@/components/ui/voice-waveform"

import { useGameSession } from "@/hooks/use-game-session"
import { useGameTimer } from "@/hooks/use-game-timer"
import { useGameFeedback } from "@/hooks/use-game-feedback"
import { useGameSounds } from "@/hooks/use-game-sounds"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { formatTranscriptForDisplay } from "@/lib/answer-validation"

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
  // Game Session State
  // ---------------------------------------------------------------------------
  const { state: gameState, actions: gameActions, computed } = useGameSession(
    "endless",
    "voice"
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
  const { playCorrect, playWrong } = useGameSounds()

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
  } = useSpeechRecognition({ spellingMode: true })

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

    // Submit answer with timing data for anti-cheat validation
    // Priority: audio timing (from Google word timestamps) > letter timing (fallback)
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
    })
  }, [transcript, gameState.phase, stopRecording, gameActions])

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

  // Auto-start game on mount (only once)
  React.useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      gameActions.startGame()
    }
  }, [gameActions])

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

  // Navigate to results when game is over
  React.useEffect(() => {
    if (gameState.phase === "result") {
      // Small delay to show the final feedback
      const timeout = setTimeout(() => {
        router.push("/game/result")
      }, 800)
      return () => clearTimeout(timeout)
    }
  }, [gameState.phase, router])

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

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => clearHelperTimeout()
  }, [])

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const currentWord = gameState.currentWord

  // Transform raw transcript to display-friendly letter format
  // Shows "R-U-N" instead of "are you in" for better UX
  const displayTranscript = React.useMemo(
    () => formatTranscriptForDisplay(transcript),
    [transcript]
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
    </div>
  )
}
