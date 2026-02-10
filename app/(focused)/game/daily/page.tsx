"use client"

/**
 * Daily Spell Game Page — PlayLexi
 *
 * The main gameplay page for Daily Spell mode where players:
 * 1. Hear each of the 5 daily words
 * 2. Spell each word using voice only
 * 3. Get feedback (correct/wrong)
 * 4. Complete all 5 words (no hearts/lives)
 *
 * ## Differences from Endless Mode
 *
 * | Aspect | Endless | Daily Spell |
 * |--------|---------|-------------|
 * | Rounds | Infinite | Fixed 5 |
 * | Hearts | 3 lives | None |
 * | Input | Voice or keyboard | Voice only |
 * | Words | Random by tier | Fixed daily puzzle |
 * | End flow | → Results | → Streak → Results |
 *
 * ## Layout
 * - TopNavbar with close button and "Daily Spell" center text
 * - GameTimer (progress bar) below navbar
 * - Round title "Round X of 5"
 * - VoiceWaveform visualization
 * - SpeechInput with helper buttons (no hearts)
 *
 * @see hooks/use-daily-spell-session.ts for state management
 * @see Daily Spell feature spec
 */

import * as React from "react"
import { useRouter } from "next/navigation"

import { TopNavbar } from "@/components/ui/top-navbar"
import { GameTimer } from "@/components/game/game-timer"
import { SpeechInput } from "@/components/ui/speech-input"
import { GameFeedbackOverlay } from "@/components/game/game-feedback-overlay"
import { VoiceWaveform } from "@/components/ui/voice-waveform"
import { PhoneticDebugPanel } from "@/components/debug/phonetic-debug-panel"

import { useDailySpellSession } from "@/hooks/use-daily-spell-session"
import { useGameTimer } from "@/hooks/use-game-timer"
import { useGameFeedback } from "@/hooks/use-game-feedback"
import { useGameSounds } from "@/hooks/use-game-sounds"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { usePhoneticLearning } from "@/hooks/use-phonetic-learning"
import { formatTranscriptForDisplay, extractLettersFromVoice } from "@/lib/answer-validation"
import { showErrorToast } from "@/lib/toast-utils"

export default function DailySpellGamePage() {
  const router = useRouter()

  // ---------------------------------------------------------------------------
  // Daily Spell Session State
  // ---------------------------------------------------------------------------
  const { state: gameState, actions: gameActions, computed } = useDailySpellSession()

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
  const {
    isRecording,
    startRecording,
    stopRecording,
    analyserNode,
    transcript,
  } = useSpeechRecognition({
    spellingMode: true,
    onError: (error) => {
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
  const { logAnswer, triggerLearning, fetchMappings, userMappings, userId } = usePhoneticLearning()

  // Debug panel refresh trigger
  const [debugRefreshTrigger, setDebugRefreshTrigger] = React.useState(0)

  // ---------------------------------------------------------------------------
  // Answer Submission Logic
  // ---------------------------------------------------------------------------
  const AUTO_SUBMIT_DELAY_MS = 1200
  const autoSubmitTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const hasSubmittedRef = React.useRef(false)
  const lastSubmittedTranscriptRef = React.useRef<string | null>(null)

  const submitCurrentAnswer = React.useCallback(async () => {
    if (hasSubmittedRef.current) return
    if (!transcript) return
    if (gameState.phase !== "playing") return

    hasSubmittedRef.current = true

    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current)
      autoSubmitTimeoutRef.current = null
    }

    const metrics = await stopRecording()
    lastSubmittedTranscriptRef.current = transcript

    gameActions.submitAnswer(transcript, {
      audioTiming: {
        wordCount: metrics.audioWordCount,
        avgGapSec: metrics.avgAudioGapSec,
        looksLikeSpelling: metrics.looksLikeSpellingFromAudio,
      },
      userMappings,
    })
  }, [transcript, gameState.phase, stopRecording, gameActions, userMappings])

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

    if (isRecording && transcript && gameState.phase === "playing") {
      autoSubmitTimeoutRef.current = setTimeout(() => {
        submitCurrentAnswer()
      }, AUTO_SUBMIT_DELAY_MS)
    }

    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current)
      }
    }
  }, [transcript, isRecording, gameState.phase, submitCurrentAnswer])

  // ---------------------------------------------------------------------------
  // Local UI State
  // ---------------------------------------------------------------------------
  const [activeHelper, setActiveHelper] = React.useState<
    "play" | "sentence" | "definition" | null
  >(null)

  const hasStartedRef = React.useRef(false)

  // ---------------------------------------------------------------------------
  // Effects: Game Lifecycle
  // ---------------------------------------------------------------------------

  // Auto-start game on mount
  React.useEffect(() => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true
      fetchMappings()
      gameActions.startGame()
    }
  }, [gameActions, fetchMappings])

  // Store timer methods in refs
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

  // Store feedback/sound methods in refs
  const feedbackRef = React.useRef({ showCorrect: feedback.showCorrect, showWrong: feedback.showWrong })
  const soundsRef = React.useRef({ playCorrect, playWrong })
  React.useEffect(() => {
    feedbackRef.current = { showCorrect: feedback.showCorrect, showWrong: feedback.showWrong }
    soundsRef.current = { playCorrect, playWrong }
  })

  const hasPlayedFeedbackRef = React.useRef(false)

  // Show feedback overlay when answer is checked
  React.useEffect(() => {
    if (gameState.phase === "feedback" && gameState.lastAnswerCorrect !== null) {
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
      hasPlayedFeedbackRef.current = false
    }
  }, [gameState.phase, gameState.lastAnswerCorrect])

  // ---------------------------------------------------------------------------
  // Phonetic Learning: Log Recognition Event
  // ---------------------------------------------------------------------------
  const lastLoggedWordIdRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (gameState.phase !== "feedback") return
    if (gameState.lastAnswerCorrect === null) return
    if (!gameState.currentWord) return

    if (lastLoggedWordIdRef.current === gameState.currentWord.id) return
    lastLoggedWordIdRef.current = gameState.currentWord.id

    const rawTranscript = lastSubmittedTranscriptRef.current
    if (!rawTranscript) return

    const extractedLetters = extractLettersFromVoice(rawTranscript, userMappings)

    logAnswer({
      wordToSpell: gameState.currentWord.word,
      googleTranscript: rawTranscript,
      extractedLetters,
      wasCorrect: gameState.lastAnswerCorrect,
    })

    setDebugRefreshTrigger((prev) => prev + 1)
  }, [
    gameState.phase,
    gameState.lastAnswerCorrect,
    gameState.currentWord,
    logAnswer,
    userMappings,
  ])

  // ---------------------------------------------------------------------------
  // Game End: Navigate to Streak Page
  // ---------------------------------------------------------------------------
  const hasHandledEndRef = React.useRef(false)
  const navigationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const computedRef = React.useRef(computed)
  const gameStateRef = React.useRef(gameState)

  React.useEffect(() => {
    computedRef.current = computed
    gameStateRef.current = gameState
  })

  React.useEffect(() => {
    if (gameState.phase !== "complete") {
      hasHandledEndRef.current = false
      return
    }

    if (hasHandledEndRef.current) return
    hasHandledEndRef.current = true

    // Trigger phonetic learning analysis
    triggerLearning()

    // Navigate to streak page after brief delay
    navigationTimeoutRef.current = setTimeout(() => {
      const currentComputed = computedRef.current
      const currentState = gameStateRef.current

      // Build URL params for streak page
      const params = new URLSearchParams({
        puzzleId: currentState.puzzleId || "",
        puzzleNumber: String(currentState.puzzleNumber || 0),
        score: String(currentComputed.score),
        emojiRow: currentComputed.emojiRow,
      })

      router.push(`/game/daily/streak?${params.toString()}`)
    }, 800)
  }, [gameState.phase, triggerLearning, router])

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
    unlockSounds()
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
    gameActions.playWord()
    helperTimeoutRef.current = setTimeout(() => setActiveHelper(null), 2500)
  }

  const handlePlaySentence = () => {
    clearHelperTimeout()
    setActiveHelper("sentence")
    gameActions.playSentence()
    helperTimeoutRef.current = setTimeout(() => setActiveHelper(null), 5000)
  }

  const handlePlayDefinition = () => {
    clearHelperTimeout()
    setActiveHelper("definition")
    gameActions.playDefinition()
  }

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      clearHelperTimeout()
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const currentWord = gameState.currentWord
  const displayTranscript = React.useMemo(
    () => formatTranscriptForDisplay(transcript, userMappings),
    [transcript, userMappings]
  )

  // ---------------------------------------------------------------------------
  // Already Played State
  // ---------------------------------------------------------------------------

  if (gameState.alreadyPlayed) {
    // Redirect to results if already played today
    React.useEffect(() => {
      const params = new URLSearchParams({
        puzzleId: gameState.puzzleId || "",
        puzzleNumber: String(gameState.puzzleNumber || 0),
        score: String(computed.score),
        emojiRow: computed.emojiRow,
      })
      router.replace(`/game/daily/result?${params.toString()}`)
    }, [gameState.puzzleId, gameState.puzzleNumber, computed.score, computed.emojiRow, router])

    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Redirecting to your results...</div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-slot="daily-spell-game-page"
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
        centerContent="Daily Spell"
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
              {computed.progressText}
            </h1>
            <p className="text-sm text-muted-foreground">
              {computed.isLoading ? "Loading today's puzzle..." : "Spell the word that you hear:"}
            </p>
          </div>

          {/* Voice Waveform + Speech Input (no hearts for Daily Spell) */}
          <div className="flex w-full max-w-lg flex-col items-center gap-2">
            {/* Voice Waveform */}
            <VoiceWaveform
              analyserNode={isRecording ? analyserNode : null}
              className="mb-4"
            />

            {/* Speech Input - voice only, no hearts */}
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
