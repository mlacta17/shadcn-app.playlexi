/**
 * Google Cloud Speech-to-Text Streaming API Route
 *
 * This route handles WebSocket connections for real-time speech recognition.
 * Audio is received from the client and streamed to Google Cloud Speech-to-Text.
 *
 * ## Authentication
 * Uses service account credentials set via environment variables:
 * - GOOGLE_CLOUD_PROJECT_ID
 * - GOOGLE_CLOUD_CLIENT_EMAIL
 * - GOOGLE_CLOUD_PRIVATE_KEY
 *
 * ## Protocol
 * Client sends: Binary audio data (LINEAR16, 16kHz, mono)
 * Server sends: JSON messages with transcription results
 *
 * @see https://cloud.google.com/speech-to-text/docs/streaming-recognize
 */

import { NextRequest } from "next/server"
import speech from "@google-cloud/speech"

// Type definitions for Google Speech API results
interface SpeechRecognitionResult {
  alternatives?: Array<{
    transcript?: string
    confidence?: number
    words?: Array<{
      word?: string
      startTime?: { seconds?: string | number; nanos?: number }
      endTime?: { seconds?: string | number; nanos?: number }
    }>
  }>
  isFinal?: boolean
}

interface StreamingRecognitionResult {
  results?: SpeechRecognitionResult[]
}

/**
 * Convert Google's duration format to seconds
 */
function durationToSeconds(duration: { seconds?: string | number; nanos?: number } | undefined): number {
  if (!duration) return 0
  const seconds = typeof duration.seconds === "string" ? parseInt(duration.seconds, 10) : (duration.seconds || 0)
  const nanos = duration.nanos || 0
  return seconds + nanos / 1e9
}

/**
 * Speech context for letter recognition
 */
const SPEECH_CONTEXT = {
  phrases: [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "ay", "bee", "cee", "dee", "ee", "eff", "gee", "aitch",
    "eye", "jay", "kay", "ell", "em", "en", "oh", "pee",
    "cue", "are", "ess", "tee", "you", "vee",
    "double you", "double-u", "ex", "why", "zee", "zed",
  ],
  boost: 20,
}

export async function GET(request: NextRequest) {
  // Check for required environment variables
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!projectId || !clientEmail || !privateKey) {
    return new Response(
      JSON.stringify({
        error: "Google Cloud credentials not configured. Set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_CLIENT_EMAIL, and GOOGLE_CLOUD_PRIVATE_KEY.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }

  // Get language from query params
  const { searchParams } = new URL(request.url)
  const language = searchParams.get("language") || "en-US"

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = request.headers.get("upgrade")
  if (upgradeHeader !== "websocket") {
    return new Response(
      JSON.stringify({ error: "Expected WebSocket upgrade" }),
      { status: 426, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    // Create Google Speech client with explicit credentials
    const client = new speech.SpeechClient({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    })

    // Create a streaming recognize request
    const recognizeStream = client.streamingRecognize({
      config: {
        encoding: "LINEAR16" as const,
        sampleRateHertz: 16000,
        languageCode: language,
        enableAutomaticPunctuation: false,
        enableWordTimeOffsets: true, // Critical for anti-cheat!
        model: "latest_short", // Optimized for short utterances like letter spelling
        speechContexts: [SPEECH_CONTEXT],
        // Use enhanced model for better accuracy
        useEnhanced: true,
      },
      interimResults: true,
    })

    // Handle the WebSocket upgrade
    // Note: Next.js 13+ doesn't have native WebSocket support in route handlers
    // We need to use a different approach - using Server-Sent Events or
    // a separate WebSocket server. For now, let's use a polling approach
    // or switch to a REST-based streaming approach.

    // Since Next.js App Router doesn't support WebSocket in route handlers,
    // we'll need to use a different approach. Let me create a simpler
    // POST-based approach that uses server-sent events or chunked response.

    return new Response(
      JSON.stringify({
        error: "WebSocket not supported in Next.js App Router. Use the POST endpoint instead.",
        suggestion: "Use POST /api/google-speech/transcribe for single audio transcription",
      }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("[Google Speech] Error:", err)
    return new Response(
      JSON.stringify({ error: "Failed to initialize Google Speech client" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

/**
 * POST handler for audio transcription.
 *
 * Accepts audio data and returns transcription with word-level timing.
 * This is a simpler approach that works with Next.js App Router.
 */
export async function POST(request: NextRequest) {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID
  const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!projectId || !clientEmail || !privateKey) {
    return new Response(
      JSON.stringify({
        error: "Google Cloud credentials not configured",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    // Get audio data from request body
    const formData = await request.formData()
    const audioFile = formData.get("audio") as Blob
    const language = (formData.get("language") as string) || "en-US"

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: "No audio file provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Convert blob to buffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const audioBytes = Buffer.from(arrayBuffer).toString("base64")

    // Create Google Speech client
    const client = new speech.SpeechClient({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    })

    // Transcribe the audio
    const [response] = await client.recognize({
      config: {
        encoding: "WEBM_OPUS" as const, // Browser MediaRecorder typically outputs WebM
        sampleRateHertz: 48000, // WebM default
        languageCode: language,
        enableAutomaticPunctuation: false,
        enableWordTimeOffsets: true,
        model: "latest_short",
        speechContexts: [SPEECH_CONTEXT],
        useEnhanced: true,
      },
      audio: {
        content: audioBytes,
      },
    })

    // Process results
    const results = response.results || []
    const transcripts: Array<{
      transcript: string
      confidence: number
      words: Array<{
        word: string
        startTime: number
        endTime: number
      }>
    }> = []

    for (const result of results as SpeechRecognitionResult[]) {
      const alternative = result.alternatives?.[0]
      if (alternative?.transcript) {
        const words = (alternative.words || []).map((w) => ({
          word: w.word || "",
          startTime: durationToSeconds(w.startTime),
          endTime: durationToSeconds(w.endTime),
        }))

        transcripts.push({
          transcript: alternative.transcript,
          confidence: alternative.confidence || 0,
          words,
        })
      }
    }

    // Combine all transcripts
    const fullTranscript = transcripts.map((t) => t.transcript).join(" ")
    const allWords = transcripts.flatMap((t) => t.words)

    return new Response(
      JSON.stringify({
        transcript: fullTranscript,
        words: allWords,
        isFinal: true,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("[Google Speech] Transcription error:", err)
    return new Response(
      JSON.stringify({ error: "Transcription failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
