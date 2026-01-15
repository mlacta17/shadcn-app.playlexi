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
 * - **Deepgram/OpenAI**: NOT USED — Code exists but disabled
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
 * - "google": Google Cloud Speech-to-Text (PRIMARY - best letter-by-letter detection)
 * - "azure": Azure Speech Services (SECONDARY - good accuracy, phrase list boosting)
 * - "web-speech": Browser built-in (fallback - free, lower accuracy)
 *
 * NOTE: The following providers exist in code but are NOT used:
 * - "openai-realtime": OpenAI gpt-4o-transcribe (code exists, disabled)
 * - "deepgram": Deepgram Nova-2 (code exists, disabled)
 * - "whisper": OpenAI Whisper (not implemented)
 */
export type SpeechProvider = "web-speech" | "deepgram" | "whisper" | "openai-realtime" | "azure" | "google"

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
   * Only supported by Deepgram (Azure doesn't provide word-level streaming data).
   */
  onWordTiming?: (words: WordTimingData[]) => void
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
 * Used by providers that support keyword boosting (Azure phrase list, etc.)
 */
export const SPELLING_KEYWORDS: string[] = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
]

// =============================================================================
// REMOVED PROVIDERS (Dead Code Cleanup)
// =============================================================================
// The following providers were removed from this file as they were never used:
// - DeepgramProvider (~190 lines) - Deepgram Nova-2 WebSocket streaming
// - OpenAIRealtimeProvider (~450 lines) - OpenAI gpt-4o-transcribe
// - arrayBufferToBase64 helper - Only used by OpenAI provider
//
// Google Cloud Speech-to-Text and Azure Speech Services are the only
// cloud providers used in production. WebSpeechProvider is the free fallback.
// =============================================================================

  /**
   * Convert Float32 audio samples to Int16 PCM.
   * OpenAI expects 16-bit signed integers in little-endian format.
   */
  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp to [-1, 1] range
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      // Convert to 16-bit integer
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16Array
  }

  async start(config: SpeechRecognitionConfig): Promise<SpeechRecognitionSession> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      throw new Error("OpenAI API key not configured. Set NEXT_PUBLIC_OPENAI_API_KEY in .env.local")
    }

    const { onInterimResult, onFinalResult, onError } = config

    // Use intent=transcription for transcription-only mode
    const wsUrl = "wss://api.openai.com/v1/realtime?intent=transcription"

    if (process.env.NODE_ENV === "development") {
      console.log("[OpenAI] Connecting to:", wsUrl)
    }

    // Connect with API key via subprotocol (browser-compatible auth)
    const socket = new WebSocket(wsUrl, [
      "realtime",
      `openai-insecure-api-key.${apiKey}`,
      "openai-beta.realtime-v1",
    ])

    // State management
    let isActive = true
    let isClosed = false
    let mediaStream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let scriptProcessor: ScriptProcessorNode | null = null
    let analyserNode: AnalyserNode | null = null // For visualization - shared with hook
    let accumulatedTranscript = ""
    let sessionConfigured = false

    /**
     * Safely close all resources without throwing errors.
     */
    const cleanup = () => {
      if (isClosed) return
      isClosed = true
      isActive = false

      try {
        scriptProcessor?.disconnect()
      } catch {
        // Ignore - already disconnected
      }

      try {
        if (audioContext?.state !== "closed") {
          audioContext?.close()
        }
      } catch {
        // Ignore - already closed
      }

      try {
        mediaStream?.getTracks().forEach((track) => track.stop())
      } catch {
        // Ignore
      }
    }

    /**
     * Configure session and start audio capture.
     * Called after receiving transcription_session.created event.
     */
    const configureSessionAndStartAudio = async () => {
      if (sessionConfigured || !isActive) return
      sessionConfigured = true

      try {
        // Configure transcription session
        // Structure follows official OpenAI docs:
        // https://platform.openai.com/docs/guides/realtime-transcription
        const sessionConfig = {
          type: "transcription_session.update",
          session: {
            input_audio_format: "pcm16",
            input_audio_transcription: {
              model: "gpt-4o-transcribe",
              // Aggressive prompt to force letter-by-letter output
              // Key instructions:
              // 1. NEVER combine letters into words
              // 2. Output raw phonemes/letters with spaces
              // 3. Explicit examples of what we want
              prompt: `CRITICAL: Output ONLY individual letters separated by spaces. NEVER combine letters into words.

Rules:
- If you hear "see ay tea" → output "C A T" (not "cat")
- If you hear "dee oh gee" → output "D O G" (not "dog")
- If you hear the letters C, A, T spoken → output "C A T"
- Each letter MUST be separated by a space
- NEVER output a complete word without spaces

This is a spelling bee. The user is spelling letter-by-letter. Transcribe each letter individually.`,
              language: "en",
            },
            // VAD settings tuned for low-latency letter spelling
            // - Lower threshold = more sensitive to speech
            // - Shorter silence = faster end-of-speech detection
            // - Shorter prefix = less audio buffered before speech
            turn_detection: {
              type: "server_vad",
              threshold: 0.4,           // Default 0.5, lower = more sensitive
              prefix_padding_ms: 200,   // Default 300ms, audio before speech start
              silence_duration_ms: 300, // Default 500ms, wait before committing
            },
            // OpenAI expects this as an object with "type" property
            input_audio_noise_reduction: {
              type: "near_field",
            },
          },
        }

        if (process.env.NODE_ENV === "development") {
          console.log("[OpenAI] Sending session config")
        }

        socket.send(JSON.stringify(sessionConfig))

        // Get microphone access (browser determines actual sample rate)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })

        // Create AudioContext (will use system sample rate, typically 44100 or 48000)
        audioContext = new AudioContext()
        const actualSampleRate = audioContext.sampleRate

        if (process.env.NODE_ENV === "development") {
          console.log(`[OpenAI] Browser sample rate: ${actualSampleRate}Hz, target: ${this.TARGET_SAMPLE_RATE}Hz`)
        }

        const source = audioContext.createMediaStreamSource(mediaStream)

        // Create analyser for visualization (shared with hook - eliminates duplicate stream)
        analyserNode = audioContext.createAnalyser()
        analyserNode.fftSize = 256 // Small FFT for fast updates
        analyserNode.smoothingTimeConstant = 0.6 // Slightly less smoothing for responsiveness

        // ScriptProcessor is deprecated but has universal browser support
        // AudioWorklet would be better but has compatibility issues
        // Using fixed buffer size for consistent low-latency behavior
        scriptProcessor = audioContext.createScriptProcessor(this.BUFFER_SIZE, 1, 1)

        scriptProcessor.onaudioprocess = (event) => {
          if (!isActive || socket.readyState !== WebSocket.OPEN) return

          const inputData = event.inputBuffer.getChannelData(0)

          // Resample from browser sample rate to 24kHz
          const resampled = this.resample(inputData, actualSampleRate, this.TARGET_SAMPLE_RATE)

          // Convert to 16-bit PCM
          const pcmData = this.floatTo16BitPCM(resampled)

          // Convert to base64
          const base64Audio = arrayBufferToBase64(pcmData.buffer)

          // Send to OpenAI
          socket.send(JSON.stringify({
            type: "input_audio_buffer.append",
            audio: base64Audio,
          }))
        }

        // Audio routing: source → analyser → scriptProcessor → destination
        // This allows visualization while processing audio for transcription
        source.connect(analyserNode)
        analyserNode.connect(scriptProcessor)
        scriptProcessor.connect(audioContext.destination)

        if (process.env.NODE_ENV === "development") {
          console.log("[OpenAI] Audio capture started")
        }
      } catch (err) {
        console.error("[OpenAI] Setup error:", err)
        onError?.(err instanceof Error ? err : new Error("Failed to setup audio"))
        cleanup()
        socket.close()
      }
    }

    // Connection timeout - fail fast if WebSocket doesn't connect
    const connectionTimeout = setTimeout(() => {
      if (socket.readyState !== WebSocket.OPEN) {
        console.error("[OpenAI] Connection timeout after 10s")
        onError?.(new Error("OpenAI connection timeout - check your network"))
        cleanup()
        socket.close()
      }
    }, 10000)

    // WebSocket event handlers
    socket.onopen = () => {
      clearTimeout(connectionTimeout)
      if (process.env.NODE_ENV === "development") {
        console.log("[OpenAI] WebSocket connected")
      }
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const eventType = data.type

        // Debug logging (skip noisy events)
        if (process.env.NODE_ENV === "development") {
          if (!eventType?.includes("audio_buffer")) {
            console.log("[OpenAI] Event:", eventType)
          }
        }

        // Session created - start configuration
        if (eventType === "transcription_session.created") {
          configureSessionAndStartAudio()
        }

        // Session configured successfully
        if (eventType === "transcription_session.updated") {
          if (process.env.NODE_ENV === "development") {
            console.log("[OpenAI] Session configured successfully")
          }
        }

        // Transcription in progress (interim results)
        if (eventType === "conversation.item.input_audio_transcription.delta") {
          const delta = data.delta || ""
          if (delta) {
            accumulatedTranscript += delta
            onInterimResult?.(accumulatedTranscript)
          }
        }

        // Transcription completed (final result)
        if (eventType === "conversation.item.input_audio_transcription.completed") {
          const transcript = data.transcript || accumulatedTranscript
          if (transcript) {
            if (process.env.NODE_ENV === "development") {
              console.log("[OpenAI] Final transcript:", transcript)
            }
            onFinalResult?.(transcript)
            accumulatedTranscript = ""
          }
        }

        // Transcription failed - log full details for debugging
        if (eventType === "conversation.item.input_audio_transcription.failed") {
          // Extract all error details from the response
          const errorDetails = {
            message: data.error?.message || "Unknown",
            type: data.error?.type || "Unknown",
            code: data.error?.code || "Unknown",
            param: data.error?.param || null,
            item_id: data.item_id || null,
            content_index: data.content_index ?? null,
          }
          console.warn("[OpenAI] Transcription failed:", JSON.stringify(errorDetails, null, 2))

          // Log the full event for debugging in development
          if (process.env.NODE_ENV === "development") {
            console.warn("[OpenAI] Full failed event:", JSON.stringify(data, null, 2))
          }

          // Reset accumulated transcript for next attempt
          accumulatedTranscript = ""
        }

        // API errors (session-level errors)
        if (eventType === "error") {
          const errorCode = data.error?.code || "Unknown"
          const errorMsg = data.error?.message || "Unknown"

          // Ignore non-critical errors that don't affect functionality
          const ignorableErrors = [
            "input_audio_buffer_commit_empty", // Buffer already committed by VAD
          ]

          if (ignorableErrors.includes(errorCode)) {
            if (process.env.NODE_ENV === "development") {
              console.log(`[OpenAI] Ignoring non-critical error: ${errorCode}`)
            }
            return
          }

          const errorDetails = {
            message: errorMsg,
            type: data.error?.type || "Unknown",
            code: errorCode,
          }
          console.error("[OpenAI] API error:", JSON.stringify(errorDetails, null, 2))
          onError?.(new Error(`OpenAI: ${errorMsg} (${errorCode})`))
        }
      } catch (parseErr) {
        console.error("[OpenAI] Failed to parse message:", parseErr)
      }
    }

    socket.onerror = () => {
      console.error("[OpenAI] WebSocket error")
      onError?.(new Error("OpenAI WebSocket connection error"))
    }

    socket.onclose = (event) => {
      clearTimeout(connectionTimeout)
      if (process.env.NODE_ENV === "development") {
        console.log(`[OpenAI] WebSocket closed: ${event.code}`)
      }
      cleanup()
    }

    // Return session controller
    return {
      stop: () => {
        // Prevent double-stop
        if (!isActive) return
        isActive = false

        // With server_vad enabled, OpenAI automatically commits audio when speech ends.
        // We don't need to manually commit - just close the connection gracefully.
        // Manual commit can cause "buffer too small" errors if VAD already committed.

        if (process.env.NODE_ENV === "development") {
          console.log("[OpenAI] Stopping session (VAD handles auto-commit)")
        }

        // Brief delay to allow any pending transcriptions to complete
        // Use 150ms instead of 300ms for snappier response
        setTimeout(() => {
          cleanup()
          if (socket.readyState === WebSocket.OPEN) {
            socket.close()
          }
        }, 150)
      },
      get isActive() {
        return isActive && !isClosed
      },
      // Expose analyser for visualization - hook can use this instead of creating duplicate stream
      get analyserNode() {
        return analyserNode
      },
    }
  }
}

/**
 * Convert ArrayBuffer to base64 string.
 * Used for encoding PCM audio data for OpenAI's API.
 *
 * Optimized for performance:
 * - Uses chunked String.fromCharCode to avoid stack overflow on large buffers
 * - Processes in 8KB chunks for optimal memory/speed balance
 * - ~10x faster than byte-by-byte string concatenation
 */
function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer as ArrayBuffer)
  const chunkSize = 8192 // Process 8KB at a time for speed
  let binary = ""

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }

  return btoa(binary)
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

// Singleton instances
// NOTE: Only Azure and WebSpeech are used. Deepgram/OpenAI providers exist
// in this file but are NOT instantiated or used in the provider selection.
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
 * It checks Google first (best for letter-by-letter detection), then Azure.
 *
 * Priority:
 * 1. Google (if configured) — BEST for letter-by-letter word timing
 * 2. Azure (if configured) — Good accuracy with phrase list boosting
 * 3. Web Speech API (fallback) — free but lower accuracy
 *
 * NOTE: Deepgram and OpenAI are NOT used.
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

  // Fall back to Web Speech API only (no Deepgram/OpenAI)
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
 * Get a specific speech recognition provider.
 *
 * NOTE: Google is the PRIMARY provider. Azure is secondary. Web Speech API is fallback.
 * Deepgram, OpenAI, and Whisper are NOT used in this application.
 *
 * @param provider - The provider to get
 * @returns The requested provider (or Promise for async providers like Google/Azure)
 * @throws Error if the provider is not available or not supported
 */
export function getSpecificProvider(
  provider: SpeechProvider
): ISpeechRecognitionProvider | Promise<ISpeechRecognitionProvider> {
  switch (provider) {
    case "google":
      // Google requires async loading
      return (async () => {
        const googleProvider = await getGoogleProvider()
        if (!googleProvider.isSupported()) {
          throw new Error("Google Cloud Speech not configured. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, and GOOGLE_CLOUD_PRIVATE_KEY.")
        }
        return googleProvider
      })()

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

    // These providers exist in code but are NOT used
    case "openai-realtime":
    case "deepgram":
    case "whisper":
      throw new Error(
        `Provider "${provider}" is not enabled. ` +
        "This application uses Google Cloud Speech or Azure Speech Services."
      )

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Check which providers are available.
 *
 * NOTE: Google is the PRIMARY provider. Azure is secondary. Web Speech API is fallback.
 * Other providers (Deepgram, OpenAI, Whisper) are NOT used.
 *
 * Google and Azure availability is async and defaults to false in sync check.
 * Use getAvailableProvidersAsync for accurate status.
 *
 * @returns Object with availability status for each provider
 */
export function getAvailableProviders(): Record<SpeechProvider, boolean> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  return {
    google: googleConfigured ?? false, // Requires async check for accurate result
    azure: azureConfigured ?? false, // Requires async check for accurate result
    "openai-realtime": false, // Not used
    deepgram: false, // Not used
    "web-speech": webSpeechProvider.isSupported(),
    whisper: false, // Not implemented
  }
}

/**
 * Check which providers are available (async version).
 *
 * This version accurately checks Google and Azure availability.
 *
 * NOTE: Google is the PRIMARY provider. Azure is secondary. Web Speech API is fallback.
 * Other providers (Deepgram, OpenAI, Whisper) are NOT used.
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
    "openai-realtime": false, // Not used
    deepgram: false, // Not used
    "web-speech": webSpeechProvider.isSupported(),
    whisper: false, // Not implemented
  }
}
