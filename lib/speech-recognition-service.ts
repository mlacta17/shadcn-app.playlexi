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
 * - "azure": Azure Speech Services (server-side auth, phrase list boosting)
 * - "openai-realtime": OpenAI gpt-4o-transcribe (best WER, but semantic)
 * - "deepgram": Deepgram Nova-2 (good for words, keyword boost)
 * - "web-speech": Browser built-in (free, lower accuracy)
 * - "whisper": OpenAI Whisper (batch, not real-time - not implemented)
 */
export type SpeechProvider = "web-speech" | "deepgram" | "whisper" | "openai-realtime" | "azure"

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
// LETTER KEYWORDS FOR DEEPGRAM
// =============================================================================

/**
 * Keywords to boost for spelling recognition.
 * These are passed to Deepgram's keywords feature to improve letter accuracy.
 *
 * NOTE: Keep this list SHORT to avoid URL length limits.
 * Only include the most commonly confused letter sounds.
 */
export const SPELLING_KEYWORDS: string[] = [
  // Single letters only - these are the core keywords
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
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

    const { onInterimResult, onFinalResult, onWordTiming, onError, language = "en-US" } = config

    // Build WebSocket URL - keep parameters minimal to avoid API errors
    const params = new URLSearchParams({
      model: "nova-2",
      language: language.split("-")[0], // "en-US" -> "en"
      punctuate: "false",
      interim_results: "true",
    })

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`

    // Debug: Log the connection attempt
    if (process.env.NODE_ENV === "development") {
      console.log("[Deepgram] Connecting to:", wsUrl)
      console.log("[Deepgram] API key present:", !!apiKey, "length:", apiKey?.length)
    }

    // Create WebSocket connection
    // Deepgram expects the API key in the Authorization header via subprotocol
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
          const alternative = data.channel.alternatives[0]
          const transcript = alternative.transcript

          // Extract word-level timing data if available
          // Deepgram returns: { word: "hello", start: 0.12, end: 0.45, confidence: 0.98 }
          // This is the KEY to reliable anti-cheat:
          // - Spelling "C-A-T": Three separate word objects with gaps between end/start
          // - Saying "cat": One word object with continuous audio
          if (alternative.words && Array.isArray(alternative.words) && onWordTiming) {
            const wordTimings: WordTimingData[] = alternative.words.map((w: {
              word: string
              start: number
              end: number
              confidence: number
            }) => ({
              word: w.word,
              start: w.start,
              end: w.end,
              confidence: w.confidence,
            }))

            if (wordTimings.length > 0) {
              onWordTiming(wordTimings)

              if (process.env.NODE_ENV === "development") {
                // Log word timing for debugging
                const timingStr = wordTimings
                  .map((w) => `"${w.word}"@${w.start.toFixed(2)}-${w.end.toFixed(2)}s`)
                  .join(" ")
                console.log(`[Deepgram] Word timing: ${timingStr}`)
              }
            }
          }

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

    socket.onerror = (event) => {
      console.error("[Deepgram] WebSocket error:", event)
      onError?.(new Error("Deepgram WebSocket error"))
    }

    socket.onclose = (event) => {
      isActive = false
      // Log close reason for debugging
      if (process.env.NODE_ENV === "development") {
        console.log(`[Deepgram] WebSocket closed: code=${event.code}, reason=${event.reason || "none"}`)
      }
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
// OPENAI REALTIME API PROVIDER
// =============================================================================

/**
 * OpenAI Realtime API Provider
 *
 * Uses OpenAI's Realtime Transcription API with gpt-4o-transcribe for
 * best-in-class accuracy on individual letters and spelling sequences.
 *
 * ## Key Implementation Details
 *
 * 1. **Audio Format**: PCM 16-bit mono at 24kHz
 *    - Browser AudioContext uses system sample rate (usually 44.1kHz or 48kHz)
 *    - We must RESAMPLE to 24kHz before sending to OpenAI
 *
 * 2. **Event Types** (for intent=transcription):
 *    - `transcription_session.created` - Session ready
 *    - `transcription_session.updated` - Config applied
 *    - `conversation.item.input_audio_transcription.delta` - Interim text
 *    - `conversation.item.input_audio_transcription.completed` - Final text
 *    - `conversation.item.input_audio_transcription.failed` - Transcription error
 *
 * 3. **Chunk Size**: ~40ms of audio per chunk (960 samples at 24kHz)
 *
 * @see https://platform.openai.com/docs/guides/realtime-transcription
 */
class OpenAIRealtimeProvider implements ISpeechRecognitionProvider {
  name: SpeechProvider = "openai-realtime"

  /** Target sample rate required by OpenAI Realtime API */
  private readonly TARGET_SAMPLE_RATE = 24000

  /**
   * Audio buffer size for ScriptProcessorNode.
   * Smaller = lower latency, but more CPU usage.
   * Must be power of 2: 256, 512, 1024, 2048, 4096
   *
   * 256 samples at 48kHz = ~5.3ms latency (too small, causes audio glitches)
   * 512 samples at 48kHz = ~10.6ms latency (good balance)
   * 1024 samples at 48kHz = ~21ms latency (safer for older devices)
   */
  private readonly BUFFER_SIZE = 512

  isSupported(): boolean {
    return typeof WebSocket !== "undefined" && !!this.getApiKey()
  }

  private getApiKey(): string | undefined {
    if (typeof window !== "undefined") {
      return process.env.NEXT_PUBLIC_OPENAI_API_KEY
    }
    return process.env.OPENAI_API_KEY
  }

  /**
   * Resample audio from source sample rate to target sample rate.
   * Uses linear interpolation for simplicity and low latency.
   */
  private resample(
    inputData: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Float32Array {
    if (inputSampleRate === outputSampleRate) {
      return inputData
    }

    const ratio = inputSampleRate / outputSampleRate
    const outputLength = Math.floor(inputData.length / ratio)
    const output = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio
      const srcIndexFloor = Math.floor(srcIndex)
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1)
      const t = srcIndex - srcIndexFloor

      // Linear interpolation
      output[i] = inputData[srcIndexFloor] * (1 - t) + inputData[srcIndexCeil] * t
    }

    return output
  }

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

// Lazy import Azure provider to avoid circular dependencies
// and keep the main bundle smaller when Azure isn't used
let azureProviderModule: typeof import("./providers/azure-speech-provider") | null = null

async function getAzureProvider() {
  if (!azureProviderModule) {
    azureProviderModule = await import("./providers/azure-speech-provider")
  }
  return azureProviderModule.getAzureSpeechProvider()
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
 * NOTE: Only Azure and Web Speech API are supported.
 * Deepgram, OpenAI, and Whisper are NOT used in this application.
 *
 * @param provider - The provider to get
 * @returns The requested provider (or Promise for async providers like Azure)
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

    // These providers exist in code but are NOT used
    case "openai-realtime":
    case "deepgram":
    case "whisper":
      throw new Error(
        `Provider "${provider}" is not enabled. ` +
        "This application uses Azure Speech Services exclusively."
      )

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Check which providers are available.
 *
 * NOTE: Only Azure and Web Speech API are used in this application.
 * Other providers (Deepgram, OpenAI, Whisper) are always marked as false.
 *
 * Azure availability is async and defaults to false in sync check.
 * Use getAvailableProvidersAsync for accurate Azure status.
 *
 * @returns Object with availability status for each provider
 */
export function getAvailableProviders(): Record<SpeechProvider, boolean> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  return {
    azure: azureConfigured ?? false, // Requires async check for accurate result
    "openai-realtime": false, // Not used - Azure is primary
    deepgram: false, // Not used - Azure is primary
    "web-speech": webSpeechProvider.isSupported(),
    whisper: false, // Not implemented
  }
}

/**
 * Check which providers are available (async version).
 *
 * This version accurately checks Azure availability.
 *
 * NOTE: Only Azure and Web Speech API are used in this application.
 * Other providers (Deepgram, OpenAI, Whisper) are always marked as false.
 *
 * @returns Object with availability status for each provider
 */
export async function getAvailableProvidersAsync(): Promise<Record<SpeechProvider, boolean>> {
  if (!webSpeechProvider) webSpeechProvider = new WebSpeechProvider()

  const azureAvailable = await isAzureConfigured()

  return {
    azure: azureAvailable,
    "openai-realtime": false, // Not used - Azure is primary
    deepgram: false, // Not used - Azure is primary
    "web-speech": webSpeechProvider.isSupported(),
    whisper: false, // Not implemented
  }
}
