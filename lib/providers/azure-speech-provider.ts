/**
 * Azure Speech Services Provider
 *
 * High-accuracy speech-to-text using Microsoft Azure Cognitive Services.
 * Uses the official Microsoft Speech SDK for reliable, production-ready integration.
 *
 * ## Why Azure?
 * - **Phrase Lists**: Can boost recognition of specific words (letter names!)
 * - **Official SDK**: Battle-tested, handles reconnection and edge cases
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
 * │  (Speech SDK)                                     /token (Next.js)      │
 * │         │                                                │              │
 * │         │ ◄─────────── Auth Token ───────────────────────┘              │
 * │         │                                                               │
 * │         ▼                                                               │
 * │  Azure Speech Services                                                  │
 * │  (SDK manages WebSocket internally)                                     │
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
 * @see https://www.npmjs.com/package/microsoft-cognitiveservices-speech-sdk
 */

import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk"
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

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Letter names to boost via phrase list.
 * These exact strings will have increased recognition priority.
 */
const LETTER_PHRASE_LIST = [
  // Individual letter names (high priority for spelling)
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  // Space-separated letter sequences (common patterns)
  "A B", "B C", "C D", "D E", "E F", "F G", "G H", "H I", "I J",
  "R U N", "S U N", "C A T", "D O G", "R E D", "B L U E",
  "S P E L L", "W O R D", "T E S T",
  // Phonetic variants (how letters sound)
  "ay", "bee", "cee", "dee", "ee", "eff", "gee", "aitch",
  "eye", "jay", "kay", "ell", "em", "en", "oh", "pee",
  "cue", "are", "ess", "tee", "you", "vee",
  "double you", "double-u", "ex", "why", "zee", "zed",
]

/**
 * Clean transcript text for spelling comparison.
 * - Removes punctuation (periods, commas, question marks, etc.)
 * - Trims whitespace
 * - Preserves case (comparison should handle case-insensitivity)
 */
function cleanTranscript(text: string): string {
  return text
    .replace(/[.,!?;:'"]/g, "") // Remove punctuation
    .trim()
}

// =============================================================================
// AZURE SPEECH PROVIDER
// =============================================================================

/**
 * Azure Speech Services provider using the official Microsoft Speech SDK.
 *
 * Key features:
 * - Server-side token authentication (secure)
 * - Phrase list boosting for letter names
 * - Real-time interim results
 * - Automatic reconnection handled by SDK
 * - AudioContext integration for visualization
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
   * We check by verifying the SDK loaded and browser supports required APIs.
   */
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia !== "undefined" &&
      typeof AudioContext !== "undefined"
    )
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
   * Uses the official Microsoft Speech SDK for reliable transcription.
   * Sets up phrase lists for letter boosting and provides an analyser node
   * for audio visualization.
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
    let recognizer: SpeechSDK.SpeechRecognizer | null = null
    let audioConfig: SpeechSDK.AudioConfig | null = null
    let mediaStream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let analyserNode: AnalyserNode | null = null

    /**
     * Cleanup all resources safely.
     */
    const cleanup = async () => {
      if (isClosed) return
      isClosed = true
      isActive = false

      // Stop recognizer
      if (recognizer) {
        try {
          recognizer.stopContinuousRecognitionAsync(
            () => {
              recognizer?.close()
              recognizer = null
            },
            (err) => {
              console.warn("[Azure] Error stopping recognizer:", err)
              recognizer?.close()
              recognizer = null
            }
          )
        } catch {
          // Ignore cleanup errors
        }
      }

      // Stop audio resources
      try {
        analyserNode?.disconnect()
      } catch { /* ignore */ }
      try {
        if (audioContext?.state !== "closed") {
          await audioContext?.close()
        }
      } catch { /* ignore */ }
      try {
        mediaStream?.getTracks().forEach((track) => track.stop())
      } catch { /* ignore */ }

      audioConfig = null
    }

    try {
      // Create speech config from token
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region)
      speechConfig.speechRecognitionLanguage = language

      // Request detailed output with confidence scores
      speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed

      // Disable automatic punctuation - we want raw letter output
      // This prevents "SUN." from having a period
      speechConfig.setServiceProperty(
        "punctuation",
        "explicit",
        SpeechSDK.ServicePropertyChannel.UriQueryParameter
      )

      if (process.env.NODE_ENV === "development") {
        console.log("[Azure] Creating speech config for region:", region)
      }

      // Get microphone stream
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // Create audio context for visualization
      audioContext = new AudioContext({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(mediaStream)

      // Create analyser for visualization
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.6
      source.connect(analyserNode)

      // Create audio config from microphone
      // The SDK will create its own audio stream internally
      audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput()

      // Create recognizer
      recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig)

      // Add phrase list for letter boosting
      const phraseList = SpeechSDK.PhraseListGrammar.fromRecognizer(recognizer)
      for (const phrase of LETTER_PHRASE_LIST) {
        phraseList.addPhrase(phrase)
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[Azure] Added", LETTER_PHRASE_LIST.length, "phrases to boost list")
      }

      // Handle interim results (recognizing event)
      recognizer.recognizing = (_sender, event) => {
        if (!isActive) return

        const rawText = event.result.text
        if (rawText) {
          const text = cleanTranscript(rawText)
          if (process.env.NODE_ENV === "development") {
            console.log("[Azure] interim:", rawText, "→", text)
          }
          onInterimResult?.(text)
        }
      }

      // Handle final results (recognized event)
      recognizer.recognized = (_sender, event) => {
        if (!isActive) return

        if (event.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          const rawText = event.result.text
          if (rawText) {
            const text = cleanTranscript(rawText)
            if (process.env.NODE_ENV === "development") {
              console.log("[Azure] FINAL:", rawText, "→", text)
            }
            onFinalResult?.(text)
          }
        } else if (event.result.reason === SpeechSDK.ResultReason.NoMatch) {
          if (process.env.NODE_ENV === "development") {
            console.log("[Azure] No speech recognized")
          }
        }
      }

      // Handle errors
      recognizer.canceled = (_sender, event) => {
        if (!isActive) return

        if (event.reason === SpeechSDK.CancellationReason.Error) {
          console.error("[Azure] Error:", event.errorCode, event.errorDetails)
          onError?.(new Error(`Azure error: ${event.errorDetails}`))
        }
      }

      // Handle session events
      recognizer.sessionStarted = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[Azure] Session started")
        }
      }

      recognizer.sessionStopped = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[Azure] Session stopped")
        }
      }

      // Start continuous recognition
      await new Promise<void>((resolve, reject) => {
        recognizer!.startContinuousRecognitionAsync(
          () => {
            if (process.env.NODE_ENV === "development") {
              console.log("[Azure] Recognition started")
            }
            resolve()
          },
          (err) => {
            console.error("[Azure] Failed to start:", err)
            reject(new Error(`Failed to start Azure recognition: ${err}`))
          }
        )
      })

      // Return session controller
      return {
        stop: () => {
          if (!isActive) return
          isActive = false
          cleanup()
        },
        get isActive() {
          return isActive && !isClosed
        },
        get analyserNode() {
          return analyserNode
        },
      }
    } catch (err) {
      cleanup()
      const error = err instanceof Error ? err : new Error("Failed to start Azure recognition")
      onError?.(error)
      throw error
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
