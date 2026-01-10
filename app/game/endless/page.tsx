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
import { useVoiceRecorder } from "@/hooks/use-voice-recorder"

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
 * - useVoiceRecorder: Handles voice input and visualization
 *
 * @see PRD Section 4.1.1 — Endless Mode
 */
export default function EndlessGamePage() {
  const router = useRouter()

  // ---------------------------------------------------------------------------
  // Game Session State
  // ---------------------------------------------------------------------------
  const { state: gameState, actions: gameActions } = useGameSession(
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
  const {
    isRecording,
    startRecording,
    stopRecording,
    analyserNode,
    transcript,
  } = useVoiceRecorder()

  // ---------------------------------------------------------------------------
  // Local UI State
  // ---------------------------------------------------------------------------
  const [showDefinition, setShowDefinition] = React.useState(false)

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

  // Start timer when entering "playing" phase
  React.useEffect(() => {
    if (gameState.phase === "playing") {
      timer.restart(gameState.timerDuration)
    } else if (gameState.phase !== "ready") {
      timer.pause()
    }
  }, [gameState.phase, gameState.timerDuration, timer])

  // Show feedback overlay when answer is checked
  React.useEffect(() => {
    if (gameState.phase === "feedback" && gameState.lastAnswerCorrect !== null) {
      if (gameState.lastAnswerCorrect) {
        feedback.showCorrect()
        playCorrect()
      } else {
        feedback.showWrong()
        playWrong()
      }
    }
  }, [gameState.phase, gameState.lastAnswerCorrect, feedback, playCorrect, playWrong])

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

  // Reset definition display when word changes
  React.useEffect(() => {
    setShowDefinition(false)
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
    stopRecording()
    // Submit the transcript as the answer
    if (transcript) {
      gameActions.submitAnswer(transcript)
    }
  }

  const handlePlayWord = () => {
    gameActions.playWord()
  }

  const handlePlaySentence = () => {
    gameActions.playSentence()
  }

  const handlePlayDefinition = () => {
    setShowDefinition(true)
    gameActions.playDefinition()
  }

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const isPlaying = gameState.phase === "playing"
  const currentWord = gameState.currentWord

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
              Spell the word that you hear:
            </p>
          </div>

          {/* Voice Waveform + Hearts + Speech Input */}
          <div className="flex w-full flex-col items-center gap-2">
            {/* Voice Waveform - shows audio visualization when recording */}
            <VoiceWaveform
              analyserNode={isRecording ? analyserNode : null}
              className="mb-4"
            />

            {/* Hearts Display - positioned above SpeechInput per Figma (node 2582:22581) */}
            <HeartsDisplay
              remaining={gameState.hearts}
              total={3}
            />

            {/* Speech Input - without integrated waveform since we show it separately above */}
            <SpeechInput
              mode="voice"
              state={isRecording ? "recording" : "default"}
              inputText={transcript}
              definition={currentWord?.definition}
              dictionaryPressed={showDefinition}
              onRecordClick={handleRecordStart}
              onStopClick={handleRecordStop}
              onPlayClick={handlePlayWord}
              onDictionaryClick={handlePlayDefinition}
              onSentenceClick={handlePlaySentence}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
