/**
 * Speech Recognition Service
 *
 * Provider selection with automatic fallback:
 * 1. Wispr Flow (PRIMARY) - WebSocket streaming via speech-server
 * 2. Web Speech API (FALLBACK) - Browser built-in, no setup required
 *
 * ## Setup
 * - For Wispr: Run `npm run dev:speech` to start WebSocket server on port 3002
 * - Web Speech API works out of the box in supported browsers
 *
 * ## Architecture
 * ```
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    useSpeechRecognition Hook                        │
 * │                             │                                       │
 * │                             ▼                                       │
 * │               SpeechRecognitionService (this file)                  │
 * │                             │                                       │
 * │           ┌─────────────────┴─────────────────┐                     │
 * │           ▼                                   ▼                     │
 * │     Wispr (PRIMARY)                    WebSpeech (FALLBACK)         │
 * │     WebSocket streaming                Browser built-in             │
 * └─────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Anti-Cheat
 * Wispr does not provide word-level timestamps. The anti-cheat system
 * defaults to trusting the user (looksLikeSpellingFromAudio: true)
 * via the fallback path in use-speech-recognition.ts.
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Available speech recognition providers.
 *
 * - "wispr": Wispr Flow (PRIMARY - best accuracy with dictionary context)
 * - "web-speech": Browser built-in (fallback - free, lower accuracy, no anti-cheat)
 */
export type SpeechProvider = "web-speech" | "wispr"

/**
 * Word-level timing data from speech recognition.
 * Contains start/end timestamps from the actual audio, not transcript arrival time.
 *
 * Note: Wispr does not provide word-level timing. This type is kept for
 * compatibility with the hook interface, but will contain empty arrays
 * when using the Wispr provider.
 */
export interface WordTimingData {
  /** The recognized word/letter */
  word: string
  /** Start time in seconds from audio start */
  start: number
  /** End time in seconds from audio start */
  end: number
  /** Recognition confidence (0-1) */
  confidence: number
}

/**
 * Configuration for starting a speech recognition session.
 */
export interface SpeechRecognitionConfig {
  /** Callback for interim (in-progress) results */
  onInterimResult?: (transcript: string) => void
  /** Callback for final results */
  onFinalResult?: (transcript: string) => void
  /**
   * Callback for word-level timing data.
   * Provides actual audio timestamps for each recognized word.
   *
   * Not supported by Wispr provider (no word-level data available).
   */
  onWordTiming?: (words: WordTimingData[]) => void
  /** Callback for errors */
  onError?: (error: Error) => void
  /** Language code (default: "en-US") */
  language?: string
  /**
   * Keywords to boost recognition for.
   * For spelling games, this should include all letter names.
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
  /**
   * Audio analyser node for visualization (optional).
   * Providers that capture audio can expose this for waveform rendering.
   * This eliminates the need for duplicate media streams.
   */
  analyserNode?: AnalyserNode | null
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
// LETTER KEYWORDS (for providers that support keyword boosting)
// =============================================================================

/**
 * Keywords to boost for spelling recognition.
 * Used by Wispr's dictionary context for better letter recognition.
 */
export const SPELLING_KEYWORDS: string[] = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
]

// =============================================================================
// WEB SPEECH API PROVIDER (Fallback)
// =============================================================================

/**
 * Web Speech API provider (browser built-in).
 *
 * Used as a fallback when Wispr is not configured.
 * Lower accuracy (~70-80%) but free and requires no setup.
 *
 * NOTE: This provider does NOT support word-level timing,
 * so anti-cheat will not be available when using this fallback.
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

// Lazy import Wispr provider to keep the main bundle smaller
let wisprProviderModule: typeof import("./providers/wispr-speech-provider") | null = null

async function getWisprProvider() {
  if (!wisprProviderModule) {
    wisprProviderModule = await import("./providers/wispr-speech-provider")
  }
  return wisprProviderModule.getWisprSpeechProvider()
}

// Singleton instance for WebSpeech provider
let webSpeechProvider: WebSpeechProvider | null = null

/**
 * Check if Wispr Speech WebSocket server is available.
 *
 * The Wispr Speech provider uses a dedicated WebSocket server
 * (speech-server) for streaming. This function checks if that
 * server is running and accepting connections.
 */
let wisprConfigured: boolean | null = null

/**
 * WebSocket server URL for speech recognition.
 * Uses environment variable in production, falls back to localhost for development.
 */
const SPEECH_WS_URL: string =
  process.env.NEXT_PUBLIC_SPEECH_SERVER_URL || "ws://localhost:3002"

async function isWisprConfigured(): Promise<boolean> {
  if (wisprConfigured !== null) return wisprConfigured

  // Skip check on server-side
  if (typeof window === "undefined") {
    return false
  }

  try {
    // Try to connect to the WebSocket server
    const wsUrl = SPEECH_WS_URL
    const ws = new WebSocket(wsUrl)

    const result = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        ws.close()
        resolve(false)
      }, 2000)

      ws.onopen = () => {
        clearTimeout(timeout)
        ws.close()
        resolve(true)
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        resolve(false)
      }
    })

    wisprConfigured = result
    console.log(`[SpeechRecognition] Wispr speech server ${result ? "available" : "not available"} at ${wsUrl}`)
    return result
  } catch {
    wisprConfigured = false
    return false
  }
}

/**
 * Get the best available speech recognition provider (sync version).
 *
 * NOTE: This sync version cannot check Wispr (requires async).
 * Always prefer getSpeechProviderAsync() which checks all providers.
 *
 * @returns The best available sync provider (WebSpeech only)
 * @throws Error if no provider is available
 */
export function getSpeechProvider(): ISpeechRecognitionProvider {
  // NOTE: Wispr is checked async in getSpeechProviderAsync().
  // This sync function is only used for initial isSupported check.

  // Fall back to Web Speech API (free, works in most browsers)
  if (!webSpeechProvider) {
    webSpeechProvider = new WebSpeechProvider()
  }
  if (webSpeechProvider.isSupported()) {
    console.warn(
      "[SpeechRecognition] Sync check: Web Speech API available as fallback. " +
      "Wispr will be checked async when recording starts."
    )
    return webSpeechProvider
  }

  throw new Error("No speech recognition provider available.")
}

/**
 * Get the best available speech recognition provider (async version).
 *
 * This is the PRIMARY function for getting a speech provider.
 * It checks Wispr first (best accuracy with dictionary context).
 *
 * Priority:
 * 1. Wispr (if speech server running) — BEST accuracy with dictionary context
 * 2. Web Speech API (fallback) — free but lower accuracy, NO anti-cheat
 *
 * @returns The best available provider
 * @throws Error if no provider is available
 */
export async function getSpeechProviderAsync(): Promise<ISpeechRecognitionProvider> {
  // Try Wispr first (BEST accuracy with dictionary context)
  if (await isWisprConfigured()) {
    const wisprProvider = await getWisprProvider()
    if (wisprProvider.isSupported()) {
      console.log("[SpeechRecognition] Using Wispr Flow")
      return wisprProvider
    }
  }

  // Wispr not available - warn and fall back to Web Speech API
  console.warn(
    "[SpeechRecognition] Wispr speech server not available! " +
    "Falling back to Web Speech API. " +
    "Run 'npm run dev:speech' to start the speech server."
  )

  // Fall back to Web Speech API
  if (!webSpeechProvider) {
    webSpeechProvider = new WebSpeechProvider()
  }
  if (webSpeechProvider.isSupported()) {
    return webSpeechProvider
  }

  throw new Error(
    "No speech recognition provider available. " +
    "Please start the speech server with 'npm run dev:speech'."
  )
}

/**
 * Check which providers are available.
 *
 * NOTE: Wispr availability requires async check and defaults to false here.
 * Use getAvailableProvidersAsync() for accurate status.
 *
 * @returns Object with availability status for each provider
 */
export function getAvailableProviders(): Record<SpeechProvider, boolean> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  return {
    wispr: wisprConfigured ?? false,
    "web-speech": webSpeechProvider.isSupported(),
  }
}

/**
 * Check which providers are available (async version).
 *
 * This version accurately checks Wispr availability.
 *
 * @returns Object with availability status for each provider
 */
export async function getAvailableProvidersAsync(): Promise<Record<SpeechProvider, boolean>> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  const wisprAvailable = await isWisprConfigured()

  return {
    wispr: wisprAvailable,
    "web-speech": webSpeechProvider.isSupported(),
  }
}
