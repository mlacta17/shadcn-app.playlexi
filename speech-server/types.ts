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
 * Word-level timing information from Google Speech.
 */
export interface WordTiming {
  word: string
  startTime: number // seconds from start of audio
  endTime: number // seconds from start of audio
  confidence?: number
}

// =============================================================================
// GOOGLE SPEECH API TYPES
// =============================================================================

/**
 * Google Speech streaming configuration.
 */
export interface StreamingConfig {
  languageCode: string
  sampleRateHertz: number
  encoding: "LINEAR16" | "WEBM_OPUS"
  enableWordTimeOffsets: boolean
  enableAutomaticPunctuation: boolean
  model: string
  useEnhanced: boolean
  speechContexts?: Array<{
    phrases: string[]
    boost?: number
  }>
}

/**
 * Parsed word timing from Google's protobuf response.
 */
export interface GoogleWordInfo {
  word?: string
  startTime?: {
    seconds?: string | number
    nanos?: number
  }
  endTime?: {
    seconds?: string | number
    nanos?: number
  }
}

/**
 * Parsed result from Google's streaming response.
 */
export interface GoogleStreamingResult {
  alternatives?: Array<{
    transcript?: string
    confidence?: number
    words?: GoogleWordInfo[]
  }>
  isFinal?: boolean
  stability?: number
}
