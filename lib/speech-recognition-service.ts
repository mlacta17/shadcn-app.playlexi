/**
 * Speech Recognition Service — Azure Speech Services for voice-to-text.
 *
 * This module provides speech recognition using Azure Speech Services as the
 * PRIMARY and ONLY provider for production use. Azure provides:
 * - Phrase list boosting for letter names (~95-98% accuracy)
 * - Word-level timing data for anti-cheat detection
 * - Server-side token authentication (secure)
 *
 * ## Architecture
 * ```
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                    useSpeechRecognition Hook                        │
 * │                             │                                       │
 * │                             ▼                                       │
 * │               SpeechRecognitionService (this file)                  │
 * │                             │                                       │
 * │                  ┌──────────┴──────────┐                            │
 * │                  ▼                     ▼                            │
 * │              Azure (PRIMARY)    WebSpeechAPI (fallback)             │
 * │           phrase list + timing       free, lower accuracy           │
 * └─────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Provider Selection
 * - **Azure**: PRIMARY — Used for all production spelling recognition
 * - **Web Speech API**: FALLBACK ONLY — Used if Azure is not configured
 *
 * ## Setup Requirements (Azure Speech Services)
 * 1. Create Azure Speech resource in Azure Portal
 * 2. Copy subscription key and region
 * 3. Set environment variables:
 *    - AZURE_SPEECH_KEY (server-side only!)
 *    - AZURE_SPEECH_REGION (e.g., "eastus")
 *
 * ## Usage
 * ```ts
 * // Get Azure provider (recommended - async)
 * const provider = await getSpeechProviderAsync()
 *
 * // Start recognition with word timing for anti-cheat
 * const session = await provider.start({
 *   onInterimResult: (text) => setTranscript(text),
 *   onFinalResult: (text) => submitAnswer(text),
 *   onWordTiming: (words) => trackWordTiming(words), // For anti-cheat
 *   onError: (error) => console.error(error),
 * })
 *
 * // Stop recognition
 * session.stop()
 * ```
 *
 * ## Debugging
 * In development mode, Azure logs detailed events:
 * - `[Azure]` — Azure Speech SDK events and word timing
 * - `[Speech]` — Hook-level events (from useSpeechRecognition)
 *
 * ## Anti-Cheat Word Timing
 * Azure's detailed output provides word-level timestamps:
 * - Spelling "C-A-T": Multiple word segments with gaps (~100-500ms)
 * - Saying "cat": Single continuous word segment
 *
 * This timing data is essential for detecting cheating.
 *
 * @see https://learn.microsoft.com/en-us/azure/ai-services/speech-service/
 * @see PRD Section 12.1 — Voice Recognition
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Available speech recognition providers.
 *
 * - "azure": Azure Speech Services (PRIMARY - server-side auth, phrase list boosting)
 * - "web-speech": Browser built-in (fallback - free, lower accuracy)
 */
export type SpeechProvider = "azure" | "web-speech"

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
   * Supported by Azure Speech Services with detailed output format.
   */
  onWordTiming?: (words: WordTimingData[]) => void
  /** Callback for errors */
  onError?: (error: Error) => void
  /** Language code (default: "en-US") */
  language?: string
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
// SPELLING KEYWORDS (kept for reference - used by Azure phrase lists)
// =============================================================================

// Re-export letter list from centralized phonetic constants
// This maintains backwards compatibility for any code importing SPELLING_KEYWORDS
export { LETTERS_AZ as SPELLING_KEYWORDS } from "./phonetic-constants"

// =============================================================================
// WEB SPEECH API PROVIDER (Fallback)
// =============================================================================

/**
 * Web Speech API provider (browser built-in).
 *
 * Used as a fallback when Azure is not configured.
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

// Lazy import Azure provider to avoid circular dependencies
// and keep the main bundle smaller when Azure isn't used
let azureProviderModule: typeof import("./providers/azure-speech-provider") | null = null

async function getAzureProvider() {
  if (!azureProviderModule) {
    azureProviderModule = await import("./providers/azure-speech-provider")
  }
  return azureProviderModule.getAzureSpeechProvider()
}

// Singleton instance for WebSpeech fallback
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
 * Get the best available speech recognition provider (sync version).
 *
 * NOTE: This sync version cannot check Azure (requires async token fetch).
 * Always prefer getSpeechProviderAsync() which checks Azure first.
 *
 * Priority (sync fallback only):
 * 1. Web Speech API (fallback) — free but lower accuracy
 *
 * IMPORTANT: Deepgram and OpenAI are NOT used. Azure is the primary provider
 * and must be checked via getSpeechProviderAsync().
 *
 * @returns The best available sync provider
 * @throws Error if no provider is available
 */
export function getSpeechProvider(): ISpeechRecognitionProvider {
  // NOTE: Azure is the PRIMARY provider but requires async check.
  // This sync function is only used for initial isSupported check.
  // Actual recording uses getSpeechProviderAsync() which checks Azure first.

  // Fall back to Web Speech API (free, works in most browsers)
  if (!webSpeechProvider) {
    webSpeechProvider = new WebSpeechProvider()
  }
  if (webSpeechProvider.isSupported()) {
    console.warn(
      "[SpeechRecognition] Sync check: Web Speech API available as fallback. " +
      "Azure will be checked async when recording starts."
    )
    return webSpeechProvider
  }

  throw new Error("No speech recognition provider available. Configure Azure Speech Services.")
}

/**
 * Get the best available speech recognition provider (async version).
 *
 * This is the PRIMARY function for getting a speech provider.
 * It checks Azure first, which is the recommended provider for spelling games.
 *
 * Priority:
 * 1. Azure (if configured) — REQUIRED for letter spelling with phrase lists
 * 2. Web Speech API (fallback) — free but lower accuracy
 *
 * NOTE: Deepgram and OpenAI are NOT used. Azure provides word-level timing
 * which is essential for anti-cheat detection.
 *
 * @returns The best available provider
 * @throws Error if no provider is available
 */
export async function getSpeechProviderAsync(): Promise<ISpeechRecognitionProvider> {
  // Try Azure first (REQUIRED for letter spelling with anti-cheat)
  if (await isAzureConfigured()) {
    const azureProvider = await getAzureProvider()
    if (azureProvider.isSupported()) {
      if (process.env.NODE_ENV === "development") {
        console.log("[SpeechRecognition] Using Azure Speech Services (phrase list boosting + word timing)")
      }
      return azureProvider
    }
  }

  // Azure not available - warn and fall back to Web Speech API
  console.warn(
    "[SpeechRecognition] Azure not configured! " +
    "Falling back to Web Speech API. Anti-cheat word timing will not be available. " +
    "Configure AZURE_SPEECH_KEY and AZURE_SPEECH_REGION for best experience."
  )

  // Fall back to Web Speech API only (no Deepgram/OpenAI)
  if (!webSpeechProvider) {
    webSpeechProvider = new WebSpeechProvider()
  }
  if (webSpeechProvider.isSupported()) {
    return webSpeechProvider
  }

  throw new Error(
    "No speech recognition provider available. " +
    "Please configure Azure Speech Services (AZURE_SPEECH_KEY and AZURE_SPEECH_REGION)."
  )
}

/**
 * Get a specific speech recognition provider.
 *
 * @param provider - The provider to get ("azure" or "web-speech")
 * @returns The requested provider (or Promise for Azure which requires async loading)
 * @throws Error if the provider is not available or not supported
 */
export function getSpecificProvider(
  provider: SpeechProvider
): ISpeechRecognitionProvider | Promise<ISpeechRecognitionProvider> {
  switch (provider) {
    case "azure":
      // Azure requires async loading
      return (async () => {
        const azureProvider = await getAzureProvider()
        if (!azureProvider.isSupported()) {
          throw new Error("Azure not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.")
        }
        return azureProvider
      })()

    case "web-speech":
      if (!webSpeechProvider) {
        webSpeechProvider = new WebSpeechProvider()
      }
      if (!webSpeechProvider.isSupported()) {
        throw new Error("Web Speech API not supported in this browser.")
      }
      return webSpeechProvider

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Check which providers are available (sync version).
 *
 * Note: Azure availability is async and defaults to false in this sync check.
 * Use getAvailableProvidersAsync() for accurate Azure status.
 *
 * @returns Object with availability status for each provider
 */
export function getAvailableProviders(): Record<SpeechProvider, boolean> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  return {
    azure: azureConfigured ?? false,
    "web-speech": webSpeechProvider.isSupported(),
  }
}

/**
 * Check which providers are available (async version).
 *
 * This version accurately checks Azure availability by fetching the token endpoint.
 *
 * @returns Object with availability status for each provider
 */
export async function getAvailableProvidersAsync(): Promise<Record<SpeechProvider, boolean>> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  const azureAvailable = await isAzureConfigured()

  return {
    azure: azureAvailable,
    "web-speech": webSpeechProvider.isSupported(),
  }
}
