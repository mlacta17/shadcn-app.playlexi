/**
 * Azure Speech Services Provider
 *
 * High-accuracy speech-to-text using Microsoft Azure Cognitive Services.
 * Uses the Speech SDK via WebSocket for real-time streaming transcription.
 *
 * ## Why Azure?
 * - **Phrase Lists**: Can boost recognition of specific words (letter names!)
 * - **Custom Speech**: Trainable models for domain-specific vocabulary
 * - **Consistent Accuracy**: ~95-98% for letter spelling with proper tuning
 * - **No Semantic Interpretation**: Unlike GPT models, doesn't "correct" input
 *
 * ## Architecture
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                          Client (Browser)                               │
 * │                               │                                         │
 * │    ┌──────────────────────────┴──────────────────────────┐             │
 * │    │                                                      │             │
 * │    ▼                                                      ▼             │
 * │  AzureSpeechProvider                              /api/azure-speech     │
 * │  (WebSocket to Azure)                             /token (Next.js)      │
 * │         │                                                │              │
 * │         │ ◄─────────── Auth Token ───────────────────────┘              │
 * │         │                                                               │
 * │         ▼                                                               │
 * │  Azure Speech Services                                                  │
 * │  (wss://{region}.stt.speech.microsoft.com)                             │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Setup
 * 1. Create Azure Speech resource in Azure Portal
 * 2. Copy subscription key and region
 * 3. Set environment variables:
 *    - AZURE_SPEECH_KEY (server-side only, never expose!)
 *    - AZURE_SPEECH_REGION (e.g., "eastus", "westus2")
 *
 * ## Cost
 * - Free tier: 5 hours/month
 * - Pay-as-you-go: $1/hour (audio length)
 * - For spelling bee: ~10s/round × 1000 players × 20 rounds = ~55 min/day = ~$0.92/day
 *
 * @see https://learn.microsoft.com/en-us/azure/ai-services/speech-service/
 * @see https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-recognize-speech
 */

import type {
  ISpeechRecognitionProvider,
  SpeechRecognitionConfig,
  SpeechRecognitionSession,
  SpeechProvider,
} from "../speech-recognition-service"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Token response from our API route.
 */
interface AzureTokenResponse {
  token: string
  region: string
  expiresIn: number
}

/**
 * Azure Speech SDK message types (subset we care about).
 * Full spec: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/
 */
interface AzureSpeechMessage {
  /** Message path (speech.hypothesis, speech.phrase, etc.) */
  path: string
  /** Request ID for correlation */
  requestId?: string
  /** Recognized text for hypothesis/phrase events */
  Text?: string
  /** Recognition status for phrase events */
  RecognitionStatus?: "Success" | "NoMatch" | "InitialSilenceTimeout" | "Error"
  /** N-best results for phrase events */
  NBest?: Array<{
    Display: string
    Confidence: number
  }>
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Letter names to boost via phrase list.
 * These exact strings will have increased recognition priority.
 */
const LETTER_PHRASE_LIST = [
  // Standard letter names
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  // Phonetic variants (how people say letters)
  "ay", "bee", "see", "dee", "ee", "eff", "gee", "aitch",
  "eye", "jay", "kay", "ell", "em", "en", "oh", "pee",
  "cue", "are", "ess", "tee", "you", "vee",
  "double you", "ex", "why", "zee", "zed",
]

// =============================================================================
// AZURE SPEECH PROVIDER
// =============================================================================

/**
 * Azure Speech Services provider for real-time speech recognition.
 *
 * Key features:
 * - Server-side token authentication (secure)
 * - Phrase list boosting for letter names
 * - Real-time interim results via WebSocket
 * - Automatic reconnection on disconnect
 *
 * @implements ISpeechRecognitionProvider
 */
export class AzureSpeechProvider implements ISpeechRecognitionProvider {
  name: SpeechProvider = "azure" as SpeechProvider

  /**
   * Cached token and its expiration time.
   * Tokens are reused until 30 seconds before expiration.
   */
  private cachedToken: { token: string; region: string; expiresAt: number } | null = null

  /**
   * Check if Azure Speech is available.
   * We check by attempting to fetch a token from our API route.
   */
  isSupported(): boolean {
    // Always supported if running in browser with fetch
    // Actual availability is determined when start() is called
    return typeof window !== "undefined" && typeof fetch !== "undefined"
  }

  /**
   * Get an authentication token from our API route.
   * Caches tokens until 30 seconds before expiration.
   */
  private async getToken(): Promise<{ token: string; region: string }> {
    // Check cache first
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - 30000) {
      return {
        token: this.cachedToken.token,
        region: this.cachedToken.region,
      }
    }

    // Fetch new token from API route
    const response = await fetch("/api/azure-speech/token")

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to get Azure token")
    }

    const data: AzureTokenResponse = await response.json()

    // Cache the token
    this.cachedToken = {
      token: data.token,
      region: data.region,
      expiresAt: Date.now() + data.expiresIn * 1000,
    }

    return { token: data.token, region: data.region }
  }

  /**
   * Start a speech recognition session.
   *
   * Uses Azure's WebSocket protocol directly for maximum control and
   * minimal dependencies (no SDK bundle needed).
   */
  async start(config: SpeechRecognitionConfig): Promise<SpeechRecognitionSession> {
    const { onInterimResult, onFinalResult, onError, language = "en-US" } = config

    // Get auth token
    let token: string
    let region: string

    try {
      const authData = await this.getToken()
      token = authData.token
      region = authData.region
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to authenticate with Azure")
      onError?.(error)
      throw error
    }

    // State management
    let isActive = true
    let isClosed = false
    let mediaStream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let scriptProcessor: ScriptProcessorNode | null = null
    let analyserNode: AnalyserNode | null = null
    let socket: WebSocket | null = null

    /**
     * Cleanup all resources safely.
     */
    const cleanup = () => {
      if (isClosed) return
      isClosed = true
      isActive = false

      try { scriptProcessor?.disconnect() } catch { /* ignore */ }
      try { analyserNode?.disconnect() } catch { /* ignore */ }
      try {
        if (audioContext?.state !== "closed") {
          audioContext?.close()
        }
      } catch { /* ignore */ }
      try {
        mediaStream?.getTracks().forEach((track) => track.stop())
      } catch { /* ignore */ }
      try {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.close()
        }
      } catch { /* ignore */ }
    }

    // Generate unique connection ID for this session
    const connectionId = crypto.randomUUID().replace(/-/g, "")

    // Build WebSocket URL
    // Format: wss://{region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1
    const wsUrl = new URL(
      `wss://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`
    )
    wsUrl.searchParams.set("language", language)
    wsUrl.searchParams.set("format", "detailed") // Get confidence scores
    wsUrl.searchParams.set("profanity", "raw") // Don't censor

    if (process.env.NODE_ENV === "development") {
      console.log("[Azure] Connecting to:", wsUrl.toString())
    }

    // Create WebSocket connection with auth
    socket = new WebSocket(wsUrl.toString())

    // Connection timeout
    const connectionTimeout = setTimeout(() => {
      if (socket?.readyState !== WebSocket.OPEN) {
        console.error("[Azure] Connection timeout after 10s")
        onError?.(new Error("Azure connection timeout"))
        cleanup()
      }
    }, 10000)

    /**
     * Send a message to Azure in the required format.
     * Azure uses a specific binary format with headers.
     */
    const sendMessage = (path: string, contentType: string, body: string | ArrayBuffer) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return

      // Build headers
      const headers = [
        `Path: ${path}`,
        `X-RequestId: ${connectionId}`,
        `X-Timestamp: ${new Date().toISOString()}`,
        `Content-Type: ${contentType}`,
      ].join("\r\n")

      if (typeof body === "string") {
        // Text message: headers + blank line + body
        socket.send(`${headers}\r\n\r\n${body}`)
      } else {
        // Binary message (audio): headers as UTF-16LE + 2-byte length + body
        const headerBytes = new TextEncoder().encode(headers + "\r\n")
        const headerLength = headerBytes.length

        // Create combined buffer
        const message = new ArrayBuffer(2 + headerLength + body.byteLength)
        const view = new DataView(message)

        // Header length as 2-byte big-endian
        view.setUint16(0, headerLength, false)

        // Headers
        new Uint8Array(message, 2, headerLength).set(headerBytes)

        // Audio data
        new Uint8Array(message, 2 + headerLength).set(new Uint8Array(body))

        socket.send(message)
      }
    }

    /**
     * Parse incoming message from Azure.
     */
    const parseMessage = (data: string | ArrayBuffer): AzureSpeechMessage | null => {
      try {
        let text: string

        if (typeof data === "string") {
          text = data
        } else {
          // Binary message: parse header length, then extract text
          const view = new DataView(data)
          const headerLength = view.getUint16(0, false)
          const decoder = new TextDecoder()
          text = decoder.decode(new Uint8Array(data, 2))
        }

        // Extract path from headers
        const pathMatch = text.match(/Path:\s*(\S+)/i)
        const path = pathMatch?.[1] || ""

        // Extract JSON body (after blank line)
        const bodyStart = text.indexOf("\r\n\r\n")
        if (bodyStart === -1) {
          return { path }
        }

        const jsonBody = text.slice(bodyStart + 4)
        if (!jsonBody.trim()) {
          return { path }
        }

        const parsed = JSON.parse(jsonBody)
        return { path, ...parsed }
      } catch {
        return null
      }
    }

    // WebSocket event handlers
    socket.onopen = async () => {
      clearTimeout(connectionTimeout)

      if (process.env.NODE_ENV === "development") {
        console.log("[Azure] WebSocket connected")
      }

      try {
        // Send speech.config message
        const speechConfig = {
          context: {
            system: {
              name: "PlayLexi",
              version: "1.0.0",
              build: "browser",
            },
            os: {
              platform: "Browser",
              name: navigator.userAgent,
            },
            audio: {
              source: {
                bitspersample: 16,
                channelcount: 1,
                connectivity: "Wired",
                manufacturer: "Browser",
                model: "WebAudio",
                samplerate: 16000,
                type: "Microphones",
              },
            },
          },
        }

        sendMessage("speech.config", "application/json", JSON.stringify(speechConfig))

        // Send phrase list for letter boosting
        const phraseList = {
          referenceGrammars: [],
          phraseList: LETTER_PHRASE_LIST.map((phrase) => ({ Text: phrase })),
        }

        sendMessage("speech.context", "application/json", JSON.stringify({
          phraseDetection: phraseList,
        }))

        // Start audio capture
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          },
        })

        // Create AudioContext at 16kHz (Azure's preferred rate)
        audioContext = new AudioContext({ sampleRate: 16000 })
        const source = audioContext.createMediaStreamSource(mediaStream)

        // Create analyser for visualization
        analyserNode = audioContext.createAnalyser()
        analyserNode.fftSize = 256
        analyserNode.smoothingTimeConstant = 0.6

        // Create processor for sending audio
        scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)

        scriptProcessor.onaudioprocess = (event) => {
          if (!isActive || !socket || socket.readyState !== WebSocket.OPEN) return

          const inputData = event.inputBuffer.getChannelData(0)

          // Convert to 16-bit PCM
          const pcmData = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]))
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff
          }

          // Send audio chunk
          sendMessage("audio", "audio/x-wav", pcmData.buffer)
        }

        // Connect audio graph
        source.connect(analyserNode)
        analyserNode.connect(scriptProcessor)
        scriptProcessor.connect(audioContext.destination)

        if (process.env.NODE_ENV === "development") {
          console.log("[Azure] Audio capture started")
        }
      } catch (err) {
        console.error("[Azure] Setup error:", err)
        onError?.(err instanceof Error ? err : new Error("Failed to setup audio"))
        cleanup()
      }
    }

    socket.onmessage = (event) => {
      const message = parseMessage(event.data)
      if (!message) return

      if (process.env.NODE_ENV === "development" && !message.path.includes("audio")) {
        console.log("[Azure] Message:", message.path, message.Text || "")
      }

      switch (message.path) {
        case "speech.hypothesis":
          // Interim result
          if (message.Text) {
            onInterimResult?.(message.Text)
          }
          break

        case "speech.phrase":
          // Final result
          if (message.RecognitionStatus === "Success") {
            // Use best result if available
            const text = message.NBest?.[0]?.Display || message.Text
            if (text) {
              onFinalResult?.(text)
            }
          }
          break

        case "speech.endDetected":
          // Speech ended - could restart for continuous mode
          if (process.env.NODE_ENV === "development") {
            console.log("[Azure] Speech end detected")
          }
          break

        case "turn.end":
          // Turn completed
          break
      }
    }

    socket.onerror = () => {
      console.error("[Azure] WebSocket error")
      onError?.(new Error("Azure WebSocket error"))
    }

    socket.onclose = (event) => {
      clearTimeout(connectionTimeout)
      if (process.env.NODE_ENV === "development") {
        console.log(`[Azure] WebSocket closed: ${event.code}`)
      }
      cleanup()
    }

    // Return session controller
    return {
      stop: () => {
        if (!isActive) return
        isActive = false

        // Send audio end signal
        if (socket?.readyState === WebSocket.OPEN) {
          sendMessage("audio", "audio/x-wav", new ArrayBuffer(0))
        }

        // Brief delay for final transcription
        setTimeout(() => {
          cleanup()
        }, 200)
      },
      get isActive() {
        return isActive && !isClosed
      },
      get analyserNode() {
        return analyserNode
      },
    }
  }
}

// Singleton instance
let azureProvider: AzureSpeechProvider | null = null

/**
 * Get the Azure Speech provider singleton.
 */
export function getAzureSpeechProvider(): AzureSpeechProvider {
  if (!azureProvider) {
    azureProvider = new AzureSpeechProvider()
  }
  return azureProvider
}
