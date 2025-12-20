"use client"

import * as React from "react"

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

export interface UseVoiceRecorderOptions {
  /** Callback when speech is recognized */
  onTranscript?: (transcript: string) => void
  /** Callback when an error occurs */
  onError?: (error: Error) => void
  /** Language for speech recognition (default: "en-US") */
  language?: string
  /** Whether to use continuous recognition (default: false) */
  continuous?: boolean
}

export interface UseVoiceRecorderReturn {
  /** Whether currently recording */
  isRecording: boolean
  /** Start recording */
  startRecording: () => Promise<void>
  /** Stop recording */
  stopRecording: () => void
  /** The audio analyser node for visualization */
  analyserNode: AnalyserNode | null
  /** Current transcript from speech recognition */
  transcript: string
  /** Whether speech recognition is supported */
  isSupported: boolean
  /** Any error that occurred */
  error: Error | null
}

/**
 * Custom hook for voice recording with speech recognition.
 * Provides both audio visualization data (via analyserNode) and speech-to-text.
 *
 * @example
 * ```tsx
 * const { isRecording, startRecording, stopRecording, analyserNode, transcript } = useVoiceRecorder({
 *   onTranscript: (text) => console.log("User said:", text),
 * })
 *
 * // Pass analyserNode to VoiceWaveform for visualization
 * <VoiceWaveform analyserNode={analyserNode} />
 * ```
 */
export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const { onTranscript, onError, language = "en-US", continuous = false } = options

  const [isRecording, setIsRecording] = React.useState(false)
  const [analyserNode, setAnalyserNode] = React.useState<AnalyserNode | null>(null)
  const [transcript, setTranscript] = React.useState("")
  const [error, setError] = React.useState<Error | null>(null)

  // Refs for cleanup
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const recognitionRef = React.useRef<SpeechRecognition | null>(null)

  // Check if speech recognition is supported
  const isSupported = React.useMemo(() => {
    if (typeof window === "undefined") return false
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }, [])

  // Cleanup function
  const cleanup = React.useCallback(() => {
    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    setAnalyserNode(null)
  }, [])

  // Start recording
  const startRecording = React.useCallback(async () => {
    try {
      setError(null)
      setTranscript("")

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up audio context and analyser for visualization
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.7

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      setAnalyserNode(analyser)

      // Set up speech recognition
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI()
        recognition.lang = language
        recognition.continuous = continuous
        recognition.interimResults = true

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const results = Array.from(event.results)
          const latestResult = results[results.length - 1]

          if (latestResult) {
            const text = latestResult[0].transcript
            setTranscript(text)

            // Only call onTranscript for final results
            if (latestResult.isFinal && onTranscript) {
              onTranscript(text)
            }
          }
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          const err = new Error(`Speech recognition error: ${event.error}`)
          setError(err)
          onError?.(err)
        }

        recognition.onend = () => {
          // Restart if still recording and continuous mode
          if (isRecording && continuous && recognitionRef.current) {
            recognitionRef.current.start()
          }
        }

        recognitionRef.current = recognition
        recognition.start()
      }

      setIsRecording(true)
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start recording")
      setError(error)
      onError?.(error)
      cleanup()
    }
  }, [language, continuous, onTranscript, onError, cleanup, isRecording])

  // Stop recording
  const stopRecording = React.useCallback(() => {
    setIsRecording(false)
    cleanup()
  }, [cleanup])

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
    analyserNode,
    transcript,
    isSupported,
    error,
  }
}

// TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor
    webkitSpeechRecognition: SpeechRecognitionConstructor
  }
}
