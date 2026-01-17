/**
 * Speech Recognition Service
 *
 * Provider selection with automatic fallback:
 * 1. Google Cloud Speech-to-Text (PRIMARY) - WebSocket streaming via speech-server
 * 2. Azure Speech Services (SECONDARY) - Lexical-based anti-cheat
 * 3. Web Speech API (FALLBACK) - Browser built-in, no setup required
 *
 * ## Setup
 * - For Google: Run `npm run dev:speech` to start WebSocket server on port 3002
 * - For Azure: Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables
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
 * │           ┌─────────────────┼─────────────────┐                     │
 * │           ▼                 ▼                 ▼                     │
 * │     Google (PRIMARY)   Azure (SECONDARY)   WebSpeech (FALLBACK)    │
 * │     WebSocket + gRPC    SDK + Lexical      Browser built-in        │
 * └─────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Anti-Cheat Word Timing
 * Google and Azure provide word-level timestamps for anti-cheat:
 * - Spelling "C-A-T": Multiple word segments with gaps (~100-500ms)
 * - Saying "cat": Single continuous word segment
 *
 * @see https://cloud.google.com/speech-to-text/docs
 * @see https://learn.microsoft.com/en-us/azure/ai-services/speech-service/
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Available speech recognition providers.
 *
 * - "google": Google Cloud Speech-to-Text (PRIMARY - best letter-by-letter detection)
 * - "azure": Azure Speech Services (SECONDARY - good accuracy, phrase list boosting)
 * - "web-speech": Browser built-in (fallback - free, lower accuracy)
 */
export type SpeechProvider = "web-speech" | "azure" | "google"

/**
 * Word-level timing data from speech recognition.
 * Contains start/end timestamps from the actual audio, not transcript arrival time.
 *
 * This is the KEY to reliable anti-cheat:
 * - Spelling "C-A-T": Three separate word segments with gaps in audio
 * - Saying "cat": One continuous word segment
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
   * Used for anti-cheat detection (spelling vs saying).
   *
   * Supported by Google and Azure providers.
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
 * Used by providers that support keyword boosting (Azure phrase list, Google speech context)
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
 * Used as a fallback when Google and Azure are not configured.
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

// Lazy import providers to avoid circular dependencies
// and keep the main bundle smaller when they aren't used
let azureProviderModule: typeof import("./providers/azure-speech-provider") | null = null
let googleProviderModule: typeof import("./providers/google-speech-provider") | null = null

async function getAzureProvider() {
  if (!azureProviderModule) {
    azureProviderModule = await import("./providers/azure-speech-provider")
  }
  return azureProviderModule.getAzureSpeechProvider()
}

async function getGoogleProvider() {
  if (!googleProviderModule) {
    googleProviderModule = await import("./providers/google-speech-provider")
  }
  return googleProviderModule.getGoogleSpeechProvider()
}

// Singleton instance for WebSpeech provider
let webSpeechProvider: WebSpeechProvider | null = null

/**
 * Check if Azure Speech is configured (has server-side route).
 * We do a quick check by attempting to fetch the token endpoint.
 */
let azureConfigured: boolean | null = null

async function isAzureConfigured(): Promise<boolean> {
  if (azureConfigured !== null) return azureConfigured

  try {
    const response = await fetch("/api/azure-speech/token", { method: "GET" })
    // 503 means not configured, 200 means configured
    azureConfigured = response.ok
    return azureConfigured
  } catch {
    azureConfigured = false
    return false
  }
}

/**
 * Check if Google Speech WebSocket server is available.
 *
 * The Google Speech provider uses a dedicated WebSocket server
 * (speech-server) for real-time gRPC streaming. This function
 * checks if that server is running and accepting connections.
 */
let googleConfigured: boolean | null = null

async function isGoogleConfigured(): Promise<boolean> {
  if (googleConfigured !== null) return googleConfigured

  // Skip check on server-side
  if (typeof window === "undefined") {
    return false
  }

  try {
    // Try to connect to the WebSocket server
    const wsUrl = `ws://${window.location.hostname}:3002`
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

    googleConfigured = result
    if (process.env.NODE_ENV === "development") {
      console.log(`[SpeechRecognition] Google Speech server ${result ? "available" : "not available"} at ${wsUrl}`)
    }
    return result
  } catch {
    googleConfigured = false
    return false
  }
}

/**
 * Get the best available speech recognition provider (sync version).
 *
 * NOTE: This sync version cannot check Google or Azure (requires async).
 * Always prefer getSpeechProviderAsync() which checks all providers.
 *
 * @returns The best available sync provider (WebSpeech only)
 * @throws Error if no provider is available
 */
export function getSpeechProvider(): ISpeechRecognitionProvider {
  // NOTE: Google and Azure are checked async in getSpeechProviderAsync().
  // This sync function is only used for initial isSupported check.

  // Fall back to Web Speech API (free, works in most browsers)
  if (!webSpeechProvider) {
    webSpeechProvider = new WebSpeechProvider()
  }
  if (webSpeechProvider.isSupported()) {
    console.warn(
      "[SpeechRecognition] Sync check: Web Speech API available as fallback. " +
      "Google/Azure will be checked async when recording starts."
    )
    return webSpeechProvider
  }

  throw new Error("No speech recognition provider available.")
}

/**
 * Get the best available speech recognition provider (async version).
 *
 * This is the PRIMARY function for getting a speech provider.
 * It checks Google first (best for letter-by-letter detection), then Azure.
 *
 * Priority:
 * 1. Google (if speech server running) — BEST for letter-by-letter word timing
 * 2. Azure (if configured) — Good accuracy with phrase list boosting
 * 3. Web Speech API (fallback) — free but lower accuracy
 *
 * @returns The best available provider
 * @throws Error if no provider is available
 */
export async function getSpeechProviderAsync(): Promise<ISpeechRecognitionProvider> {
  // Try Google first (BEST for letter-by-letter detection)
  if (await isGoogleConfigured()) {
    const googleProvider = await getGoogleProvider()
    if (googleProvider.isSupported()) {
      if (process.env.NODE_ENV === "development") {
        console.log("[SpeechRecognition] Using Google Cloud Speech-to-Text (letter-by-letter word timing)")
      }
      return googleProvider
    }
  }

  // Try Azure second (good accuracy with phrase list boosting)
  if (await isAzureConfigured()) {
    const azureProvider = await getAzureProvider()
    if (azureProvider.isSupported()) {
      if (process.env.NODE_ENV === "development") {
        console.log("[SpeechRecognition] Using Azure Speech Services (phrase list boosting + word timing)")
      }
      return azureProvider
    }
  }

  // Neither Google nor Azure available - warn and fall back to Web Speech API
  console.warn(
    "[SpeechRecognition] Google and Azure not configured! " +
    "Falling back to Web Speech API. Anti-cheat word timing will not be available. " +
    "Configure Google Cloud Speech or Azure Speech Services for best experience."
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
    "Please configure Google Cloud Speech or Azure Speech Services."
  )
}

/**
 * Check which providers are available.
 *
 * NOTE: Google and Azure availability requires async checks and defaults to false here.
 * Use getAvailableProvidersAsync() for accurate status.
 *
 * @returns Object with availability status for each provider
 */
export function getAvailableProviders(): Record<SpeechProvider, boolean> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  return {
    google: googleConfigured ?? false,
    azure: azureConfigured ?? false,
    "web-speech": webSpeechProvider.isSupported(),
  }
}

/**
 * Check which providers are available (async version).
 *
 * This version accurately checks Google and Azure availability.
 *
 * @returns Object with availability status for each provider
 */
export async function getAvailableProvidersAsync(): Promise<Record<SpeechProvider, boolean>> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  const [googleAvailable, azureAvailable] = await Promise.all([
    isGoogleConfigured(),
    isAzureConfigured(),
  ])

  return {
    google: googleAvailable,
    azure: azureAvailable,
    "web-speech": webSpeechProvider.isSupported(),
  }
}
