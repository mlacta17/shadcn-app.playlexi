/**
 * Speech Recognition Utilities
 *
 * Shared functions and constants used across speech providers.
 * Centralizes common operations to ensure consistency and reduce duplication.
 *
 * ## Relationship to speech-server/wispr-streaming.ts
 *
 * The LETTER_PHRASES and PHONETIC_LETTER_NAMES constants are also defined
 * in speech-server/wispr-streaming.ts for the standalone speech server.
 *
 * **Why two copies?** The speech-server deploys independently to Railway/Cloud Run
 * with its own package.json. It can't import from this file because:
 * 1. The @/lib path alias doesn't exist in its tsconfig
 * 2. It has extended disambiguation phrases not needed client-side
 *
 * **If you modify LETTER_PHRASES or PHONETIC_LETTER_NAMES, also update:**
 * - speech-server/wispr-streaming.ts (DICTIONARY_CONTEXT)
 *
 * @see speech-server/wispr-streaming.ts for the server-side version
 */

// =============================================================================
// TRANSCRIPT CLEANING
// =============================================================================

/**
 * Clean transcript text for spelling comparison.
 * Removes punctuation and trims whitespace.
 *
 * @param text - Raw transcript text
 * @returns Cleaned text suitable for comparison
 *
 * @example
 * ```ts
 * cleanTranscript("Hello, world!")  // "Hello world"
 * cleanTranscript("  C A T.  ")     // "C A T"
 * ```
 */
export function cleanTranscript(text: string): string {
  return text.replace(/[.,!?;:'"]/g, "").trim()
}

// =============================================================================
// AUDIO FORMAT CONVERSION
// =============================================================================

/**
 * Convert Float32 audio samples to LINEAR16 (Int16) format.
 * Required by Google Cloud Speech-to-Text API.
 *
 * Audio data from Web Audio API is in Float32 format (-1.0 to 1.0).
 * Google Speech requires LINEAR16 (signed 16-bit PCM, -32768 to 32767).
 *
 * @param float32Array - Audio samples in Float32 format
 * @returns Audio samples in Int16 format
 *
 * @example
 * ```ts
 * const float32Data = audioBuffer.getChannelData(0)
 * const int16Data = float32ToInt16(float32Data)
 * websocket.send(int16Data.buffer)
 * ```
 */
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to [-1, 1] range to avoid overflow
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    // Convert to 16-bit signed integer
    // Negative: multiply by 0x8000 (32768)
    // Positive: multiply by 0x7FFF (32767)
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16Array
}

// =============================================================================
// SPEECH CONTEXT / PHRASE LISTS
// =============================================================================

/**
 * Individual letter names for speech recognition boosting.
 * Used to improve recognition accuracy when users spell words letter-by-letter.
 */
export const LETTER_PHRASES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const

/**
 * Phonetic pronunciations of letter names.
 * Helps speech recognition understand how letters sound when spoken.
 *
 * Example: When user says "bee", recognize it as the letter "B"
 */
export const PHONETIC_LETTER_NAMES = [
  // Standard phonetic names
  "ay", "bee", "cee", "dee", "ee", "eff", "gee", "aitch",
  "eye", "jay", "kay", "ell", "em", "en", "oh", "pee",
  "cue", "are", "ess", "tee", "you", "vee",
  "double you", "double-u", "ex", "why", "zee", "zed",
] as const

/**
 * Combined speech context for speech recognition.
 * Includes both letter names and phonetic pronunciations.
 */
export const SPEECH_CONTEXT = {
  phrases: [...LETTER_PHRASES, ...PHONETIC_LETTER_NAMES],
} as const
