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
 * ## Wispr Protocol
 *
 * Client → Wispr messages use `type` as discriminator: "auth", "append", "commit"
 * Wispr → Client responses use `status` as discriminator: "auth", "text", "error", "info"
 *
 * @see https://api-docs.wisprflow.ai/websocket_api
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
 * The speech-server deploys independently with its own package.json.
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
 * Packet duration in seconds.
 * Each flush produces one packet of this duration.
 * At 16kHz mono 16-bit: 0.032s = 1024 bytes (32ms chunks).
 */
const PACKET_DURATION_S = 0.032
const BYTES_PER_PACKET = 1024 // 16000 Hz * 2 bytes * 0.032s

/**
 * Flush interval in milliseconds.
 * We flush accumulated packets at this interval.
 */
const FLUSH_INTERVAL_MS = 100

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

  // Consistent dev check — matches index.ts (true when NODE_ENV is undefined or "development")
  const isDev = process.env.NODE_ENV !== "production"

  // Track state
  let isStreamActive = true
  let hasEnded = false
  let isAuthenticated = false
  let totalPacketsSent = 0
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
   * Split PCM buffer into fixed-size packets and send as base64 WAV.
   * Each packet is PACKET_DURATION_S seconds of audio.
   * Wispr expects consistent packet durations.
   */
  function flushBuffer(): void {
    if (pcmBuffer.length === 0 || !isStreamActive) return

    // Split buffer into fixed-size packets
    const packets: string[] = []
    const volumes: number[] = []

    while (pcmBuffer.length >= BYTES_PER_PACKET) {
      const chunk = pcmBuffer.subarray(0, BYTES_PER_PACKET)
      pcmBuffer = pcmBuffer.subarray(BYTES_PER_PACKET)

      packets.push(pcmToBase64Wav(Buffer.from(chunk), sampleRate))

      // Calculate simple RMS volume for this chunk
      let sumSquares = 0
      for (let i = 0; i < chunk.length - 1; i += 2) {
        const sample = chunk.readInt16LE(i) / 32768
        sumSquares += sample * sample
      }
      volumes.push(Math.sqrt(sumSquares / (chunk.length / 2)))
    }

    if (packets.length === 0) return

    // position = starting index of this batch (cumulative count BEFORE adding)
    // e.g., first flush of 8 packets → position: 0, next flush → position: 8
    const position = totalPacketsSent
    totalPacketsSent += packets.length

    sendToWispr({
      type: "append",
      position,
      audio_packets: {
        packets,
        volumes,
        packet_duration: PACKET_DURATION_S,
        audio_encoding: "wav",
        byte_encoding: "base64",
      },
    })
  }

  // Handle Wispr WebSocket events
  wisprWs.on("open", () => {
    console.log("[WisprStreaming] Connected to Wispr Flow")

    // Extract language code (Wispr expects array like ["en"])
    const langCode = language.split("-")[0]

    // Send auth message with dictionary context
    sendToWispr({
      type: "auth",
      language: [langCode],
      context: {
        app: { name: "PlayLexi", type: "other" },
        dictionary_context: DICTIONARY_CONTEXT,
      },
    })
    console.log("[WisprStreaming] Auth message sent")
  })

  wisprWs.on("message", (data: WebSocket.Data) => {
    try {
      const message = JSON.parse(data.toString())

      if (isDev) {
        console.log("[WisprStreaming] Received:", JSON.stringify(message).slice(0, 200))
      }

      if (message.status === "auth") {
        // Wispr accepted our auth
        isAuthenticated = true

        // Start the flush timer now that we're authenticated
        flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS)

        console.log("[WisprStreaming] Authenticated — flush timer started")
      } else if (message.status === "text") {
        // Transcript is inside body.text
        const transcript = message.body?.text || ""

        if (message.final) {
          // Final result — Wispr closes WS after this
          console.log(`[WisprStreaming] FINAL: "${transcript}"`)
          isStreamActive = false
          onFinalResult(transcript, 0.9)
        } else {
          // Interim result
          if (isDev) {
            console.log(`[WisprStreaming] interim: "${transcript}"`)
          }
          onInterimResult(transcript)
        }
      } else if (message.status === "info") {
        if (isDev) {
          console.log("[WisprStreaming] Info:", message.message?.event || message.message)
        }
      } else if (message.status === "error") {
        const errorMsg = message.message || message.error || "Wispr API error"
        console.error("[WisprStreaming] Error from Wispr:", errorMsg)
        isStreamActive = false
        onError(new Error(typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg)))
      } else {
        // Unrecognized message — always log so we catch protocol changes
        console.warn("[WisprStreaming] Unrecognized message:", JSON.stringify(message).slice(0, 300))
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
    console.log("[WisprStreaming] WebSocket closed")
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

      console.log(`[WisprStreaming] end() called — authenticated=${isAuthenticated}, buffer=${pcmBuffer.length}bytes, packets=${totalPacketsSent}`)

      // Stop the flush timer
      if (flushTimer) {
        clearInterval(flushTimer)
        flushTimer = null
      }

      // Flush ALL remaining buffered audio, including partial packets.
      // Pad the final partial packet with silence so Wispr receives a complete
      // stream before the commit marker.
      if (pcmBuffer.length > 0 && isAuthenticated) {
        if (pcmBuffer.length < BYTES_PER_PACKET) {
          const padding = Buffer.alloc(BYTES_PER_PACKET - pcmBuffer.length)
          pcmBuffer = Buffer.concat([pcmBuffer, padding])
        }
        flushBuffer()
      }

      // Send commit to signal end of audio
      if (isAuthenticated && wisprWs.readyState === WebSocket.OPEN) {
        sendToWispr({
          type: "commit",
          total_packets: totalPacketsSent,
        })
        console.log(`[WisprStreaming] Committed (${totalPacketsSent} packets)`)
      } else {
        console.warn(`[WisprStreaming] Cannot commit — authenticated=${isAuthenticated}, wsState=${wisprWs.readyState}`)
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
      }, 10_000)
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
