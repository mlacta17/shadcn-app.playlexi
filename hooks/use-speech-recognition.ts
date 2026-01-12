"use client"

import * as React from "react"
import {
  getSpeechProvider,
  getSpeechProviderAsync,
  type SpeechRecognitionSession,
  type SpeechProvider,
  SPELLING_KEYWORDS,
} from "@/lib/speech-recognition-service"
import { extractLettersFromVoice } from "@/lib/answer-validation"

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

/**
 * Timing data for a single letter's appearance in the transcript.
 * Used to detect the rate at which letters accumulate.
 */
export interface LetterTiming {
  /** The letter that appeared */
  letter: string
  /** Timestamp when this letter first appeared */
  timestamp: number
  /** Time since the previous letter (ms), or 0 for first letter */
  gapFromPrevious: number
}

/**
 * Anti-cheat metrics returned when stopping recording.
 *
 * The key insight for detecting saying vs spelling:
 * - **Spelling "C-A-T"**: Letters appear gradually with gaps (200-400ms each)
 * - **Saying "cat"**: All letters appear at once (<100ms total)
 *
 * We track:
 * 1. When each NEW letter appears in the transcript
 * 2. The gaps between letter appearances
 * 3. Average gap - spelling has higher average gaps than saying
 */
export interface StopRecordingMetrics {
  /** Speech duration in milliseconds (first to last speech) */
  durationMs: number
  /** Number of interim results received (spelling = more results) */
  interimCount: number
  /**
   * Timing data for each letter as it appeared.
   * Spelling produces gradual accumulation, saying produces instant dump.
   */
  letterTimings: LetterTiming[]
  /**
   * Average gap between letter appearances (ms).
   * - Spelling: ~200-400ms average
   * - Saying: ~0-50ms average (letters arrive together)
   */
  averageLetterGapMs: number
  /**
   * Whether the pattern looks like spelling based on letter timing.
   * true = letters arrived gradually (spelling)
   * false = letters arrived all at once (saying)
   */
  looksLikeSpelling: boolean
}

export interface UseSpeechRecognitionReturn {
  /** Whether currently recording */
  isRecording: boolean
  /** Start recording */
  startRecording: () => Promise<void>
  /**
   * Stop recording and get anti-cheat metrics.
   * @returns Metrics object with duration and interim result count
   */
  stopRecording: () => StopRecordingMetrics
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
  /**
   * Number of interim results received during recording.
   * Used for anti-cheat: spelling produces more interim results than saying a word.
   *
   * Hypothesis:
   * - Spelling "C-A-T" → many interim results (letters recognized incrementally)
   * - Saying "cat" → fewer interim results (word recognized at once)
   */
  interimResultCount: number
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
  const [interimResultCount, setInterimResultCount] = React.useState(0)

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

  // Interim result count ref for anti-cheat
  // Spelling produces more interim results than saying a word
  const interimCountRef = React.useRef<number>(0)

  // Letter timing tracking for anti-cheat
  // We track when each NEW letter appears in the transcript
  // Spelling = letters appear gradually, Saying = letters appear all at once
  const letterTimingsRef = React.useRef<LetterTiming[]>([])
  const lastLetterCountRef = React.useRef<number>(0)

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
   * @returns Anti-cheat metrics including letter timing data
   */
  const cleanup = React.useCallback((): StopRecordingMetrics => {
    // Calculate SPEECH duration (not recording duration)
    // This is the time from first detected speech to last detected speech
    // Much more accurate for anti-cheat as it excludes silence
    let speechDuration = 0
    if (firstSpeechTimeRef.current > 0 && lastSpeechTimeRef.current > 0) {
      speechDuration = lastSpeechTimeRef.current - firstSpeechTimeRef.current
      setSpeechDurationMs(speechDuration)
    } else if (firstSpeechTimeRef.current > 0) {
      // Only first speech detected, use time until now
      speechDuration = Date.now() - firstSpeechTimeRef.current
      setSpeechDurationMs(speechDuration)
    }

    // Capture interim count before resetting
    const finalInterimCount = interimCountRef.current
    setInterimResultCount(finalInterimCount)

    // Capture letter timings
    const letterTimings = [...letterTimingsRef.current]

    // Calculate average gap between letters
    // Skip first letter (gap is 0), only count gaps between subsequent letters
    const gaps = letterTimings.slice(1).map((lt) => lt.gapFromPrevious)
    const averageLetterGapMs =
      gaps.length > 0 ? gaps.reduce((sum, g) => sum + g, 0) / gaps.length : 0

    // Determine if this looks like spelling based on letter timing
    // Thresholds based on testing:
    // - Spelling "C-A-T": gaps of 200-400ms, average ~250ms
    // - Saying "cat": gaps of 0-50ms (letters arrive together)
    //
    // We use 100ms as the threshold:
    // - Fast spellers still have ~150-200ms between letters
    // - Saying a word dumps all letters in <50ms
    const MIN_GAP_FOR_SPELLING = 100 // ms - minimum average gap to count as spelling
    const MIN_LETTERS_FOR_CHECK = 2 // Need at least 2 letters to check timing

    const looksLikeSpelling =
      letterTimings.length < MIN_LETTERS_FOR_CHECK || // Single letter = trust it
      averageLetterGapMs >= MIN_GAP_FOR_SPELLING // Multiple letters with gaps = spelling

    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Speech] Stopped: duration=${speechDuration}ms, interimResults=${finalInterimCount}, ` +
          `letters=${letterTimings.length}, avgGap=${averageLetterGapMs.toFixed(0)}ms, ` +
          `looksLikeSpelling=${looksLikeSpelling}`
      )
      if (letterTimings.length > 0) {
        console.log(
          `[Speech] Letter timings:`,
          letterTimings.map((lt) => `${lt.letter}(+${lt.gapFromPrevious}ms)`).join(" ")
        )
      }
    }

    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
    }

    // Reset all refs
    firstSpeechTimeRef.current = 0
    lastSpeechTimeRef.current = 0
    interimCountRef.current = 0
    letterTimingsRef.current = []
    lastLetterCountRef.current = 0
    setAnalyserNode(null)
    setIsRecording(false)

    return {
      durationMs: speechDuration,
      interimCount: finalInterimCount,
      letterTimings,
      averageLetterGapMs,
      looksLikeSpelling,
    }
  }, [])

  // Start recording
  const startRecording = React.useCallback(async () => {
    try {
      setError(null)
      setTranscript("")
      setSpeechDurationMs(0) // Reset duration for new recording
      setInterimResultCount(0) // Reset interim count for new recording
      lastInterimUpdateRef.current = 0
      // Reset speech timing refs
      firstSpeechTimeRef.current = 0
      lastSpeechTimeRef.current = 0
      interimCountRef.current = 0
      // Reset letter timing tracking
      letterTimingsRef.current = []
      lastLetterCountRef.current = 0

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

            // Count interim results for anti-cheat
            // Spelling produces more interim results than saying a word
            // because letters are recognized incrementally: "C" → "CA" → "CAT"
            interimCountRef.current++

            // ===============================================================
            // Letter Timing Tracking for Anti-Cheat
            // ===============================================================
            // Track when each NEW letter appears in the transcript.
            // Key insight:
            // - Spelling "C-A-T": letters appear one at a time with gaps
            // - Saying "cat": all letters appear at once
            //
            // Extract letters from the current transcript and check for new ones
            const currentLetters = extractLettersFromVoice(text)
            const previousLetterCount = lastLetterCountRef.current

            if (currentLetters.length > previousLetterCount) {
              // New letters appeared - track each one
              const previousTimestamp =
                letterTimingsRef.current.length > 0
                  ? letterTimingsRef.current[letterTimingsRef.current.length - 1].timestamp
                  : now

              // Add timing entries for each new letter
              for (let i = previousLetterCount; i < currentLetters.length; i++) {
                const letter = currentLetters[i]
                const gapFromPrevious = i === 0 ? 0 : now - previousTimestamp

                letterTimingsRef.current.push({
                  letter,
                  timestamp: now,
                  gapFromPrevious,
                })
              }

              lastLetterCountRef.current = currentLetters.length
            }
          }

          // Apply throttling if configured (reduces React re-renders)
          if (interimThrottleMs > 0) {
            if (now - lastInterimUpdateRef.current < interimThrottleMs) {
              return // Skip this update
            }
            lastInterimUpdateRef.current = now
          }

          if (process.env.NODE_ENV === "development") {
            console.log(`[Speech:${speechProvider.name}] interim #${interimCountRef.current}:`, text)
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

  // Stop recording - returns anti-cheat metrics for validation
  const stopRecording = React.useCallback((): StopRecordingMetrics => {
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
    interimResultCount,
  }
}
