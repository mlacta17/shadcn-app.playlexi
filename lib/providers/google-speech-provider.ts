/**
 * Google Cloud Speech-to-Text Provider (WebSocket Streaming)
 *
 * Real-time speech recognition using Google Cloud Speech-to-Text API
 * via a dedicated WebSocket server.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                          Browser                                        │
 * │                                                                         │
 * │  GoogleSpeechProvider                                                   │
 * │         │                                                               │
 * │         │ WebSocket (ws://localhost:3002)                               │
 * │         │ - Audio: Binary frames (LINEAR16, 16kHz)                      │
 * │         │ - Results: JSON messages                                      │
 * │         ▼                                                               │
 * │  Speech Server (Node.js)                                                │
 * │         │                                                               │
 * │         │ gRPC (bidirectional streaming)                                │
 * │         ▼                                                               │
 * │  Google Cloud Speech-to-Text                                            │
 * └─────────────────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Why WebSocket + Separate Server?
 *
 * 1. **Next.js limitation**: App Router doesn't support WebSockets
 * 2. **Google requires gRPC**: Streaming API uses gRPC, not REST
 * 3. **Real-time feedback**: ~100-250ms latency vs ~500-800ms with polling
 *
 * ## Setup
 *
 * 1. Start the speech server: `npm run dev:speech`
 * 2. Start Next.js: `npm run dev`
 * 3. Or run both: `npm run dev:all`
 *
 * @see /speech-server/README.md for server documentation
 */

import type {
  ISpeechRecognitionProvider,
  SpeechRecognitionConfig,
  SpeechRecognitionSession,
  SpeechProvider,
  WordTimingData,
} from "../speech-recognition-service"
import { cleanTranscript, float32ToInt16 } from "../speech-utils"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * WebSocket server URL.
 *
 * In development: Connects to local speech server (ws://localhost:3002)
 * In production: Uses NEXT_PUBLIC_SPEECH_SERVER_URL environment variable
 *
 * Set NEXT_PUBLIC_SPEECH_SERVER_URL in your deployment environment to point
 * to your deployed speech server (e.g., wss://speech.playlexi.com)
 */
const SPEECH_SERVER_URL: string =
  process.env.NEXT_PUBLIC_SPEECH_SERVER_URL || "ws://localhost:3002"

/**
 * Audio capture settings for LINEAR16 format.
 */
const AUDIO_CONFIG = {
  sampleRate: 16000, // 16kHz as required by Google
  channelCount: 1, // Mono
  chunkIntervalMs: 100, // Send audio every 100ms for low latency
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Messages received from the speech server.
 */
interface ServerMessage {
  type: "ready" | "interim" | "final" | "error"
  transcript?: string
  stability?: number
  words?: Array<{ word: string; startTime: number; endTime: number }>
  confidence?: number
  message?: string
  timestamp?: number
}

// =============================================================================
// GOOGLE SPEECH PROVIDER
// =============================================================================

/**
 * Google Cloud Speech-to-Text provider using WebSocket streaming.
 *
 * This provider connects to a dedicated WebSocket server that handles
 * the gRPC streaming to Google's Speech API. This enables true real-time
 * recognition with ~100-250ms latency.
 *
 * @implements ISpeechRecognitionProvider
 */
export class GoogleSpeechProvider implements ISpeechRecognitionProvider {
  name: SpeechProvider = "google" as SpeechProvider

  /**
   * Check if Google Speech is available.
   * Requires WebSocket support and audio APIs.
   */
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof WebSocket !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices !== "undefined" &&
      typeof navigator.mediaDevices.getUserMedia !== "undefined" &&
      typeof AudioContext !== "undefined"
    )
  }

  /**
   * Start a speech recognition session.
   *
   * Establishes a WebSocket connection to the speech server and streams
   * audio in real-time for recognition.
   */
  async start(config: SpeechRecognitionConfig): Promise<SpeechRecognitionSession> {
    const {
      onInterimResult,
      onFinalResult,
      onWordTiming,
      onError,
      language = "en-US",
    } = config

    // State management
    let isActive = true
    let isClosed = false
    let ws: WebSocket | null = null
    let mediaStream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let analyserNode: AnalyserNode | null = null
    let scriptProcessor: ScriptProcessorNode | null = null
    let lastTranscript = ""

    // Accumulated transcript tracking
    // Google sends interim results in chunks. High-stability results (>= 0.8)
    // represent "committed" portions that won't change. We need to accumulate
    // these to avoid losing parts of the transcript.
    let accumulatedStableText = ""
    let lastStability = 0

    /**
     * Cleanup all resources safely.
     */
    const cleanup = () => {
      if (isClosed) return
      isClosed = true
      isActive = false

      // Close WebSocket
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "stop" }))
            ws.close()
          }
        } catch {
          // Ignore
        }
        ws = null
      }

      // Stop audio processing
      if (scriptProcessor) {
        try {
          scriptProcessor.disconnect()
        } catch {
          // Ignore
        }
        scriptProcessor = null
      }

      // Stop analyser
      if (analyserNode) {
        try {
          analyserNode.disconnect()
        } catch {
          // Ignore
        }
      }

      // Close audio context
      if (audioContext && audioContext.state !== "closed") {
        try {
          audioContext.close()
        } catch {
          // Ignore
        }
        audioContext = null
      }

      // Stop media stream
      if (mediaStream) {
        try {
          mediaStream.getTracks().forEach((track) => track.stop())
        } catch {
          // Ignore
        }
        mediaStream = null
      }
    }

    try {
      // Connect to WebSocket server
      ws = new WebSocket(SPEECH_SERVER_URL)

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout. Is the speech server running? (npm run dev:speech)"))
        }, 5000)

        ws!.onopen = () => {
          clearTimeout(timeout)
          console.log("[Google] Connected to speech server ✅", SPEECH_SERVER_URL)
          resolve()
        }

        ws!.onerror = () => {
          clearTimeout(timeout)
          reject(new Error("Failed to connect to speech server. Run 'npm run dev:speech' to start it."))
        }
      })

      // Set up message handler
      ws.onmessage = (event) => {
        try {
          const message: ServerMessage = JSON.parse(event.data)

          // CRITICAL: Guard against processing INTERIM messages after session is stopped.
          // After stop() is called, isActive becomes false. We should not process
          // interim results because:
          // 1. The hook has already reset its state
          // 2. Late interim results would corrupt the next session's state
          // 3. The accumulated text would carry over incorrectly
          //
          // HOWEVER, we MUST still allow FINAL results through because:
          // 1. FINAL results contain word-level timing data for anti-cheat
          // 2. The hook is waiting (with timeout) for the FINAL result
          // 3. Without FINAL data, anti-cheat cannot detect "saying vs spelling"
          if (!isActive && message.type === "interim") {
            if (process.env.NODE_ENV === "development") {
              console.log("[Google] Ignoring interim message after session stopped")
            }
            return
          }

          switch (message.type) {
            case "ready":
              if (process.env.NODE_ENV === "development") {
                console.log("[Google] Server ready")
              }
              break

            case "interim":
              if (message.transcript) {
                const stability = message.stability || 0
                const rawText = cleanTranscript(message.transcript)

                // When stability drops from high (>= 0.8) to low, it means Google
                // has "committed" the previous high-stability portion and is now
                // processing new audio. We need to accumulate the stable parts.
                if (lastStability >= 0.8 && stability < 0.5) {
                  // Previous result was stable, current is unstable = new chunk starting
                  // The stable text should be accumulated
                  accumulatedStableText = lastTranscript
                }

                // Build the full transcript: accumulated stable + current
                let fullText: string
                if (accumulatedStableText && stability < 0.8) {
                  // We have accumulated stable text and current is unstable
                  // Combine them (avoiding duplication)
                  fullText = accumulatedStableText + " " + rawText
                } else if (stability >= 0.8) {
                  // High stability = this might become the new accumulated base
                  // But only if it's longer than what we have
                  if (rawText.length >= accumulatedStableText.length) {
                    fullText = rawText
                  } else {
                    fullText = accumulatedStableText + " " + rawText
                  }
                } else {
                  fullText = rawText
                }

                fullText = cleanTranscript(fullText)
                lastStability = stability

                if (fullText !== lastTranscript) {
                  lastTranscript = fullText
                  if (process.env.NODE_ENV === "development") {
                    console.log(
                      `[Google] interim: "${fullText}" (stability: ${stability.toFixed(2)}, accumulated: "${accumulatedStableText}")`
                    )
                  }
                  onInterimResult?.(fullText)
                }
              }
              break

            case "final":
              if (message.transcript) {
                const text = cleanTranscript(message.transcript)
                if (process.env.NODE_ENV === "development") {
                  console.log(`[Google] FINAL: "${text}" (${message.words?.length || 0} words)`)
                }

                // Process word timing for anti-cheat
                if (message.words && message.words.length > 0 && onWordTiming) {
                  const wordTimings: WordTimingData[] = message.words.map((w) => ({
                    word: w.word,
                    start: w.startTime,
                    end: w.endTime,
                    confidence: message.confidence || 0.9,
                  }))

                  // =================================================================
                  // GOOGLE ANTI-CHEAT: Multi-Signal Detection
                  // =================================================================
                  // We use multiple signals from word timing data to determine
                  // spelling vs saying:
                  //
                  // 1. Word count vs letter count
                  // 2. Single-letter word ratio
                  // 3. Gaps between words (spelling has pauses)
                  // 4. Total speech duration vs letter count
                  // 5. Individual word durations (letters are short)
                  // =================================================================

                  const wordCount = wordTimings.length
                  const letterCount = text.replace(/\s/g, "").length
                  const singleLetterWords = wordTimings.filter((w) => w.word.length === 1).length

                  // Calculate gaps between words
                  let totalGapTime = 0
                  for (let i = 1; i < wordTimings.length; i++) {
                    const gap = wordTimings[i].start - wordTimings[i - 1].end
                    if (gap > 0) totalGapTime += gap
                  }
                  const avgGapMs = wordCount > 1 ? (totalGapTime / (wordCount - 1)) * 1000 : 0

                  // Calculate total speech duration
                  const totalDuration = wordTimings.length > 0
                    ? wordTimings[wordTimings.length - 1].end - wordTimings[0].start
                    : 0

                  // Average duration per word (kept for future debugging/logging)
                  const _avgWordDuration = wordCount > 0 ? totalDuration / wordCount : 0
                  void _avgWordDuration // Suppress unused variable warning

                  // =================================================================
                  // SIGNAL 1: Multiple words detected (strong signal for spelling)
                  // If Google heard multiple separate words, user likely spelled
                  // =================================================================
                  const hasMultipleWords = wordCount > 1

                  // =================================================================
                  // SIGNAL 2: High ratio of single-letter words
                  // Spelling produces mostly single letters: "C", "A", "T"
                  // Saying produces multi-letter words: "cat"
                  // =================================================================
                  const singleLetterRatio = wordCount > 0 ? singleLetterWords / wordCount : 0
                  const hasMostlySingleLetters = singleLetterRatio >= 0.5

                  // =================================================================
                  // SIGNAL 3: Word count matches or exceeds letter count
                  // Spelling "CAT" → 3 words for 3 letters
                  // Saying "cat" → 1 word for 3 letters
                  // =================================================================
                  const wordToLetterRatio = letterCount > 0 ? wordCount / letterCount : 0
                  const wordCountMatchesLetters = wordToLetterRatio >= 0.6

                  // =================================================================
                  // SIGNAL 4: Gaps between words (spelling has pauses)
                  // Spelling has ~100-500ms gaps between letters
                  // Saying is continuous with no gaps
                  // =================================================================
                  const hasSignificantGaps = avgGapMs >= 80 // 80ms minimum gap

                  // =================================================================
                  // SIGNAL 5: Single-word detection (PRIMARY anti-cheat)
                  // =================================================================
                  // When spelling "C-A-T":
                  //   - Google hears 3 separate words: ["C", "A", "T"]
                  //   - wordCount=3, singleLetterWords=3
                  //
                  // When SAYING "cat":
                  //   - Google hears 1 word: ["cat"]
                  //   - wordCount=1, singleLetterWords=0
                  //
                  // KEY INSIGHT: If wordCount===1 AND singleLetterWords===0 AND
                  // the word has 2+ letters, the user SAID the word, not spelled it.
                  // Duration is irrelevant because slow speakers can still cheat.
                  //
                  // Exception: Single-letter words like "I" or "A" are legitimate.
                  // =================================================================
                  const isSingleWordNotSpelled =
                    wordCount === 1 &&
                    singleLetterWords === 0 &&
                    letterCount >= 2

                  // =================================================================
                  // SIGNAL 6: Duration check (SECONDARY - backup for edge cases)
                  // =================================================================
                  // Even if we somehow missed signal 5, extremely fast speech
                  // (< 0.10s per letter) is physically impossible when spelling.
                  //
                  // Minimum threshold: 0.10s per letter (very generous)
                  // This catches fast talkers who speak whole words quickly.
                  // =================================================================
                  const MIN_SECONDS_PER_LETTER = 0.10
                  const durationPerLetter = letterCount > 0 ? totalDuration / letterCount : 0

                  const isTooFastForSpelling =
                    letterCount >= 3 &&
                    durationPerLetter < MIN_SECONDS_PER_LETTER

                  // =================================================================
                  // FINAL VERDICT: Combine signals with clear logic
                  // =================================================================
                  // Priority order:
                  // 1. Single-letter answers → always valid
                  // 2. Single word with 0 single-letter-words → SAID, not spelled
                  // 3. Multiple words with spelling pattern → valid spelling
                  // 4. Too fast for spelling → reject
                  // 5. Default → trust the user
                  // =================================================================
                  let isSpelledOut: boolean

                  if (wordCount === 0) {
                    // No words detected - trust the user
                    isSpelledOut = true
                  } else if (letterCount === 1) {
                    // Single letter answer (like "I" or "A") - always valid
                    isSpelledOut = true
                  } else if (isSingleWordNotSpelled) {
                    // CRITICAL: Google heard ONE word with multiple letters
                    // and zero single-letter-words → user SAID the word
                    // Example: "fun" heard as ["fun"], not ["F", "U", "N"]
                    isSpelledOut = false
                  } else if (hasMultipleWords && (hasMostlySingleLetters || wordCountMatchesLetters)) {
                    // Multiple words with spelling characteristics - PASS
                    isSpelledOut = true
                  } else if (hasMultipleWords && hasSignificantGaps) {
                    // Multiple words with pauses - likely spelling - PASS
                    isSpelledOut = true
                  } else if (isTooFastForSpelling) {
                    // Backup: Duration too fast to be spelling - REJECT
                    isSpelledOut = false
                  } else {
                    // Default: trust the user
                    isSpelledOut = true
                  }

                  // Attach metadata to first word timing
                  const timingWithMetadata = wordTimings as (WordTimingData & {
                    _lexical?: string
                    _isSpelledOut?: boolean
                  })[]

                  if (timingWithMetadata.length > 0) {
                    timingWithMetadata[0]._isSpelledOut = isSpelledOut
                    timingWithMetadata[0]._lexical = message.words.map((w) => w.word).join(" ")
                  }

                  if (process.env.NODE_ENV === "development") {
                    console.log(
                      `[Google] Anti-cheat analysis:\n` +
                      `  Words: ${wordCount}, Letters: ${letterCount}, SingleLetterWords: ${singleLetterWords}\n` +
                      `  Duration: ${totalDuration.toFixed(2)}s (${durationPerLetter.toFixed(2)}s/letter)\n` +
                      `  Signals: singleWordNotSpelled=${isSingleWordNotSpelled}, tooFast=${isTooFastForSpelling}, ` +
                      `multipleWords=${hasMultipleWords}, singleLetterRatio=${(singleLetterRatio * 100).toFixed(0)}%\n` +
                      `  Verdict: ${isSpelledOut ? "✅ SPELLED" : "❌ SAID (rejected)"}`
                    )
                  }

                  onWordTiming(wordTimings)
                }

                onFinalResult?.(text)
              }
              break

            case "error":
              console.error("[Google] Server error:", message.message)
              onError?.(new Error(message.message || "Recognition error"))
              break
          }
        } catch (err) {
          console.error("[Google] Failed to parse message:", err)
        }
      }

      ws.onerror = (event) => {
        console.error("[Google] WebSocket error:", event)
        onError?.(new Error("WebSocket error"))
      }

      ws.onclose = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[Google] WebSocket closed")
        }
        if (isActive) {
          // Unexpected close
          onError?.(new Error("WebSocket connection closed unexpectedly"))
        }
      }

      // Send start message with language
      ws.send(JSON.stringify({ type: "start", language }))

      // Get microphone stream
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: AUDIO_CONFIG.channelCount,
          sampleRate: AUDIO_CONFIG.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // Create audio context with target sample rate
      audioContext = new AudioContext({ sampleRate: AUDIO_CONFIG.sampleRate })
      const source = audioContext.createMediaStreamSource(mediaStream)

      // Create analyser for visualization
      analyserNode = audioContext.createAnalyser()
      analyserNode.fftSize = 256
      analyserNode.smoothingTimeConstant = 0.6
      source.connect(analyserNode)

      // Create script processor to capture raw audio
      // Note: ScriptProcessorNode is deprecated but works everywhere.
      // AudioWorklet is the modern alternative but requires more setup.
      const bufferSize = Math.ceil(AUDIO_CONFIG.sampleRate * AUDIO_CONFIG.chunkIntervalMs / 1000)
      scriptProcessor = audioContext.createScriptProcessor(
        // Round up to nearest power of 2 (required by Web Audio API)
        Math.pow(2, Math.ceil(Math.log2(bufferSize))),
        1, // input channels
        1  // output channels
      )

      scriptProcessor.onaudioprocess = (event) => {
        if (!isActive || !ws || ws.readyState !== WebSocket.OPEN) return

        // Get audio data
        const inputData = event.inputBuffer.getChannelData(0)

        // Convert to LINEAR16
        const int16Data = float32ToInt16(inputData)

        // Send as binary
        ws.send(int16Data.buffer)
      }

      // Connect the processor (must connect to destination to work)
      source.connect(scriptProcessor)
      scriptProcessor.connect(audioContext.destination)

      if (process.env.NODE_ENV === "development") {
        console.log("[Google] Streaming started")
      }

      // Return session controller
      return {
        stop: () => {
          if (!isActive) return
          isActive = false

          // Reset accumulated state immediately to prevent carryover to next session
          // This is critical: if we don't reset here, late-arriving messages
          // (before the 500ms cleanup) could corrupt the accumulated text
          accumulatedStableText = ""
          lastStability = 0
          lastTranscript = ""

          if (process.env.NODE_ENV === "development") {
            console.log("[Google] Stopping session (accumulated state reset)")
          }

          // Send stop message to get final results
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "stop" }))
          }

          // Wait a moment for final results then cleanup
          setTimeout(cleanup, 500)
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
      const error = err instanceof Error ? err : new Error("Failed to start Google recognition")
      onError?.(error)
      throw error
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let googleProvider: GoogleSpeechProvider | null = null

/**
 * Get the Google Speech provider singleton.
 */
export function getGoogleSpeechProvider(): GoogleSpeechProvider {
  if (!googleProvider) {
    googleProvider = new GoogleSpeechProvider()
  }
  return googleProvider
}
