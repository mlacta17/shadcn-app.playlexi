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

/**
 * Wispr config/auth message sent after WebSocket connection opens.
 */
export interface WisprConfigMessage {
  status: "config"
  language: string
  dictionary_context: string[]
}

/**
 * Wispr append message — sends a chunk of base64-encoded WAV audio.
 */
export interface WisprAppendMessage {
  status: "append"
  audio: string // base64-encoded WAV
  position: number // monotonically incrementing packet counter
}

/**
 * Wispr commit message — signals end of audio stream.
 */
export interface WisprCommitMessage {
  status: "commit"
  position: number // total packet count
}

/**
 * Wispr text response — interim or final transcription result.
 */
export interface WisprTextResponse {
  status: "text"
  text: string
  final: boolean
  confidence?: number
}

/**
 * Wispr auth/config acknowledgement response.
 */
export interface WisprAuthResponse {
  status: "auth" | "config_ok"
}

/**
 * Wispr error response.
 */
export interface WisprErrorResponse {
  status: "error"
  message?: string
  error?: string
}

/**
 * Union of all Wispr server responses.
 */
export type WisprServerMessage =
  | WisprTextResponse
  | WisprAuthResponse
  | WisprErrorResponse
