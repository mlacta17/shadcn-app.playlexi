/**
 * Google Cloud Speech-to-Text Streaming
 *
 * Handles the gRPC bidirectional streaming connection to Google's Speech API.
 *
 * ## How It Works
 *
 * 1. Client sends audio chunks via WebSocket
 * 2. This module maintains a gRPC stream to Google
 * 3. Audio is piped to Google in real-time
 * 4. Google sends back interim and final results
 * 5. Results are forwarded to the client via WebSocket
 *
 * ## Key Concepts
 *
 * - **gRPC Stream**: A persistent, bidirectional connection to Google
 * - **Interim Results**: Partial transcriptions that may change
 * - **Final Results**: Complete transcriptions that won't change
 * - **Word Timing**: Start/end times for each word (critical for anti-cheat)
 */

import speech from "@google-cloud/speech"
import type {
  GoogleStreamingResult,
  GoogleWordInfo,
  StreamingConfig,
  WordTiming,
} from "./types"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Speech context for letter recognition.
 * Boosts recognition of individual letters and their phonetic names.
 *
 * ## Confusable Letter Groups
 * These letters are acoustically similar and often confused by speech recognition:
 * - B/D/P/V: Plosive consonants with similar mouth positions
 * - M/N: Nasal consonants
 * - S/F: Fricatives
 * - C/G: Velar consonants
 *
 * We include explicit phrases to help Google distinguish between them.
 */
const SPEECH_CONTEXT = {
  phrases: [
    // Individual letters (all 26)
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",

    // Phonetic names (how letters sound when spoken)
    "ay", "bee", "cee", "dee", "ee", "eff", "gee", "aitch",
    "eye", "jay", "kay", "ell", "em", "en", "oh", "pee",
    "cue", "are", "ess", "tee", "you", "vee",
    "double you", "double-u", "ex", "why", "zee", "zed",

    // === CONFUSABLE LETTER DISAMBIGUATION ===
    // Repeat commonly confused letters with higher frequency to boost recognition
    // B/D/P/V group (most commonly confused)
    "B", "bee", "D", "dee", "P", "pee", "V", "vee",
    "B", "bee", "D", "dee", "P", "pee", "V", "vee",

    // Explicit disambiguation phrases
    "letter B", "letter D", "letter P", "letter V",
    "B as in boy", "D as in dog", "P as in Paul", "V as in Victor",

    // M/N confusion (commonly confused nasal consonants)
    "M", "em", "N", "en",
    "M", "em", "N", "en",
    "letter M", "letter N",
    "M as in Mary", "N as in Nancy",

    // C/S/G confusion
    "C", "cee", "S", "ess", "G", "gee",
    "letter C", "letter S", "letter G",

    // T/C confusion (commonly confused due to similar-sounding names "tee"/"cee")
    "T", "tee", "C", "cee",
    "T", "tee", "C", "cee",
    "letter T", "letter C",
    "T as in Tom", "C as in cat",

    // F/S confusion
    "F", "eff", "S", "ess",

    // Single letter utterances (helps when user says just one letter)
    "just B", "just D", "just P", "just V",
    "the letter B", "the letter D", "the letter P", "the letter V",
  ],
  boost: 20,
}

/**
 * Default streaming configuration.
 */
const DEFAULT_CONFIG: StreamingConfig = {
  languageCode: "en-US",
  sampleRateHertz: 16000,
  encoding: "LINEAR16",
  enableWordTimeOffsets: true,
  enableAutomaticPunctuation: false,
  model: "latest_short", // Optimized for short utterances
  useEnhanced: true,
  speechContexts: [SPEECH_CONTEXT],
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Callbacks for streaming events.
 */
export interface StreamingCallbacks {
  onInterimResult: (transcript: string, stability: number) => void
  onFinalResult: (transcript: string, words: WordTiming[], confidence: number) => void
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
// HELPERS
// =============================================================================

/**
 * Convert Google's duration format (seconds + nanos) to a number in seconds.
 */
function durationToSeconds(
  duration: { seconds?: string | number; nanos?: number } | undefined
): number {
  if (!duration) return 0
  const seconds =
    typeof duration.seconds === "string"
      ? parseInt(duration.seconds, 10)
      : duration.seconds || 0
  const nanos = duration.nanos || 0
  return seconds + nanos / 1e9
}

/**
 * Parse word timing from Google's response format.
 */
function parseWordTiming(googleWords: GoogleWordInfo[] | undefined): WordTiming[] {
  if (!googleWords || !Array.isArray(googleWords)) return []

  return googleWords.map((w) => ({
    word: w.word || "",
    startTime: durationToSeconds(w.startTime),
    endTime: durationToSeconds(w.endTime),
  }))
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Create a streaming recognition session.
 *
 * This sets up a gRPC bidirectional stream to Google's Speech API.
 * Audio data can be written to the stream, and results are delivered
 * via callbacks.
 *
 * @param credentials - Google Cloud credentials
 * @param callbacks - Event callbacks for results and errors
 * @param language - BCP-47 language code (default: "en-US")
 * @param sampleRate - Audio sample rate in Hz (default: 16000, Safari uses 44100)
 * @returns A streaming session controller
 *
 * @example
 * ```typescript
 * const session = createStreamingSession(
 *   { projectId, clientEmail, privateKey },
 *   {
 *     onInterimResult: (transcript) => console.log("Interim:", transcript),
 *     onFinalResult: (transcript, words) => console.log("Final:", transcript, words),
 *     onError: (err) => console.error("Error:", err),
 *   },
 *   "en-US",
 *   44100 // Safari sends 44100 Hz
 * )
 *
 * // Send audio chunks
 * session.write(audioBuffer)
 *
 * // End when done
 * session.end()
 * ```
 */
export function createStreamingSession(
  credentials: {
    projectId: string
    clientEmail: string
    privateKey: string
  },
  callbacks: StreamingCallbacks,
  language: string = "en-US",
  sampleRate: number = 16000
): StreamingSession {
  const { projectId, clientEmail, privateKey } = credentials
  const { onInterimResult, onFinalResult, onError } = callbacks

  // Create the Google Speech client
  const client = new speech.SpeechClient({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  })

  // Track state
  let isStreamActive = true
  let hasEnded = false

  // Create the streaming request config with client's sample rate
  // Safari uses 44100 Hz to avoid audio hardware switching latency
  const config: StreamingConfig = {
    ...DEFAULT_CONFIG,
    languageCode: language,
    sampleRateHertz: sampleRate,
  }

  // Create the gRPC stream
  const recognizeStream = client.streamingRecognize({
    config: {
      encoding: config.encoding as "LINEAR16",
      sampleRateHertz: config.sampleRateHertz,
      languageCode: config.languageCode,
      enableWordTimeOffsets: config.enableWordTimeOffsets,
      enableAutomaticPunctuation: config.enableAutomaticPunctuation,
      model: config.model,
      useEnhanced: config.useEnhanced,
      speechContexts: config.speechContexts,
    },
    interimResults: true, // Get results as user speaks
  })

  // Handle incoming data from Google
  recognizeStream.on("data", (response: { results?: GoogleStreamingResult[] }) => {
    if (!response.results || response.results.length === 0) return

    for (const result of response.results) {
      const alternative = result.alternatives?.[0]
      if (!alternative?.transcript) continue

      const transcript = alternative.transcript

      if (result.isFinal) {
        // Final result - won't change
        const words = parseWordTiming(alternative.words)
        const confidence = alternative.confidence || 0

        if (process.env.NODE_ENV === "development") {
          console.log(`[GoogleStreaming] FINAL: "${transcript}" (${words.length} words)`)
        }

        onFinalResult(transcript, words, confidence)
      } else {
        // Interim result - may change
        const stability = result.stability || 0

        if (process.env.NODE_ENV === "development") {
          console.log(`[GoogleStreaming] interim: "${transcript}" (stability: ${stability.toFixed(2)})`)
        }

        onInterimResult(transcript, stability)
      }
    }
  })

  // Handle errors
  recognizeStream.on("error", (error: Error) => {
    console.error("[GoogleStreaming] Stream error:", error)
    isStreamActive = false
    onError(error)
  })

  // Handle stream end
  recognizeStream.on("end", () => {
    if (process.env.NODE_ENV === "development") {
      console.log("[GoogleStreaming] Stream ended")
    }
    isStreamActive = false
  })

  // Return the session controller
  return {
    write: (audioData: Buffer) => {
      if (!isStreamActive || hasEnded) {
        console.warn("[GoogleStreaming] Attempted to write to inactive stream")
        return
      }

      try {
        recognizeStream.write(audioData)
      } catch (err) {
        console.error("[GoogleStreaming] Write error:", err)
        onError(err instanceof Error ? err : new Error("Write failed"))
      }
    },

    end: () => {
      if (hasEnded) return
      hasEnded = true

      try {
        recognizeStream.end()
      } catch (err) {
        console.error("[GoogleStreaming] End error:", err)
      }
    },

    isActive: () => isStreamActive && !hasEnded,
  }
}

/**
 * Validate that Google Cloud credentials are configured.
 *
 * @returns Object with validation status and any missing fields
 */
export function validateCredentials(): {
  valid: boolean
  projectId: string | undefined
  clientEmail: string | undefined
  hasPrivateKey: boolean
  missing: string[]
} {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY

  const missing: string[] = []
  if (!projectId) missing.push("GOOGLE_CLOUD_PROJECT_ID")
  if (!clientEmail) missing.push("GOOGLE_CLOUD_CLIENT_EMAIL")
  if (!privateKey) missing.push("GOOGLE_CLOUD_PRIVATE_KEY")

  return {
    valid: missing.length === 0,
    projectId,
    clientEmail,
    hasPrivateKey: !!privateKey,
    missing,
  }
}
