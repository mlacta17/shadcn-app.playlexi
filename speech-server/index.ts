/**
 * Speech Recognition WebSocket Server
 *
 * A dedicated server for real-time speech recognition using Google Cloud Speech-to-Text.
 *
 * ## Why a Separate Server?
 *
 * Next.js App Router doesn't support WebSockets in route handlers. To achieve
 * true real-time streaming, we need a persistent WebSocket connection that can
 * maintain a gRPC stream to Google.
 *
 * ## How It Works
 *
 * 1. Client connects via WebSocket
 * 2. Client sends "start" message with language preference
 * 3. Server creates a gRPC stream to Google Speech
 * 4. Client sends audio data as binary frames
 * 5. Server forwards audio to Google and streams results back
 * 6. Client sends "stop" message when done
 *
 * ## Running
 *
 * ```bash
 * # From project root
 * npm run dev:speech
 *
 * # Or directly
 * npx ts-node speech-server/index.ts
 * ```
 */

import { WebSocketServer, WebSocket, RawData } from "ws"
import * as dotenv from "dotenv"
import * as path from "path"
import {
  createStreamingSession,
  validateCredentials,
  type StreamingSession,
} from "./google-streaming"
import type { ClientMessage, ServerMessage } from "./types"

// =============================================================================
// CONFIGURATION
// =============================================================================

// Load environment variables from parent directory's .env.local
dotenv.config({ path: path.join(__dirname, "..", ".env.local") })

const PORT = parseInt(process.env.SPEECH_SERVER_PORT || "3002", 10)
const isDev = process.env.NODE_ENV !== "production"

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Send a JSON message to a WebSocket client.
 */
function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message))
  }
}

/**
 * Parse an incoming WebSocket message.
 */
function parseMessage(data: RawData): ClientMessage | null {
  try {
    const str = data.toString()
    return JSON.parse(str) as ClientMessage
  } catch {
    return null
  }
}

/**
 * Clean transcript text for spelling comparison.
 */
function cleanTranscript(text: string): string {
  return text
    .replace(/[.,!?;:'"]/g, "")
    .trim()
}

// =============================================================================
// MAIN SERVER
// =============================================================================

/**
 * Start the WebSocket server.
 */
function startServer(): void {
  // Validate credentials before starting
  const creds = validateCredentials()
  if (!creds.valid) {
    console.error("❌ Missing Google Cloud credentials:")
    creds.missing.forEach((field) => console.error(`   - ${field}`))
    console.error("\nSet these in your .env.local file.")
    process.exit(1)
  }

  // Create WebSocket server
  const wss = new WebSocketServer({ port: PORT })

  console.log(`
┌─────────────────────────────────────────────────────┐
│           Speech Recognition Server                  │
├─────────────────────────────────────────────────────┤
│  Status:    ✅ Running                               │
│  Port:      ${PORT}                                      │
│  Protocol:  WebSocket                                │
│  Provider:  Google Cloud Speech-to-Text              │
├─────────────────────────────────────────────────────┤
│  Connect:   ws://localhost:${PORT}                       │
└─────────────────────────────────────────────────────┘
`)

  // Handle new connections
  wss.on("connection", (ws: WebSocket) => {
    if (isDev) {
      console.log("[Server] New client connected")
    }

    // Track the streaming session for this connection
    let session: StreamingSession | null = null

    // Send ready message
    sendMessage(ws, {
      type: "ready",
      timestamp: Date.now(),
    })

    // Handle incoming messages
    ws.on("message", (data: RawData, isBinary: boolean) => {
      // Binary data = audio
      if (isBinary) {
        if (session && session.isActive()) {
          session.write(Buffer.from(data as ArrayBuffer))
        } else if (isDev) {
          console.warn("[Server] Received audio but no active session")
        }
        return
      }

      // Text data = JSON command
      const message = parseMessage(data)
      if (!message) {
        sendMessage(ws, {
          type: "error",
          message: "Invalid message format",
        })
        return
      }

      switch (message.type) {
        case "start": {
          // End any existing session
          if (session) {
            session.end()
          }

          const language = message.language || "en-US"
          if (isDev) {
            console.log(`[Server] Starting session (language: ${language})`)
          }

          // Create new streaming session
          session = createStreamingSession(
            {
              projectId: creds.projectId!,
              clientEmail: creds.clientEmail!,
              privateKey: process.env.GOOGLE_CLOUD_PRIVATE_KEY!.replace(/\\n/g, "\n"),
            },
            {
              onInterimResult: (transcript, stability) => {
                const cleaned = cleanTranscript(transcript)
                sendMessage(ws, {
                  type: "interim",
                  transcript: cleaned,
                  stability,
                  timestamp: Date.now(),
                })
              },

              onFinalResult: (transcript, words, confidence) => {
                const cleaned = cleanTranscript(transcript)
                sendMessage(ws, {
                  type: "final",
                  transcript: cleaned,
                  words: words.map((w) => ({
                    ...w,
                    word: w.word.replace(/[.,!?;:'"]/g, "").trim(),
                  })),
                  confidence,
                  timestamp: Date.now(),
                })
              },

              onError: (error) => {
                sendMessage(ws, {
                  type: "error",
                  message: error.message,
                })
              },
            },
            language
          )
          break
        }

        case "stop": {
          if (isDev) {
            console.log("[Server] Stopping session")
          }

          if (session) {
            session.end()
            session = null
          }
          break
        }
      }
    })

    // Handle connection close
    ws.on("close", () => {
      if (isDev) {
        console.log("[Server] Client disconnected")
      }

      if (session) {
        session.end()
        session = null
      }
    })

    // Handle errors
    ws.on("error", (error) => {
      console.error("[Server] WebSocket error:", error)

      if (session) {
        session.end()
        session = null
      }
    })
  })

  // Handle server errors
  wss.on("error", (error) => {
    console.error("[Server] Server error:", error)
  })

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n[Server] Shutting down...")
    wss.close(() => {
      console.log("[Server] Closed")
      process.exit(0)
    })
  })
}

// =============================================================================
// ENTRY POINT
// =============================================================================

startServer()
