"use client"

import * as React from "react"
import {
  getSpeechProvider,
  type ISpeechRecognitionProvider,
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
 * 1. Deepgram (if API key configured) — ~95% accuracy for spelling
 * 2. Web Speech API (fallback) — ~70-80% accuracy
 *
 * ## Features
 * - Real-time transcript updates
 * - Audio visualization via analyserNode
 * - Automatic keyword boosting for spelling
 * - Graceful fallback between providers
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
  } = options

  // State
  const [isRecording, setIsRecording] = React.useState(false)
  const [transcript, setTranscript] = React.useState("")
  const [analyserNode, setAnalyserNode] = React.useState<AnalyserNode | null>(null)
  const [error, setError] = React.useState<Error | null>(null)
  const [provider, setProvider] = React.useState<SpeechProvider | null>(null)

  // Refs
  const sessionRef = React.useRef<SpeechRecognitionSession | null>(null)
  const providerRef = React.useRef<ISpeechRecognitionProvider | null>(null)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const mediaStreamRef = React.useRef<MediaStream | null>(null)

  // Check if supported
  const isSupported = React.useMemo(() => {
    try {
      const speechProvider = getSpeechProvider()
      return speechProvider.isSupported()
    } catch {
      return false
    }
  }, [])

  // Cleanup function
  const cleanup = React.useCallback(() => {
    // Stop session
    if (sessionRef.current) {
      sessionRef.current.stop()
      sessionRef.current = null
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    setAnalyserNode(null)
    setIsRecording(false)
  }, [])

  // Start recording
  const startRecording = React.useCallback(async () => {
    try {
      setError(null)
      setTranscript("")

      // Get provider
      const speechProvider = getSpeechProvider()
      providerRef.current = speechProvider
      setProvider(speechProvider.name)

      // Debug: Log which provider is being used
      if (process.env.NODE_ENV === "development") {
        console.log(`[Speech] Using provider: ${speechProvider.name}`)
      }

      // Set up audio context for visualization
      // (We need our own media stream for the analyser)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      setAnalyserNode(analyser)

      // Start recognition session
      const session = await speechProvider.start({
        onInterimResult: (text) => {
          // Debug: Log raw interim transcripts from speech provider
          if (process.env.NODE_ENV === "development") {
            console.log(`[Speech:${speechProvider.name}] interim:`, text)
          }
          setTranscript(text)
        },
        onFinalResult: (text) => {
          // Debug: Log raw final transcripts from speech provider
          if (process.env.NODE_ENV === "development") {
            console.log(`[Speech:${speechProvider.name}] FINAL:`, text)
          }
          setTranscript(text)
          onTranscript?.(text)
        },
        onError: (err) => {
          setError(err)
          onError?.(err)
        },
        language,
        keywords: spellingMode ? SPELLING_KEYWORDS : undefined,
      })

      sessionRef.current = session
      setIsRecording(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start recording")
      setError(error)
      onError?.(error)
      cleanup()
    }
  }, [language, spellingMode, onTranscript, onError, cleanup])

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
