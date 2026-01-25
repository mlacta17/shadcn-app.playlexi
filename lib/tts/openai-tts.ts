/**
 * OpenAI TTS Client — Text-to-speech using OpenAI's API.
 *
 * This module provides the core TTS functionality for generating audio.
 * It's designed for server-side use only (requires API key).
 *
 * ## Usage
 *
 * ```typescript
 * import { generateSpeech } from "@/lib/tts/openai-tts"
 *
 * const result = await generateSpeech("Your word is castle.")
 * if (result.success && result.audioBuffer) {
 *   // Upload to R2, save to file, etc.
 * }
 * ```
 *
 * ## Environment Variables
 *
 * Requires `OPENAI_API_KEY` to be set.
 *
 * @see ADR-015 (OpenAI TTS for Realistic Voice Output)
 * @see https://platform.openai.com/docs/guides/text-to-speech
 */

import {
  type TtsVoice,
  type TtsModel,
  type TtsGenerationOptions,
  type TtsGenerationResult,
  DEFAULT_VOICE,
  DEFAULT_MODEL,
} from "./types"

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * OpenAI TTS API endpoint.
 */
const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"

/**
 * Get the OpenAI API key from environment.
 * @throws Error if OPENAI_API_KEY is not set
 */
function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. " +
        "Add it to your .env.local file for development, " +
        "or set it in your deployment environment."
    )
  }

  return apiKey
}

// =============================================================================
// CORE TTS FUNCTION
// =============================================================================

/**
 * Generate speech audio from text using OpenAI TTS.
 *
 * @param text - The text to convert to speech
 * @param options - Generation options (voice, model, format, speed)
 * @returns Generation result with audio buffer or error
 *
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const result = await generateSpeech("Hello, world!")
 *
 * // With custom voice
 * const result = await generateSpeech("Hello!", { voice: "shimmer" })
 *
 * // With all options
 * const result = await generateSpeech("Hello!", {
 *   voice: "nova",
 *   model: "tts-1-hd",
 *   format: "mp3",
 *   speed: 0.9
 * })
 * ```
 */
export async function generateSpeech(
  text: string,
  options: TtsGenerationOptions = {}
): Promise<TtsGenerationResult> {
  const {
    voice = DEFAULT_VOICE,
    model = DEFAULT_MODEL,
    format = "mp3",
    speed = 1.0,
  } = options

  // Validate input
  if (!text || text.trim().length === 0) {
    return {
      success: false,
      error: "Text cannot be empty",
    }
  }

  // OpenAI has a 4096 character limit
  if (text.length > 4096) {
    return {
      success: false,
      error: `Text exceeds maximum length of 4096 characters (got ${text.length})`,
    }
  }

  // Validate speed
  if (speed < 0.25 || speed > 4.0) {
    return {
      success: false,
      error: `Speed must be between 0.25 and 4.0 (got ${speed})`,
    }
  }

  try {
    const apiKey = getApiKey()

    const response = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: format,
        speed,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `OpenAI API error: ${response.status}`

      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message
        }
      } catch {
        // Use default error message
      }

      return {
        success: false,
        error: errorMessage,
      }
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    return {
      success: true,
      audioBuffer,
      // Note: We can't easily get duration without parsing the audio
      // This would require additional libraries like music-metadata
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return {
      success: false,
      error: `TTS generation failed: ${message}`,
    }
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Generate intro audio for a word ("Your word is {word}").
 *
 * @param word - The word to introduce
 * @param options - Generation options
 */
export async function generateIntroAudio(
  word: string,
  options?: TtsGenerationOptions
): Promise<TtsGenerationResult> {
  const text = `Your word is: ${word}.`
  return generateSpeech(text, options)
}

/**
 * Generate sentence audio for a word.
 *
 * @param sentence - The example sentence
 * @param options - Generation options
 */
export async function generateSentenceAudio(
  sentence: string,
  options?: TtsGenerationOptions
): Promise<TtsGenerationResult> {
  return generateSpeech(sentence, options)
}

/**
 * Generate definition audio for a word.
 *
 * @param word - The word being defined
 * @param definition - The definition
 * @param options - Generation options
 */
export async function generateDefinitionAudio(
  word: string,
  definition: string,
  options?: TtsGenerationOptions
): Promise<TtsGenerationResult> {
  // Include the word for context, then the definition
  const text = `${word}. ${definition}`
  return generateSpeech(text, options)
}

// =============================================================================
// VALIDATION & HELPERS
// =============================================================================

/**
 * Validate that the TTS configuration is correct.
 * Call this at startup to catch configuration errors early.
 *
 * @throws Error if configuration is invalid
 */
export function validateTtsConfig(): void {
  getApiKey() // Will throw if not set
}

/**
 * Check if TTS is configured (API key is available).
 * Useful for conditional logic without throwing.
 */
export function isTtsConfigured(): boolean {
  try {
    getApiKey()
    return true
  } catch {
    return false
  }
}

/**
 * Estimate the cost of generating TTS for a given text.
 *
 * OpenAI TTS pricing (as of 2024):
 * - tts-1: $15.00 per 1M characters
 * - tts-1-hd: $30.00 per 1M characters
 *
 * @param text - The text to estimate
 * @param model - The model to use
 * @returns Estimated cost in USD
 */
export function estimateTtsCost(
  text: string,
  model: TtsModel = DEFAULT_MODEL
): number {
  const costPerMillion = model === "tts-1-hd" ? 30.0 : 15.0
  return (text.length / 1_000_000) * costPerMillion
}

/**
 * Estimate the cost for a batch of words.
 *
 * @param words - Array of { word, sentence, definition }
 * @param model - The model to use
 * @returns Estimated total cost in USD
 */
export function estimateBatchCost(
  words: Array<{ word: string; sentence: string; definition: string }>,
  model: TtsModel = DEFAULT_MODEL
): { totalCharacters: number; estimatedCost: number } {
  let totalCharacters = 0

  for (const { word, sentence, definition } of words) {
    // Intro: "Your word is: {word}."
    totalCharacters += `Your word is: ${word}.`.length
    // Sentence
    totalCharacters += sentence.length
    // Definition: "{word}. {definition}"
    totalCharacters += `${word}. ${definition}`.length
  }

  const estimatedCost = estimateTtsCost("x".repeat(totalCharacters), model)

  return {
    totalCharacters,
    estimatedCost,
  }
}
