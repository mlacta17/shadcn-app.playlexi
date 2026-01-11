/**
 * Speech Recognition Service — Abstraction for voice-to-text providers.
 *
 * This module provides a unified interface for speech recognition,
 * allowing easy switching between providers (Web Speech API, Deepgram, Whisper).
 *
 * ## Architecture
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                   useSpeechRecognition Hook                      │
 * │                            │                                     │
 * │                            ▼                                     │
 * │              SpeechRecognitionService (this file)                │
 * │                            │                                     │
 * │          ┌─────────────────┼─────────────────┐                  │
 * │          ▼                 ▼                 ▼                  │
 * │   WebSpeechProvider   DeepgramProvider   WhisperProvider        │
 * │   (free, ~70-80%)     (~95%, $0.0043/min) (batch, ~90%)         │
 * └─────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Provider Comparison
 * | Provider | Cost | Real-Time | Spelling Accuracy | Notes |
 * |----------|------|-----------|-------------------|-------|
 * | Web Speech API | Free | Yes | ~70-80% | Client-side only, no keyword boost |
 * | Deepgram | $0.0043/min | Yes | ~95% | **Recommended** — has keywords feature |
 * | Whisper | $0.006/min | No | ~90% | Batch processing, adds latency |
 *
 * ## Usage
 * ```ts
 * // Get the configured provider
 * const provider = getSpeechProvider()
 *
 * // Start recognition
 * const session = await provider.start({
 *   onInterimResult: (text) => setTranscript(text),
 *   onFinalResult: (text) => submitAnswer(text),
 *   onError: (error) => console.error(error),
 * })
 *
 * // Stop recognition
 * session.stop()
 * ```
 *
 * @see PRD Section 12.1 — Voice Recognition
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Available speech recognition providers.
 */
export type SpeechProvider = "web-speech" | "deepgram" | "whisper"

/**
 * Configuration for starting a speech recognition session.
 */
export interface SpeechRecognitionConfig {
  /** Callback for interim (in-progress) results */
  onInterimResult?: (transcript: string) => void
  /** Callback for final results */
  onFinalResult?: (transcript: string) => void
  /** Callback for errors */
  onError?: (error: Error) => void
  /** Language code (default: "en-US") */
  language?: string
  /**
   * Keywords to boost recognition for.
   * For spelling games, this should include all letter names.
   * Only supported by Deepgram.
   */
  keywords?: string[]
}

/**
 * Active speech recognition session.
 */
export interface SpeechRecognitionSession {
  /** Stop the recognition session */
  stop: () => void
  /** Whether the session is currently active */
  isActive: boolean
}

/**
 * Speech recognition provider interface.
 * All providers must implement this interface.
 */
export interface ISpeechRecognitionProvider {
  /** Provider name */
  name: SpeechProvider
  /** Whether this provider is available in the current environment */
  isSupported: () => boolean
  /** Start a recognition session */
  start: (config: SpeechRecognitionConfig) => Promise<SpeechRecognitionSession>
}

// =============================================================================
// LETTER KEYWORDS FOR DEEPGRAM
// =============================================================================

/**
 * Keywords to boost for spelling recognition.
 * These are passed to Deepgram's keywords feature to improve letter accuracy.
 *
 * Includes:
 * - Single letters (a, b, c...)
 * - Spoken letter names (ay, bee, see, dee...)
 * - NATO phonetic alphabet (alpha, bravo, charlie...)
 */
export const SPELLING_KEYWORDS: string[] = [
  // Single letters
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",

  // Spoken letter names (what people say when spelling)
  "ay", "bee", "see", "dee", "ee", "ef", "gee", "aitch", "eye", "jay",
  "kay", "el", "em", "en", "oh", "pee", "cue", "ar", "es", "tee",
  "you", "vee", "double-u", "ex", "why", "zee", "zed",

  // NATO phonetic alphabet
  "alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf",
  "hotel", "india", "juliet", "kilo", "lima", "mike", "november",
  "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform",
  "victor", "whiskey", "xray", "yankee", "zulu",

  // Common mishearings we want to catch
  "are", "sea", "tea", "queue", "owe", "aye",
]

// =============================================================================
// DEEPGRAM PROVIDER
// =============================================================================

/**
 * Deepgram speech recognition provider.
 *
 * Uses Deepgram's real-time WebSocket API with keyword boosting
 * for optimal spelling accuracy.
 *
 * ## Setup
 * 1. Create account at https://deepgram.com
 * 2. Get API key from dashboard
 * 3. Set NEXT_PUBLIC_DEEPGRAM_API_KEY in .env.local
 *
 * ## Cost
 * - Pay-as-you-go: $0.0043 per minute
 * - ~10 second spelling round = $0.0007
 * - 1000 players × 20 rounds/day = ~$14/day
 *
 * ## Features Used
 * - `keywords`: Boosts recognition of letter names
 * - `punctuate`: Disabled (we don't need punctuation)
 * - `interim_results`: Enabled for real-time feedback
 */
class DeepgramProvider implements ISpeechRecognitionProvider {
  name: SpeechProvider = "deepgram"

  isSupported(): boolean {
    // Deepgram requires API key and WebSocket support
    return typeof WebSocket !== "undefined" && !!this.getApiKey()
  }

  private getApiKey(): string | undefined {
    // Client-side: use NEXT_PUBLIC_ prefix
    // Server-side: use DEEPGRAM_API_KEY
    if (typeof window !== "undefined") {
      return process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
    }
    return process.env.DEEPGRAM_API_KEY
  }

  async start(config: SpeechRecognitionConfig): Promise<SpeechRecognitionSession> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error("Deepgram API key not configured. Set NEXT_PUBLIC_DEEPGRAM_API_KEY in .env.local")
    }

    const { onInterimResult, onFinalResult, onError, language = "en-US" } = config

    // Build WebSocket URL with query parameters
    const params = new URLSearchParams({
      model: "nova-2", // Latest model with best accuracy
      language: language.split("-")[0], // "en-US" -> "en"
      punctuate: "false", // Don't add punctuation
      interim_results: "true", // Get real-time feedback
      utterance_end_ms: "1000", // Consider speech ended after 1s silence
      vad_events: "true", // Voice activity detection
    })

    // Add keywords for letter boosting
    const keywords = config.keywords ?? SPELLING_KEYWORDS
    keywords.forEach((kw) => {
      params.append("keywords", `${kw}:2`) // Boost by factor of 2
    })

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

    // Create WebSocket connection
    const socket = new WebSocket(wsUrl, ["token", apiKey])

    let isActive = true
    let mediaStream: MediaStream | null = null
    let mediaRecorder: MediaRecorder | null = null

    // Handle WebSocket events
    socket.onopen = async () => {
      try {
        // Get microphone access
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
          },
        })

        // Create MediaRecorder to capture audio
        mediaRecorder = new MediaRecorder(mediaStream, {
          mimeType: "audio/webm;codecs=opus",
        })

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            socket.send(event.data)
          }
        }

        // Send audio chunks every 250ms for real-time processing
        mediaRecorder.start(250)
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error("Failed to access microphone"))
        socket.close()
      }
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === "Results" && data.channel?.alternatives?.[0]) {
          const transcript = data.channel.alternatives[0].transcript

          if (transcript) {
            if (data.is_final) {
              onFinalResult?.(transcript)
            } else {
              onInterimResult?.(transcript)
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    socket.onerror = () => {
      onError?.(new Error("Deepgram WebSocket error"))
    }

    socket.onclose = () => {
      isActive = false
      // Cleanup media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop())
      }
    }

    // Return session control
    return {
      stop: () => {
        isActive = false
        mediaRecorder?.stop()
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop())
        }
        socket.close()
      },
      get isActive() {
        return isActive
      },
    }
  }
}

// =============================================================================
// WEB SPEECH API PROVIDER (Fallback)
// =============================================================================

/**
 * Web Speech API provider (browser built-in).
 *
 * Used as a fallback when Deepgram is not configured.
 * Lower accuracy (~70-80%) but free and requires no setup.
 */
class WebSpeechProvider implements ISpeechRecognitionProvider {
  name: SpeechProvider = "web-speech"

  isSupported(): boolean {
    if (typeof window === "undefined") return false
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  }

  async start(config: SpeechRecognitionConfig): Promise<SpeechRecognitionSession> {
    const { onInterimResult, onFinalResult, onError, language = "en-US" } = config

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      throw new Error("Web Speech API not supported in this browser")
    }

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = language
    recognition.continuous = true
    recognition.interimResults = true

    let isActive = true
    let accumulatedTranscript = ""

    recognition.onresult = (event: WebSpeechRecognitionEvent) => {
      let fullTranscript = accumulatedTranscript

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const newText = result[0].transcript.trim()
          if (newText && !fullTranscript.includes(newText)) {
            fullTranscript = fullTranscript
              ? `${fullTranscript} ${newText}`
              : newText
          }
        }
      }

      const latestResult = event.results[event.results.length - 1]
      if (latestResult && !latestResult.isFinal) {
        const interimText = latestResult[0].transcript.trim()
        const displayText = fullTranscript
          ? `${fullTranscript} ${interimText}`
          : interimText
        onInterimResult?.(displayText)
      } else {
        accumulatedTranscript = fullTranscript
        onFinalResult?.(fullTranscript)
      }
    }

    recognition.onerror = (event: WebSpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech") {
        onError?.(new Error(`Speech recognition error: ${event.error}`))
      }
    }

    recognition.onend = () => {
      // Restart if still active (continuous mode)
      if (isActive) {
        try {
          recognition.start()
        } catch {
          // Ignore restart errors
        }
      }
    }

    recognition.start()

    return {
      stop: () => {
        isActive = false
        recognition.stop()
      },
      get isActive() {
        return isActive
      },
    }
  }
}

// Web Speech API types (prefixed to avoid conflicts with global types)
interface WebSpeechRecognitionEvent extends Event {
  readonly results: WebSpeechRecognitionResultList
}

interface WebSpeechRecognitionResultList {
  readonly length: number
  [index: number]: WebSpeechRecognitionResult
}

interface WebSpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: WebSpeechRecognitionAlternative
}

interface WebSpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface WebSpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface WebSpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

interface WebSpeechRecognitionConstructor {
  new (): WebSpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition: WebSpeechRecognitionConstructor
    webkitSpeechRecognition: WebSpeechRecognitionConstructor
  }
}

// =============================================================================
// PROVIDER FACTORY
// =============================================================================

// Singleton instances
let deepgramProvider: DeepgramProvider | null = null
let webSpeechProvider: WebSpeechProvider | null = null

/**
 * Get the best available speech recognition provider.
 *
 * Priority:
 * 1. Deepgram (if API key configured) — best accuracy
 * 2. Web Speech API (fallback) — free but lower accuracy
 *
 * @returns The best available provider
 * @throws Error if no provider is available
 */
export function getSpeechProvider(): ISpeechRecognitionProvider {
  // Try Deepgram first (best accuracy)
  if (!deepgramProvider) {
    deepgramProvider = new DeepgramProvider()
  }
  if (deepgramProvider.isSupported()) {
    return deepgramProvider
  }

  // Fall back to Web Speech API
  if (!webSpeechProvider) {
    webSpeechProvider = new WebSpeechProvider()
  }
  if (webSpeechProvider.isSupported()) {
    console.warn(
      "[SpeechRecognition] Using Web Speech API fallback. " +
      "For better accuracy, configure NEXT_PUBLIC_DEEPGRAM_API_KEY."
    )
    return webSpeechProvider
  }

  throw new Error("No speech recognition provider available")
}

/**
 * Get a specific speech recognition provider.
 *
 * @param provider - The provider to get
 * @returns The requested provider
 * @throws Error if the provider is not available
 */
export function getSpecificProvider(
  provider: SpeechProvider
): ISpeechRecognitionProvider {
  switch (provider) {
    case "deepgram":
      if (!deepgramProvider) {
        deepgramProvider = new DeepgramProvider()
      }
      if (!deepgramProvider.isSupported()) {
        throw new Error("Deepgram not configured. Set NEXT_PUBLIC_DEEPGRAM_API_KEY.")
      }
      return deepgramProvider

    case "web-speech":
      if (!webSpeechProvider) {
        webSpeechProvider = new WebSpeechProvider()
      }
      if (!webSpeechProvider.isSupported()) {
        throw new Error("Web Speech API not supported in this browser.")
      }
      return webSpeechProvider

    case "whisper":
      throw new Error("Whisper provider not implemented yet.")

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Check which providers are available.
 *
 * @returns Object with availability status for each provider
 */
export function getAvailableProviders(): Record<SpeechProvider, boolean> {
  if (!deepgramProvider) deepgramProvider = new DeepgramProvider()
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  return {
    deepgram: deepgramProvider.isSupported(),
    "web-speech": webSpeechProvider.isSupported(),
    whisper: false, // Not implemented
  }
}
