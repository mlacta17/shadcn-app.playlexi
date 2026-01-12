"use client"

import * as React from "react"
import {
  getSpeechProvider,
  getSpeechProviderAsync,
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
  /**
   * Stop recording and get final transcript.
   * @returns The speech duration in milliseconds (time from first to last speech detected)
   */
  stopRecording: () => number
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
  /**
   * Duration of actual speech in the last recording (milliseconds).
   * Measured from FIRST interim result to LAST interim result.
   * This is more accurate for anti-cheat than total recording duration,
   * as it excludes silence before/after speech.
   *
   * Example:
   * - Saying "smile": ~400-600ms of speech
   * - Spelling "S-M-I-L-E": ~2000-3000ms of speech
   */
  speechDurationMs: number
  /**
   * Get the current speech duration without stopping.
   * @returns Duration in milliseconds, or 0 if no speech detected yet
   */
  getCurrentSpeechDuration: () => number
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Speech recognition hook with provider abstraction.
 *
 * Automatically selects the best available provider:
 * 1. Azure Speech Services (if configured) — ~95-98% accuracy with phrase list boosting
 * 2. OpenAI Realtime (if API key configured) — good WER but semantic interpretation
 * 3. Deepgram (if API key configured) — ~95% accuracy for words
 * 4. Web Speech API (fallback) — ~70-80% accuracy
 *
 * ## Features
 * - Real-time transcript updates with optional throttling
 * - Audio visualization via analyserNode (shared with provider)
 * - Automatic keyword boosting for spelling (Azure phrase lists, Deepgram keywords)
 * - Graceful fallback between providers
 * - Zero duplicate media streams (reuses provider's audio pipeline)
 * - Async provider detection (Azure requires token endpoint check)
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
  const [speechDurationMs, setSpeechDurationMs] = React.useState(0)

  // Refs for stable callback references (avoid stale closures)
  const sessionRef = React.useRef<SpeechRecognitionSession | null>(null)
  const lastInterimUpdateRef = React.useRef<number>(0)
  const onTranscriptRef = React.useRef(onTranscript)
  const onErrorRef = React.useRef(onError)

  // Speech timing refs for anti-cheat
  // We track when FIRST speech was detected and when LAST speech was detected
  // This gives us actual speaking time, not recording time (which includes silence)
  const firstSpeechTimeRef = React.useRef<number>(0)
  const lastSpeechTimeRef = React.useRef<number>(0)

  // Keep refs in sync with latest callbacks (avoids re-creating session on callback change)
  React.useEffect(() => {
    onTranscriptRef.current = onTranscript
    onErrorRef.current = onError
  }, [onTranscript, onError])

  // Check if supported - at minimum, sync providers are always checked
  // Azure support is determined at startRecording time via getSpeechProviderAsync
  const isSupported = React.useMemo(() => {
    try {
      // This checks sync providers (OpenAI, Deepgram, WebSpeech)
      // Azure is always "supported" in browsers - actual availability
      // is determined when we fetch the token endpoint
      const speechProvider = getSpeechProvider()
      return speechProvider.isSupported()
    } catch {
      // Even if sync providers fail, Azure might still be available
      // Return true to allow the async check in startRecording
      return true
    }
  }, [])

  /**
   * Get the current speech duration without stopping.
   * Returns time from first detected speech to now (or last speech).
   */
  const getCurrentSpeechDuration = React.useCallback((): number => {
    if (firstSpeechTimeRef.current <= 0) return 0
    const endTime = lastSpeechTimeRef.current > 0 ? lastSpeechTimeRef.current : Date.now()
    return endTime - firstSpeechTimeRef.current
  }, [])

  /**
   * Cleanup function - stops recording and releases resources.
   * @returns The speech duration in milliseconds (first speech to last speech)
   */
  const cleanup = React.useCallback((): number => {
    // Calculate SPEECH duration (not recording duration)
    // This is the time from first detected speech to last detected speech
    // Much more accurate for anti-cheat as it excludes silence
    let speechDuration = 0
    if (firstSpeechTimeRef.current > 0 && lastSpeechTimeRef.current > 0) {
      speechDuration = lastSpeechTimeRef.current - firstSpeechTimeRef.current
      setSpeechDurationMs(speechDuration)

      if (process.env.NODE_ENV === "development") {
        console.log(`[Speech] Speech duration: ${speechDuration}ms (first to last speech)`)
      }
    } else if (firstSpeechTimeRef.current > 0) {
      // Only first speech detected, use time until now
      speechDuration = Date.now() - firstSpeechTimeRef.current
      setSpeechDurationMs(speechDuration)

      if (process.env.NODE_ENV === "development") {
        console.log(`[Speech] Speech duration: ${speechDuration}ms (first speech to now)`)
      }
    }

    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
    }

    // Reset all timing refs
    firstSpeechTimeRef.current = 0
    lastSpeechTimeRef.current = 0
    setAnalyserNode(null)
    setIsRecording(false)

    return speechDuration
  }, [])

  // Start recording
  const startRecording = React.useCallback(async () => {
    try {
      setError(null)
      setTranscript("")
      setSpeechDurationMs(0) // Reset duration for new recording
      lastInterimUpdateRef.current = 0
      // Reset speech timing refs
      firstSpeechTimeRef.current = 0
      lastSpeechTimeRef.current = 0

      // Get provider using async version to properly check Azure availability
      // Azure requires an async check because it needs to verify the token endpoint
      const speechProvider = await getSpeechProviderAsync()
      setProvider(speechProvider.name)

      if (process.env.NODE_ENV === "development") {
        console.log(`[Speech] Using provider: ${speechProvider.name}`)
      }

      // Start recognition session
      // Note: Callbacks use refs to avoid stale closures and unnecessary re-renders
      const session = await speechProvider.start({
        onInterimResult: (text) => {
          const now = Date.now()

          // Track speech timing for anti-cheat
          // First speech = when we first detect any text
          // Last speech = every time we get new text (updates continuously)
          if (text && text.length > 0) {
            if (firstSpeechTimeRef.current === 0) {
              firstSpeechTimeRef.current = now
              if (process.env.NODE_ENV === "development") {
                console.log(`[Speech] First speech detected at ${now}`)
              }
            }
            lastSpeechTimeRef.current = now
          }

          // Apply throttling if configured (reduces React re-renders)
          if (interimThrottleMs > 0) {
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
          // Update last speech time on final result too
          if (text && text.length > 0) {
            lastSpeechTimeRef.current = Date.now()
          }

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

  // Stop recording - returns duration for anti-cheat validation
  const stopRecording = React.useCallback((): number => {
    return cleanup()
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
    speechDurationMs,
    getCurrentSpeechDuration,
  }
}
