"use client"

import * as React from "react"
import {
  getSpeechProvider,
  type SpeechRecognitionSession,
  type SpeechProvider,
  SPELLING_KEYWORDS,
} from "@/lib/speech-recognition-service"

// =============================================================================
// TYPES
// =============================================================================

export interface UseSpeechRecognitionOptions {
  /** Callback when final transcript is ready */
  onTranscript?: (transcript: string) => void
  /** Callback when an error occurs */
  onError?: (error: Error) => void
  /** Language for speech recognition (default: "en-US") */
  language?: string
  /**
   * Enable spelling mode with keyword boosting.
   * When true, boosts recognition of letter names for better accuracy.
   * (default: true)
   */
  spellingMode?: boolean
  /**
   * Minimum interval between interim transcript updates in milliseconds.
   * Lower = more responsive, higher = less React re-renders.
   * Default: 0 (no throttling - instant updates)
   */
  interimThrottleMs?: number
}

export interface UseSpeechRecognitionReturn {
  /** Whether currently recording */
  isRecording: boolean
  /** Start recording */
  startRecording: () => Promise<void>
  /** Stop recording and get final transcript */
  stopRecording: () => void
  /** Current transcript (updated in real-time) */
  transcript: string
  /** Clear the transcript */
  clearTranscript: () => void
  /** The audio analyser node for visualization */
  analyserNode: AnalyserNode | null
  /** Whether speech recognition is supported */
  isSupported: boolean
  /** Which provider is being used */
  provider: SpeechProvider | null
  /** Any error that occurred */
  error: Error | null
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Speech recognition hook with provider abstraction.
 *
 * Automatically selects the best available provider:
 * 1. OpenAI Realtime (if API key configured) — ~98% accuracy for letters
 * 2. Deepgram (if API key configured) — ~95% accuracy for words
 * 3. Web Speech API (fallback) — ~70-80% accuracy
 *
 * ## Features
 * - Real-time transcript updates with optional throttling
 * - Audio visualization via analyserNode (shared with provider)
 * - Automatic keyword boosting for spelling
 * - Graceful fallback between providers
 * - Zero duplicate media streams (reuses provider's audio pipeline)
 *
 * ## Usage
 * ```tsx
 * function SpellingGame() {
 *   const {
 *     isRecording,
 *     startRecording,
 *     stopRecording,
 *     transcript,
 *     analyserNode,
 *     provider,
 *   } = useSpeechRecognition({
 *     onTranscript: (text) => submitAnswer(text),
 *     interimThrottleMs: 50, // Optional: throttle updates for performance
 *   })
 *
 *   return (
 *     <>
 *       <VoiceWaveform analyserNode={analyserNode} />
 *       <p>Using: {provider}</p>
 *       <p>Heard: {transcript}</p>
 *       <button onClick={isRecording ? stopRecording : startRecording}>
 *         {isRecording ? "Stop" : "Record"}
 *       </button>
 *     </>
 *   )
 * }
 * ```
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    onTranscript,
    onError,
    language = "en-US",
    spellingMode = true,
    interimThrottleMs = 0,
  } = options

  // State
  const [isRecording, setIsRecording] = React.useState(false)
  const [transcript, setTranscript] = React.useState("")
  const [analyserNode, setAnalyserNode] = React.useState<AnalyserNode | null>(null)
  const [error, setError] = React.useState<Error | null>(null)
  const [provider, setProvider] = React.useState<SpeechProvider | null>(null)

  // Refs for stable callback references (avoid stale closures)
  const sessionRef = React.useRef<SpeechRecognitionSession | null>(null)
  const lastInterimUpdateRef = React.useRef<number>(0)
  const onTranscriptRef = React.useRef(onTranscript)
  const onErrorRef = React.useRef(onError)

  // Keep refs in sync with latest callbacks (avoids re-creating session on callback change)
  React.useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
  }, [onTranscript, onError])

  // Check if supported
  const isSupported = React.useMemo(() => {
    try {
      const speechProvider = getSpeechProvider()
      return speechProvider.isSupported()
    } catch {
      return false
    }
  }, [])

  // Cleanup function - no longer needs to manage media stream or audio context
  // since the provider handles its own resources
  const cleanup = React.useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
    }

    setAnalyserNode(null)
    setIsRecording(false)
  }, [])

  // Start recording
  const startRecording = React.useCallback(async () => {
    try {
      setError(null)
      setTranscript("")
      lastInterimUpdateRef.current = 0

      // Get provider (singleton, so this is fast)
      const speechProvider = getSpeechProvider()
      setProvider(speechProvider.name)

      if (process.env.NODE_ENV === "development") {
        console.log(`[Speech] Using provider: ${speechProvider.name}`)
      }

      // Start recognition session
      // Note: Callbacks use refs to avoid stale closures and unnecessary re-renders
      const session = await speechProvider.start({
        onInterimResult: (text) => {
          // Apply throttling if configured (reduces React re-renders)
          if (interimThrottleMs > 0) {
            const now = Date.now()
            if (now - lastInterimUpdateRef.current < interimThrottleMs) {
              return // Skip this update
            }
            lastInterimUpdateRef.current = now
          }

          if (process.env.NODE_ENV === "development") {
            console.log(`[Speech:${speechProvider.name}] interim:`, text)
          }
          setTranscript(text)
        },
        onFinalResult: (text) => {
          if (process.env.NODE_ENV === "development") {
            console.log(`[Speech:${speechProvider.name}] FINAL:`, text)
          }
          setTranscript(text)
          // Use ref for stable callback reference
          onTranscriptRef.current?.(text)
        },
        onError: (err) => {
          setError(err)
          // Use ref for stable callback reference
          onErrorRef.current?.(err)
        },
        language,
        keywords: spellingMode ? SPELLING_KEYWORDS : undefined,
      })

      sessionRef.current = session
      setIsRecording(true)

      // Use the provider's shared analyserNode if available
      // This eliminates the need for a duplicate media stream
      if (session.analyserNode) {
        setAnalyserNode(session.analyserNode)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start recording")
      setError(error)
      onErrorRef.current?.(error)
      cleanup()
    }
  }, [language, spellingMode, interimThrottleMs, cleanup])

  // Stop recording
  const stopRecording = React.useCallback(() => {
    cleanup()
  }, [cleanup])

  // Clear transcript
  const clearTranscript = React.useCallback(() => {
    setTranscript("")
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    isRecording,
    startRecording,
    stopRecording,
    transcript,
    clearTranscript,
    analyserNode,
    isSupported,
    provider,
    error,
  }
}
