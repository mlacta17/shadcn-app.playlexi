/**
 * TTS Module — Text-to-speech functionality for PlayLexi.
 *
 * This module provides pre-generated, high-quality voice audio for:
 * - Word introductions ("Your word is castle")
 * - Example sentences
 * - Definitions
 *
 * ## Architecture (ADR-015)
 *
 * We use OpenAI TTS with a "Generate Once, Serve Forever" pattern:
 * 1. Audio is pre-generated at build time via scripts/generate-tts.ts
 * 2. Audio files are stored in Cloudflare R2
 * 3. URLs are stored in the words table
 * 4. During gameplay, audio is served from R2 (zero TTS API calls)
 *
 * ## Usage
 *
 * ```typescript
 * // Server-side: Generate TTS audio
 * import { generateSpeech, generateIntroAudio } from "@/lib/tts"
 *
 * const result = await generateIntroAudio("castle")
 * if (result.success) {
 *   await uploadToR2(result.audioBuffer)
 * }
 *
 * // Client-side: Check if TTS URLs exist (in word-service.ts)
 * if (word.introAudioUrl) {
 *   const audio = new Audio(word.introAudioUrl)
 *   await audio.play()
 * }
 * ```
 *
 * ## Cost
 *
 * - One-time: ~$41 to generate all TTS for 10K words
 * - Ongoing: <$1/month (R2 storage, zero egress)
 *
 * @see ADR-015 (OpenAI TTS for Realistic Voice Output)
 * @see scripts/generate-tts.ts (generation script)
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  TtsVoice,
  TtsModel,
  TtsAudioType,
  TtsGenerationOptions,
  TtsGenerationResult,
  WordTtsUrls,
  WordTtsContent,
  TtsBatchProgress,
  TtsBatchProgressCallback,
  TtsBatchOptions,
  TtsBatchSummary,
} from "./types"

export {
  DEFAULT_VOICE,
  DEFAULT_MODEL,
  TTS_AUDIO_PATHS,
  buildIntroText,
  buildDefinitionText,
} from "./types"

// =============================================================================
// OPENAI TTS CLIENT EXPORTS
// =============================================================================

export {
  generateSpeech,
  generateIntroAudio,
  generateSentenceAudio,
  generateDefinitionAudio,
  validateTtsConfig,
  isTtsConfigured,
  estimateTtsCost,
  estimateBatchCost,
} from "./openai-tts"
