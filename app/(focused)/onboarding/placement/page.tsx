"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { TopNavbar } from "@/components/ui/top-navbar"
import { GameTimer } from "@/components/game/game-timer"
import { SpeechInput } from "@/components/ui/speech-input"
import { GameFeedbackOverlay } from "@/components/game/game-feedback-overlay"
import { VoiceWaveform } from "@/components/ui/voice-waveform"

import { usePlacementSession } from "@/hooks/use-placement-session"
import { useGameTimer } from "@/hooks/use-game-timer"
import { useGameFeedback } from "@/hooks/use-game-feedback"
import { useGameSounds } from "@/hooks/use-game-sounds"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { formatTranscriptForDisplay } from "@/lib/answer-validation"

/**
 * Placement Test Page
 *
 * A calibration game that determines the user's initial rank.
 * Uses the same UI as the Endless game but without hearts/lives.
 *
 * ## Key Differences from Endless Mode
 * - No hearts display (mistakes don't end the game)
 * - Fixed number of rounds (10 words)
 * - Adaptive difficulty (tier adjusts per answer)
 * - Navigates to rank-result page when complete
 *
 * ## Flow
 * Tutorial → **Placement Test** → Rank Result → OAuth → Profile
 *
 * @see PRD Section 2.2.1 — Placement Test
 * @see Figma node 2377:33723
 */
export default function PlacementPage() {
  const router = useRouter()

  // ---------------------------------------------------------------------------
  // Placement Session State
  // ---------------------------------------------------------------------------
  const { state: placementState, actions: placementActions, computed } = usePlacementSession()

  // ---------------------------------------------------------------------------
  // Timer Hook
  // ---------------------------------------------------------------------------
  const timer = useGameTimer(placementState.timerDuration, {
    onTimeUp: placementActions.handleTimeUp,
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
  } = useSpeechRecognition({ spellingMode: true })

  // ---------------------------------------------------------------------------
  // Answer Submission Logic
  // ---------------------------------------------------------------------------
  const AUTO_SUBMIT_DELAY_MS = 1200
  const autoSubmitTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const hasSubmittedRef = React.useRef(false)

  const submitCurrentAnswer = React.useCallback(async () => {
    if (hasSubmittedRef.current) return
    if (!transcript) return
    if (placementState.phase !== "playing") return

    hasSubmittedRef.current = true

    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current)
      autoSubmitTimeoutRef.current = null
    }

    const metrics = await stopRecording()

    placementActions.submitAnswer(transcript, {
      audioTiming: {
        wordCount: metrics.audioWordCount,
        avgGapSec: metrics.avgAudioGapSec,
        looksLikeSpelling: metrics.looksLikeSpellingFromAudio,
      },
      letterTiming: {
        averageLetterGapMs: metrics.averageLetterGapMs,
        looksLikeSpelling: metrics.looksLikeSpelling,
        letterCount: metrics.letterTimings.length,
      },
    })
  }, [transcript, placementState.phase, stopRecording, placementActions])

  React.useEffect(() => {
    if (isRecording) {
      hasSubmittedRef.current = false
    }
  }, [isRecording])

  React.useEffect(() => {
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current)
      autoSubmitTimeoutRef.current = null
    }

    if (isRecording && transcript && placementState.phase === "playing") {
      autoSubmitTimeoutRef.current = setTimeout(() => {
        submitCurrentAnswer()
      }, AUTO_SUBMIT_DELAY_MS)
    }

    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current)
      }
    }
  }, [transcript, isRecording, placementState.phase, submitCurrentAnswer])

  // ---------------------------------------------------------------------------
  // Local UI State
  // ---------------------------------------------------------------------------
  const [activeHelper, setActiveHelper] = React.useState<
    "play" | "sentence" | "definition" | null
  >(null)

  const hasStartedRef = React.useRef(false)

  // ---------------------------------------------------------------------------
  // Effects: Coordinate placement phase with timer and feedback
  // ---------------------------------------------------------------------------

  // Auto-start placement on mount
  React.useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      placementActions.startPlacement()
    }
  }, [placementActions])

  // Timer refs for stability
  const timerRestartRef = React.useRef(timer.restart)
  const timerPauseRef = React.useRef(timer.pause)
  React.useEffect(() => {
    timerRestartRef.current = timer.restart
    timerPauseRef.current = timer.pause
  })

  // Start timer when entering playing phase
  React.useEffect(() => {
    if (placementState.phase === "playing") {
      timerRestartRef.current(placementState.timerDuration)
    } else if (placementState.phase !== "ready") {
      timerPauseRef.current()
    }
  }, [placementState.phase, placementState.timerDuration])

  // Feedback refs for stability
  const feedbackRef = React.useRef({ showCorrect: feedback.showCorrect, showWrong: feedback.showWrong })
  const soundsRef = React.useRef({ playCorrect, playWrong })
  React.useEffect(() => {
    feedbackRef.current = { showCorrect: feedback.showCorrect, showWrong: feedback.showWrong }
    soundsRef.current = { playCorrect, playWrong }
  })

  const hasPlayedFeedbackRef = React.useRef(false)

  // Show feedback overlay when answer is checked
  React.useEffect(() => {
    if (placementState.phase === "feedback" && placementState.lastAnswerCorrect !== null) {
      if (hasPlayedFeedbackRef.current) return
      hasPlayedFeedbackRef.current = true

      if (placementState.lastAnswerCorrect) {
        feedbackRef.current.showCorrect()
        soundsRef.current.playCorrect()
      } else {
        feedbackRef.current.showWrong()
        soundsRef.current.playWrong()
      }
    } else {
      hasPlayedFeedbackRef.current = false
    }
  }, [placementState.phase, placementState.lastAnswerCorrect])

  // Navigate to rank result when placement is complete
  React.useEffect(() => {
    if (placementState.phase === "complete") {
      const timeout = setTimeout(() => {
        router.push(`/onboarding/rank-result?tier=${computed.derivedTier}`)
      }, 800)
      return () => clearTimeout(timeout)
    }
  }, [placementState.phase, computed.derivedTier, router])

  // Reset helper state when word changes
  React.useEffect(() => {
    setActiveHelper(null)
  }, [placementState.currentWord?.id])

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    router.push("/")
  }

  const handleRecordStart = async () => {
    if (placementState.phase !== "playing") return
    await startRecording()
  }

  const handleRecordStop = () => {
    submitCurrentAnswer()
  }

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
    placementActions.playWord()
    helperTimeoutRef.current = setTimeout(() => setActiveHelper(null), 2500)
  }

  const handlePlaySentence = () => {
    clearHelperTimeout()
    setActiveHelper("sentence")
    placementActions.playSentence()
    helperTimeoutRef.current = setTimeout(() => setActiveHelper(null), 5000)
  }

  const handlePlayDefinition = () => {
    clearHelperTimeout()
    setActiveHelper("definition")
    placementActions.playDefinition()
  }

  React.useEffect(() => {
    return () => clearHelperTimeout()
  }, [])

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const currentWord = placementState.currentWord
  const displayTranscript = React.useMemo(
    () => formatTranscriptForDisplay(transcript),
    [transcript]
  )

  // Progress percentage for the timer bar (shows round progress, not time)
  const progressPercent = (placementState.currentRound / placementState.totalRounds) * 100

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-slot="placement-page"
      className="bg-background flex min-h-screen flex-col"
    >
      {/* Feedback Overlay */}
      <GameFeedbackOverlay
        type={feedback.feedbackType}
        isVisible={feedback.isShowing}
      />

      {/* Top Navigation */}
      <TopNavbar
        onClose={handleClose}
        centerContent="Game mode: Placement game"
        hideSkip
      />

      {/* Progress Bar - shows round progress */}
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
              Round {placementState.currentRound || 1}
            </h1>
            <p className="text-sm text-muted-foreground">
              {computed.isLoading ? "Loading next word..." : "Spell the word that you hear:"}
            </p>
          </div>

          {/* Voice Waveform + Speech Input (no hearts) */}
          <div className="flex w-full max-w-lg flex-col items-center gap-2">
            {/* Voice Waveform */}
            <VoiceWaveform
              analyserNode={isRecording ? analyserNode : null}
              className="mb-4"
            />

            {/* Speech Input (without hearts above it) */}
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
