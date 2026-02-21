/**
 * Wispr Flow Speech-to-Text Streaming
 *
 * Handles the WebSocket connection to Wispr Flow's real-time transcription API.
 *
 * ## How It Works
 *
 * 1. Client sends audio chunks via WebSocket to this server
 * 2. This module maintains a WebSocket connection to Wispr Flow
 * 3. Audio is buffered, converted to base64 WAV, and sent as JSON packets
 * 4. Wispr sends back interim and final text results
 * 5. Results are forwarded to the client via WebSocket
 *
 * ## Key Differences from Google
 *
 * - Audio sent as base64 WAV in JSON (not raw binary gRPC)
 * - No word-level timestamps (anti-cheat defaults to trust-the-user)
 * - WebSocket closes after final result (each session = one connection)
 * - Dictionary context as string array (not speechContexts with boost)
 */

import WebSocket from "ws"
import { pcmToBase64Wav } from "./wav-encoder"

// =============================================================================
// CONSTANTS
// =============================================================================

const WISPR_WS_BASE = "wss://platform-api.wisprflow.ai/api/v1/dash/ws"

/**
 * Dictionary context for letter recognition.
 * All 26 letters plus phonetic names to help Wispr recognize spelled-out letters.
 *
 * ## Relationship to lib/speech-utils.ts
 *
 * The base letter and phonetic phrases are duplicated from lib/speech-utils.ts.
 * See speech-server/wav-encoder.ts header comment for rationale on duplication.
 *
 * **If you modify the base 26 letters or phonetic names, update both:**
 * - lib/speech-utils.ts (LETTER_PHRASES, PHONETIC_LETTER_NAMES)
 * - speech-server/wispr-streaming.ts (DICTIONARY_CONTEXT)
 */
const DICTIONARY_CONTEXT = [
  // Individual letters
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  // Phonetic names
  "ay", "bee", "cee", "dee", "ee", "eff", "gee", "aitch",
  "eye", "jay", "kay", "ell", "em", "en", "oh", "pee",
  "cue", "are", "ess", "tee", "you", "vee",
  "double you", "double-u", "ex", "why", "zee", "zed",
]

/**
 * Flush interval in milliseconds.
 * At 16kHz mono 16-bit, 100ms = 3200 bytes.
 */
const FLUSH_INTERVAL_MS = 100
const BYTES_PER_FLUSH = 3200 // 16000 Hz * 2 bytes * 0.1s

// =============================================================================
// TYPES
// =============================================================================

/**
 * Callbacks for streaming events.
 */
export interface StreamingCallbacks {
  onInterimResult: (transcript: string) => void
  onFinalResult: (transcript: string, confidence: number) => void
  onError: (error: Error) => void
}

/**
 * A streaming recognition session.
 */
export interface StreamingSession {
  /** Send audio data to the stream */
  write: (audioData: Buffer) => void
  /** End the stream and get final results */
  end: () => void
  /** Check if the stream is still active */
  isActive: () => boolean
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Create a streaming recognition session via Wispr Flow.
 *
 * This sets up a WebSocket connection to Wispr's API, buffers incoming PCM
 * audio, and sends it as base64-encoded WAV packets at regular intervals.
 *
 * @param apiKey - Wispr Flow API key
 * @param callbacks - Event callbacks for results and errors
 * @param language - BCP-47 language code (default: "en-US")
 * @param sampleRate - Audio sample rate in Hz (default: 16000, Safari uses 44100)
 * @returns A streaming session controller
 */
export function createStreamingSession(
  apiKey: string,
  callbacks: StreamingCallbacks,
  language: string = "en-US",
  sampleRate: number = 16000
): StreamingSession {
  const { onInterimResult, onFinalResult, onError } = callbacks

  // Track state
  let isStreamActive = true
  let hasEnded = false
  let isAuthenticated = false
  let packetPosition = 0
  let pcmBuffer = Buffer.alloc(0)
  let flushTimer: ReturnType<typeof setInterval> | null = null

  // Build WebSocket URL with API key
  const wsUrl = `${WISPR_WS_BASE}?api_key=Bearer%20${encodeURIComponent(apiKey)}`

  // Connect to Wispr
  const wisprWs = new WebSocket(wsUrl)

  /**
   * Send a JSON message to Wispr.
   */
  function sendToWispr(message: Record<string, unknown>): void {
    if (wisprWs.readyState === WebSocket.OPEN) {
      wisprWs.send(JSON.stringify(message))
    }
  }

  /**
   * Flush buffered PCM as a base64 WAV packet.
   */
  function flushBuffer(): void {
    if (pcmBuffer.length === 0 || !isStreamActive) return

    const chunk = pcmBuffer
    pcmBuffer = Buffer.alloc(0)

    const audioBase64 = pcmToBase64Wav(chunk, sampleRate)
    packetPosition++

    sendToWispr({
      status: "append",
      audio: audioBase64,
      position: packetPosition,
    })
  }

  // Handle Wispr WebSocket events
  wisprWs.on("open", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[WisprStreaming] Connected to Wispr Flow")
    }

    // Send authentication/config message
    sendToWispr({
      status: "config",
      language,
      dictionary_context: DICTIONARY_CONTEXT,
    })
  })

  wisprWs.on("message", (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString())

      if (message.status === "auth" || message.status === "config_ok") {
        // Wispr accepted our config
        isAuthenticated = true

        // Start the flush timer now that we're authenticated
        flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS)

        if (process.env.NODE_ENV === "development") {
          console.log("[WisprStreaming] Authenticated and ready")
        }
      } else if (message.status === "text") {
        const transcript = message.text || ""

        if (message.final) {
          // Final result — Wispr closes WS after this
          if (process.env.NODE_ENV === "development") {
            console.log(`[WisprStreaming] FINAL: "${transcript}"`)
          }
          isStreamActive = false
          onFinalResult(transcript, message.confidence || 0.9)
        } else {
          // Interim result
          if (process.env.NODE_ENV === "development") {
            console.log(`[WisprStreaming] interim: "${transcript}"`)
          }
          onInterimResult(transcript)
        }
      } else if (message.status === "error") {
        const errorMsg = message.message || message.error || "Wispr API error"
        console.error("[WisprStreaming] Error from Wispr:", errorMsg)
        isStreamActive = false
        onError(new Error(errorMsg))
      }
    } catch (err) {
      console.error("[WisprStreaming] Failed to parse message:", err)
    }
  })

  wisprWs.on("error", (error: Error) => {
    console.error("[WisprStreaming] WebSocket error:", error)
    isStreamActive = false
    onError(error)
  })

  wisprWs.on("close", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[WisprStreaming] WebSocket closed")
    }
    isStreamActive = false
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
  })

  // Return the session controller
  return {
    write: (audioData: Buffer) => {
      if (!isStreamActive || hasEnded) {
        return
      }

      // Buffer PCM data; it will be flushed on the timer
      pcmBuffer = Buffer.concat([pcmBuffer, audioData])
    },

    end: () => {
      if (hasEnded) return
      hasEnded = true

      // Stop the flush timer
      if (flushTimer) {
        clearInterval(flushTimer)
        flushTimer = null
      }

      // Flush any remaining buffered audio
      if (pcmBuffer.length > 0 && isAuthenticated) {
        flushBuffer()
      }

      // Send commit to signal end of audio
      if (isAuthenticated && wisprWs.readyState === WebSocket.OPEN) {
        packetPosition++
        sendToWispr({
          status: "commit",
          position: packetPosition,
        })

        if (process.env.NODE_ENV === "development") {
          console.log(`[WisprStreaming] Committed (${packetPosition} packets)`)
        }
      }

      // Give Wispr time to send final result, then close
      setTimeout(() => {
        try {
          if (wisprWs.readyState === WebSocket.OPEN) {
            wisprWs.close()
          }
        } catch {
          // Ignore close errors
        }
      }, 5000)
    },

    isActive: () => isStreamActive && !hasEnded,
  }
}

/**
 * Validate that Wispr Flow credentials are configured.
 *
 * @returns Object with validation status
 */
export function validateCredentials(): {
  valid: boolean
  missing: string[]
} {
  const apiKey = process.env.WISPR_API_KEY
  const missing: string[] = []

  if (!apiKey) missing.push("WISPR_API_KEY")

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Warm up the Wispr Flow connection.
 * Makes a quick WebSocket connection to verify credentials and reduce
 * first-request latency.
 */
export async function warmupWispr(): Promise<void> {
  const apiKey = process.env.WISPR_API_KEY
  if (!apiKey) return

  try {
    const wsUrl = `${WISPR_WS_BASE}?api_key=Bearer%20${encodeURIComponent(apiKey)}`
    const ws = new WebSocket(wsUrl)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error("Warm-up timeout"))
      }, 5000)

      ws.on("open", () => {
        clearTimeout(timeout)
        ws.close()
        resolve()
      })

      ws.on("error", (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    console.log("[WisprStreaming] Warm-up successful")
  } catch (err) {
    console.warn("[WisprStreaming] Warm-up failed (non-blocking):", err)
  }
}
