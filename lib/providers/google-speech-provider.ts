/**
 * Google Cloud Speech-to-Text Provider (WebSocket Streaming)
 *
 * Real-time speech recognition using Google Cloud Speech-to-Text API
 * via a dedicated WebSocket server.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                          Browser                                        │
 * │                                                                         │
 * │  GoogleSpeechProvider                                                   │
 * │         │                                                               │
 * │         │ WebSocket (ws://localhost:3002)                               │
 * │         │ - Audio: Binary frames (LINEAR16, 16kHz)                      │
 * │         │ - Results: JSON messages                                      │
 * │         ▼                                                               │
 * │  Speech Server (Node.js)                                                │
 * │         │                                                               │
 * │         │ gRPC (bidirectional streaming)                                │
 * │         ▼                                                               │
 * │  Google Cloud Speech-to-Text                                            │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Why WebSocket + Separate Server?
 *
 * 1. **Next.js limitation**: App Router doesn't support WebSockets
 * 2. **Google requires gRPC**: Streaming API uses gRPC, not REST
 * 3. **Real-time feedback**: ~100-250ms latency vs ~500-800ms with polling
 *
 * ## Setup
 *
 * 1. Start the speech server: `npm run dev:speech`
 * 2. Start Next.js: `npm run dev`
 * 3. Or run both: `npm run dev:all`
 *
 * @see /speech-server/README.md for server documentation
 */

import type {
  ISpeechRecognitionProvider,
  SpeechRecognitionConfig,
  SpeechRecognitionSession,
  SpeechProvider,
  WordTimingData,
} from "../speech-recognition-service"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * WebSocket server URL.
 * In production, this would be an environment variable.
 */
const SPEECH_SERVER_URL =
  typeof window !== "undefined"
    ? `ws://${window.location.hostname}:3002`
    : "ws://localhost:3002"

/**
 * Audio capture settings for LINEAR16 format.
 */
const AUDIO_CONFIG = {
  sampleRate: 16000, // 16kHz as required by Google
  channelCount: 1, // Mono
  chunkIntervalMs: 100, // Send audio every 100ms for low latency
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Messages received from the speech server.
 */
interface ServerMessage {
  type: "ready" | "interim" | "final" | "error"
  transcript?: string
  stability?: number
  words?: Array<{ word: string; startTime: number; endTime: number }>
  confidence?: number
  message?: string
  timestamp?: number
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Clean transcript text for spelling comparison.
 */
function cleanTranscript(text: string): string {
  return text
    .replace(/[.,!?;:'"]/g, "")
    .trim()
}

/**
 * Convert Float32Array audio to LINEAR16 Int16Array.
 * Google Speech requires LINEAR16 (signed 16-bit PCM).
 */
function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to [-1, 1] and convert to 16-bit signed integer
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16Array
}

// =============================================================================
// GOOGLE SPEECH PROVIDER
// =============================================================================

/**
 * Google Cloud Speech-to-Text provider using WebSocket streaming.
 *
 * This provider connects to a dedicated WebSocket server that handles
 * the gRPC streaming to Google's Speech API. This enables true real-time
 * recognition with ~100-250ms latency.
 *
 * @implements ISpeechRecognitionProvider
 */
export class GoogleSpeechProvider implements ISpeechRecognitionProvider {
  name: SpeechProvider = "google" as SpeechProvider

  /**
   * Check if Google Speech is available.
   * Requires WebSocket support and audio APIs.
   */
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof WebSocket !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia !== "undefined" &&
      typeof AudioContext !== "undefined"
    )
  }

  /**
   * Start a speech recognition session.
   *
   * Establishes a WebSocket connection to the speech server and streams
   * audio in real-time for recognition.
   */
  async start(config: SpeechRecognitionConfig): Promise<SpeechRecognitionSession> {
    const {
      onInterimResult,
      onFinalResult,
      onWordTiming,
      onError,
      language = "en-US",
    } = config

    // State management
    let isActive = true
    let isClosed = false
    let ws: WebSocket | null = null
    let mediaStream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let analyserNode: AnalyserNode | null = null
    let scriptProcessor: ScriptProcessorNode | null = null
    let lastTranscript = ""

    /**
     * Cleanup all resources safely.
     */
    const cleanup = () => {
      if (isClosed) return
      isClosed = true
      isActive = false

      // Close WebSocket
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "stop" }))
            ws.close()
          }
        } catch {
          // Ignore
        }
        ws = null
      }

      // Stop audio processing
      if (scriptProcessor) {
        try {
          scriptProcessor.disconnect()
        } catch {
          // Ignore
        }
        scriptProcessor = null
      }

      // Stop analyser
      if (analyserNode) {
        try {
          analyserNode.disconnect()
        } catch {
          // Ignore
        }
      }

      // Close audio context
      if (audioContext && audioContext.state !== "closed") {
        try {
          audioContext.close()
        } catch {
          // Ignore
        }
        audioContext = null
      }

      // Stop media stream
      if (mediaStream) {
        try {
          mediaStream.getTracks().forEach((track) => track.stop())
        } catch {
          // Ignore
        }
        mediaStream = null
      }
    }

    try {
      // Connect to WebSocket server
      ws = new WebSocket(SPEECH_SERVER_URL)

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout. Is the speech server running? (npm run dev:speech)"))
        }, 5000)

        ws!.onopen = () => {
          clearTimeout(timeout)
          if (process.env.NODE_ENV === "development") {
            console.log("[Google] WebSocket connected")
          }
          resolve()
        }

        ws!.onerror = () => {
          clearTimeout(timeout)
          reject(new Error("Failed to connect to speech server. Run 'npm run dev:speech' to start it."))
        }
      })

      // Set up message handler
      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data)

          switch (message.type) {
            case "ready":
              if (process.env.NODE_ENV === "development") {
                console.log("[Google] Server ready")
              }
              break

            case "interim":
              if (message.transcript && message.transcript !== lastTranscript) {
                lastTranscript = message.transcript
                const text = cleanTranscript(message.transcript)
                if (process.env.NODE_ENV === "development") {
                  console.log(`[Google] interim: "${text}" (stability: ${message.stability?.toFixed(2) || "?"})`)
                }
                onInterimResult?.(text)
              }
              break

            case "final":
              if (message.transcript) {
                const text = cleanTranscript(message.transcript)
                if (process.env.NODE_ENV === "development") {
                  console.log(`[Google] FINAL: "${text}" (${message.words?.length || 0} words)`)
                }

                // Process word timing for anti-cheat
                if (message.words && message.words.length > 0 && onWordTiming) {
                  const wordTimings: WordTimingData[] = message.words.map((w) => ({
                    word: w.word,
                    start: w.startTime,
                    end: w.endTime,
                    confidence: message.confidence || 0.9,
                  }))

                  // Attach anti-cheat metadata
                  const timingWithMetadata = wordTimings as (WordTimingData & {
                    _lexical?: string
                    _isSpelledOut?: boolean
                  })[]

                  // Determine if this looks like spelling
                  const wordCount = wordTimings.length
                  const letterCount = text.replace(/\s/g, "").length
                  const isLikelySpelled = wordCount >= letterCount * 0.7 && wordCount > 1
                  const singleLetterWords = wordTimings.filter((w) => w.word.length === 1).length
                  const hasMostlySingleLetters = singleLetterWords >= wordCount * 0.5
                  const isSpelledOut = isLikelySpelled || hasMostlySingleLetters

                  if (timingWithMetadata.length > 0) {
                    timingWithMetadata[0]._isSpelledOut = isSpelledOut
                    timingWithMetadata[0]._lexical = message.words.map((w) => w.word).join(" ")
                  }

                  if (process.env.NODE_ENV === "development") {
                    console.log(
                      `[Google] Anti-cheat: wordCount=${wordCount}, letterCount=${letterCount}, ` +
                      `singleLetterWords=${singleLetterWords}, isSpelledOut=${isSpelledOut}`
                    )
                  }

                  onWordTiming(wordTimings)
                }

                onFinalResult?.(text)
              }
              break

            case "error":
              console.error("[Google] Server error:", message.message)
              onError?.(new Error(message.message || "Recognition error"))
              break
          }
        } catch (err) {
          console.error("[Google] Failed to parse message:", err)
        }
      }

      ws.onerror = (event) => {
        console.error("[Google] WebSocket error:", event)
        onError?.(new Error("WebSocket error"))
      }

      ws.onclose = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[Google] WebSocket closed")
        }
        if (isActive) {
          // Unexpected close
          onError?.(new Error("WebSocket connection closed unexpectedly"))
        }
      }

      // Send start message with language
      ws.send(JSON.stringify({ type: "start", language }))

      // Get microphone stream
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: AUDIO_CONFIG.channelCount,
          sampleRate: AUDIO_CONFIG.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // Create audio context with target sample rate
      audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate })
      const source = audioContext.createMediaStreamSource(mediaStream)

      // Create analyser for visualization
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.6
      source.connect(analyserNode)

      // Create script processor to capture raw audio
      // Note: ScriptProcessorNode is deprecated but works everywhere.
      // AudioWorklet is the modern alternative but requires more setup.
      const bufferSize = Math.ceil(AUDIO_CONFIG.sampleRate * AUDIO_CONFIG.chunkIntervalMs / 1000)
      scriptProcessor = audioContext.createScriptProcessor(
        // Round up to nearest power of 2 (required by Web Audio API)
        Math.pow(2, Math.ceil(Math.log2(bufferSize))),
        1, // input channels
        1  // output channels
      )

      scriptProcessor.onaudioprocess = (event) => {
        if (!isActive || !ws || ws.readyState !== WebSocket.OPEN) return

        // Get audio data
        const inputData = event.inputBuffer.getChannelData(0)

        // Convert to LINEAR16
        const int16Data = float32ToInt16(inputData)

        // Send as binary
        ws.send(int16Data.buffer)
      }

      // Connect the processor (must connect to destination to work)
      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      if (process.env.NODE_ENV === "development") {
        console.log("[Google] Streaming started")
      }

      // Return session controller
      return {
        stop: () => {
          if (!isActive) return
          isActive = false

          if (process.env.NODE_ENV === "development") {
            console.log("[Google] Stopping session")
          }

          // Send stop message to get final results
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "stop" }))
          }

          // Wait a moment for final results then cleanup
          setTimeout(cleanup, 500)
        },
        get isActive() {
          return isActive && !isClosed
        },
        get analyserNode() {
          return analyserNode
        },
      }
    } catch (err) {
      cleanup()
      const error = err instanceof Error ? err : new Error("Failed to start Google recognition")
      onError?.(error)
      throw error
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let googleProvider: GoogleSpeechProvider | null = null

/**
 * Get the Google Speech provider singleton.
 */
export function getGoogleSpeechProvider(): GoogleSpeechProvider {
  if (!googleProvider) {
    googleProvider = new GoogleSpeechProvider()
  }
  return googleProvider
}
