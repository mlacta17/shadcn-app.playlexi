/**
 * TTS Types — TypeScript interfaces for text-to-speech functionality.
 *
 * @see ADR-015 (OpenAI TTS for Realistic Voice Output)
 */

// =============================================================================
// VOICE OPTIONS
// =============================================================================

/**
 * Available voices from OpenAI TTS API.
 *
 * | Voice | Characteristics | Best For |
 * |-------|-----------------|----------|
 * | alloy | Neutral, balanced | General purpose |
 * | echo | Warm, conversational | Narration |
 * | fable | Expressive, dramatic | Storytelling |
 * | onyx | Deep, authoritative | Formal content |
 * | nova | Clear, friendly | Educational content |
 * | shimmer | Warm, casual, friendly | **Spelling bee (recommended)** |
 */
export type TtsVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"

/**
 * Default voice for PlayLexi.
 * "shimmer" is warm, friendly, and casual - perfect for a spelling bee game.
 * It sounds natural and approachable without being too formal or robotic.
 */
export const DEFAULT_VOICE: TtsVoice = "shimmer"

// =============================================================================
// TTS MODELS
// =============================================================================

/**
 * OpenAI TTS model options.
 *
 * | Model | Quality | Latency | Cost |
 * |-------|---------|---------|------|
 * | tts-1 | Good | Fast | $15/1M chars |
 * | tts-1-hd | Better | Slower | $30/1M chars |
 *
 * For pre-generated audio (our use case), quality > latency, so tts-1-hd is preferred.
 * For real-time (not our use case), tts-1 would be better.
 */
export type TtsModel = "tts-1" | "tts-1-hd"

/**
 * Default model for PlayLexi.
 * Using HD model for higher quality, more natural-sounding speech.
 * Since audio is pre-generated (not real-time), quality > latency.
 */
export const DEFAULT_MODEL: TtsModel = "tts-1-hd"

// =============================================================================
// AUDIO TYPES
// =============================================================================

/**
 * Types of TTS audio we generate for each word.
 */
export type TtsAudioType = "intro" | "sentence" | "definition"

/**
 * R2 storage paths for each audio type.
 */
export const TTS_AUDIO_PATHS: Record<TtsAudioType, string> = {
  intro: "audio/tts/intros",
  sentence: "audio/tts/sentences",
  definition: "audio/tts/definitions",
}

// =============================================================================
// GENERATION OPTIONS
// =============================================================================

/**
 * Options for generating TTS audio.
 */
export interface TtsGenerationOptions {
  /** Voice to use (default: nova) */
  voice?: TtsVoice
  /** Model to use (default: tts-1) */
  model?: TtsModel
  /** Response format (default: mp3) */
  format?: "mp3" | "opus" | "aac" | "flac"
  /** Playback speed (0.25 to 4.0, default: 1.0) */
  speed?: number
}

/**
 * Result of a TTS generation operation.
 */
export interface TtsGenerationResult {
  /** Whether generation succeeded */
  success: boolean
  /** Audio buffer (if successful) */
  audioBuffer?: Buffer
  /** Error message (if failed) */
  error?: string
  /** Duration of the generated audio in seconds */
  durationSeconds?: number
}

// =============================================================================
// WORD TTS DATA
// =============================================================================

/**
 * TTS audio URLs for a word.
 * These are stored in the words table and returned via API.
 */
export interface WordTtsUrls {
  /** URL for "Your word is {word}" audio */
  introAudioUrl?: string | null
  /** URL for example sentence audio */
  sentenceAudioUrl?: string | null
  /** URL for definition audio */
  definitionAudioUrl?: string | null
}

/**
 * Text content to generate TTS for a word.
 */
export interface WordTtsContent {
  /** The word itself */
  word: string
  /** "Your word is {word}" */
  introText: string
  /** Example sentence */
  sentenceText: string
  /** Word definition */
  definitionText: string
}

/**
 * Build the intro text for a word.
 * @param word - The word to introduce
 */
export function buildIntroText(word: string): string {
  return `Your word is: ${word}.`
}

/**
 * Build the definition text for a word.
 * Includes the word itself for context, then the definition.
 * @param word - The word
 * @param definition - The definition
 */
export function buildDefinitionText(word: string, definition: string): string {
  return `${word}. ${definition}`
}

// =============================================================================
// BATCH GENERATION
// =============================================================================

/**
 * Progress callback for batch TTS generation.
 */
export interface TtsBatchProgress {
  /** Current word being processed */
  currentWord: string
  /** Index of current word (0-based) */
  currentIndex: number
  /** Total number of words to process */
  totalWords: number
  /** Type of audio being generated */
  audioType: TtsAudioType
  /** Whether this word's audio was successful */
  success: boolean
  /** Error message if failed */
  error?: string
}

/**
 * Callback function for batch progress updates.
 */
export type TtsBatchProgressCallback = (progress: TtsBatchProgress) => void

/**
 * Options for batch TTS generation.
 */
export interface TtsBatchOptions {
  /** Voice to use for all audio */
  voice?: TtsVoice
  /** Model to use */
  model?: TtsModel
  /** Whether to skip words that already have TTS audio */
  skipExisting?: boolean
  /** Delay between API calls in ms (for rate limiting) */
  delayMs?: number
  /** Progress callback */
  onProgress?: TtsBatchProgressCallback
  /** Whether to continue on errors */
  continueOnError?: boolean
}

/**
 * Summary of a batch TTS generation run.
 */
export interface TtsBatchSummary {
  /** Total words processed */
  totalProcessed: number
  /** Successfully generated */
  successful: number
  /** Failed to generate */
  failed: number
  /** Skipped (already had audio) */
  skipped: number
  /** Words that failed */
  failedWords: Array<{ word: string; error: string }>
  /** Total duration in seconds */
  durationSeconds: number
}
