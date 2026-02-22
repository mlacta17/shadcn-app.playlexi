/**
 * Speech Server Types
 *
 * Shared type definitions for the WebSocket speech recognition server.
 */

// =============================================================================
// CLIENT → SERVER MESSAGES
// =============================================================================

/**
 * Message sent from client to start a recognition session.
 */
export interface StartMessage {
  type: "start"
  language?: string // BCP-47 language code, defaults to "en-US"
  sampleRate?: number // Audio sample rate in Hz, defaults to 16000
}

/**
 * Message sent from client to stop recognition.
 */
export interface StopMessage {
  type: "stop"
}

/**
 * Union type for all client messages.
 * Audio data is sent as binary frames, not JSON.
 */
export type ClientMessage = StartMessage | StopMessage

// =============================================================================
// SERVER → CLIENT MESSAGES
// =============================================================================

/**
 * Interim recognition result (partial, may change).
 */
export interface InterimResultMessage {
  type: "interim"
  transcript: string
  stability?: number // 0-1, how likely this will change
  timestamp: number
}

/**
 * Final recognition result (complete, won't change).
 */
export interface FinalResultMessage {
  type: "final"
  transcript: string
  words: WordTiming[]
  confidence: number
  timestamp: number
}

/**
 * Error message.
 */
export interface ErrorMessage {
  type: "error"
  message: string
  code?: string
}

/**
 * Ready message sent when connection is established.
 */
export interface ReadyMessage {
  type: "ready"
  timestamp: number
}

/**
 * Union type for all server messages.
 */
export type ServerMessage =
  | InterimResultMessage
  | FinalResultMessage
  | ErrorMessage
  | ReadyMessage

// =============================================================================
// WORD TIMING
// =============================================================================

/**
 * Word-level timing information.
 * Kept in the protocol for compatibility; Wispr sends empty arrays.
 */
export interface WordTiming {
  word: string
  startTime: number // seconds from start of audio
  endTime: number // seconds from start of audio
  confidence?: number
}

// =============================================================================
// WISPR FLOW API TYPES
// =============================================================================
//
// Client → Wispr messages use `type` as the discriminator.
// Wispr → Client responses use `status` as the discriminator.
//
// @see https://api-docs.wisprflow.ai/websocket_api

// --- Client → Wispr ---

/**
 * Wispr auth message sent after WebSocket connection opens.
 * Uses `type: "auth"` with language array and context object.
 */
export interface WisprAuthMessage {
  type: "auth"
  language: string[] // e.g. ["en"]
  context: {
    app: { name: string; type: string }
    dictionary_context: string[]
  }
}

/**
 * Wispr append message — sends batched base64-encoded WAV audio packets.
 */
export interface WisprAppendMessage {
  type: "append"
  position: number // starting index of this batch (cumulative packets sent before this append)
  audio_packets: {
    packets: string[] // base64-encoded WAV chunks
    volumes: number[] // RMS volume per packet
    packet_duration: number // seconds per packet (e.g. 0.032)
    audio_encoding: "wav"
    byte_encoding: "base64"
  }
}

/**
 * Wispr commit message — signals end of audio stream.
 */
export interface WisprCommitMessage {
  type: "commit"
  total_packets: number
}

/**
 * Union of all client → Wispr messages.
 */
export type WisprClientMessage =
  | WisprAuthMessage
  | WisprAppendMessage
  | WisprCommitMessage

// --- Wispr → Client ---

/**
 * Wispr text response — interim or final transcription result.
 * Transcript is nested inside `body.text`.
 */
export interface WisprTextResponse {
  status: "text"
  body: { text: string }
  final: boolean
}

/**
 * Wispr auth acknowledgement response.
 */
export interface WisprAuthResponse {
  status: "auth"
}

/**
 * Wispr info response (e.g., commit_received).
 */
export interface WisprInfoResponse {
  status: "info"
  message?: { event: string } | string
}

/**
 * Wispr error response.
 */
export interface WisprErrorResponse {
  status: "error"
  message?: string | Record<string, unknown>
  error?: string
}

/**
 * Union of all Wispr → Client responses.
 */
export type WisprServerMessage =
  | WisprTextResponse
  | WisprAuthResponse
  | WisprInfoResponse
  | WisprErrorResponse
