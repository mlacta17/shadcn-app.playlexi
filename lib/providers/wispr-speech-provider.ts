/**
 * Wispr Flow Speech-to-Text Provider (WebSocket Streaming)
 *
 * Real-time speech recognition using Wispr Flow API
 * via a dedicated WebSocket server.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                          Browser                                        │
 * │                                                                         │
 * │  WisprSpeechProvider                                                    │
 * │         │                                                               │
 * │         │ WebSocket (ws://localhost:3002)                               │
 * │         │ - Audio: Binary frames (LINEAR16, 16kHz)                      │
 * │         │ - Results: JSON messages                                      │
 * │         ▼                                                               │
 * │  Speech Server (Node.js)                                                │
 * │         │                                                               │
 * │         │ WebSocket (wss://platform-api.wisprflow.ai)                  │
 * │         ▼                                                               │
 * │  Wispr Flow                                                             │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Key Differences from Google Provider
 *
 * - No overlap detection (Wispr doesn't send cumulative interims)
 * - No anti-cheat analysis (Wispr provides no word-level timestamps)
 * - Simpler message handling — transcript forwarded directly
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
} from "../speech-recognition-service"
import { cleanTranscript, float32ToInt16 } from "../speech-utils"
import { toSpeechFriendlyError } from "../error-messages"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * WebSocket server URL.
 *
 * In development: Connects to local speech server (ws://localhost:3002)
 * In production: Uses NEXT_PUBLIC_SPEECH_SERVER_URL environment variable
 */
const SPEECH_SERVER_URL: string =
  process.env.NEXT_PUBLIC_SPEECH_SERVER_URL || "ws://localhost:3002"

/**
 * Audio capture settings for LINEAR16 format.
 */
const AUDIO_CONFIG = {
  sampleRate: 16000, // 16kHz
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
// WISPR SPEECH PROVIDER
// =============================================================================

/**
 * Wispr Flow speech provider using WebSocket streaming.
 *
 * This provider connects to a dedicated WebSocket server that handles
 * the connection to Wispr's API. Audio is captured from the microphone,
 * converted to LINEAR16, and streamed as binary WebSocket frames.
 *
 * @implements ISpeechRecognitionProvider
 */
export class WisprSpeechProvider implements ISpeechRecognitionProvider {
  name: SpeechProvider = "wispr" as SpeechProvider

  /**
   * Check if Wispr Speech is available.
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
          console.log("[Wispr] Connected to speech server", SPEECH_SERVER_URL)
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

          // Guard against processing interim messages after session is stopped.
          // We still allow FINAL results through so the hook can process them.
          if (!isActive && message.type === "interim") {
            if (process.env.NODE_ENV === "development") {
              console.log("[Wispr] Ignoring interim message after session stopped")
            }
            return
          }

          switch (message.type) {
            case "ready":
              if (process.env.NODE_ENV === "development") {
                console.log("[Wispr] Server ready")
              }
              break

            case "interim":
              if (message.transcript) {
                const text = cleanTranscript(message.transcript)
                if (text !== lastTranscript) {
                  lastTranscript = text
                  if (process.env.NODE_ENV === "development") {
                    console.log(`[Wispr] interim: "${text}"`)
                  }
                  onInterimResult?.(text)
                }
              }
              break

            case "final":
              if (message.transcript) {
                const text = cleanTranscript(message.transcript)
                if (process.env.NODE_ENV === "development") {
                  console.log(`[Wispr] FINAL: "${text}"`)
                }
                // No word timing from Wispr — anti-cheat defaults to trust-the-user
                // via the fallback path in use-speech-recognition.ts
                onFinalResult?.(text)
              }
              break

            case "error":
              console.error("[Wispr] Server error:", message.message)
              const friendlyError = toSpeechFriendlyError(message.message || "Recognition error")
              console.error("[Wispr] Technical details:", friendlyError.technicalDetails)
              onError?.(new Error(friendlyError.title))
              break
          }
        } catch (err) {
          console.error("[Wispr] Failed to parse message:", err)
        }
      }

      ws.onerror = (event) => {
        console.error("[Wispr] WebSocket error:", event)
        const friendlyError = toSpeechFriendlyError("WebSocket connection failed")
        onError?.(new Error(friendlyError.title))
      }

      ws.onclose = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[Wispr] WebSocket closed")
        }
        if (isActive) {
          const friendlyError = toSpeechFriendlyError("WebSocket connection closed unexpectedly")
          onError?.(new Error(friendlyError.title))
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
      const bufferSize = Math.ceil(AUDIO_CONFIG.sampleRate * AUDIO_CONFIG.chunkIntervalMs / 1000)
      scriptProcessor = audioContext.createScriptProcessor(
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
        console.log("[Wispr] Streaming started")
      }

      // Return session controller
      return {
        stop: () => {
          if (!isActive) return
          isActive = false

          lastTranscript = ""

          if (process.env.NODE_ENV === "development") {
            console.log("[Wispr] Stopping session")
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
      const error = err instanceof Error ? err : new Error("Failed to start Wispr recognition")
      onError?.(error)
      throw error
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let wisprProvider: WisprSpeechProvider | null = null

/**
 * Get the Wispr Speech provider singleton.
 */
export function getWisprSpeechProvider(): WisprSpeechProvider {
  if (!wisprProvider) {
    wisprProvider = new WisprSpeechProvider()
  }
  return wisprProvider
}
