/**
 * Phonetic Learning System — Type Definitions
 *
 * This module defines the TypeScript interfaces for the adaptive phonetic
 * learning system. These types are used across the learning engine,
 * recognition logger, and answer validation integration.
 *
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */

// =============================================================================
// RECOGNITION LOGGING TYPES
// =============================================================================

/**
 * A single recognition event captured during gameplay.
 *
 * This is logged every time a user submits a voice answer, regardless of
 * whether it was correct or not. Used for pattern detection.
 *
 * @example
 * ```typescript
 * const event: RecognitionEvent = {
 *   userId: "abc123",
 *   wordToSpell: "to",
 *   googleTranscript: "tee ohs",
 *   extractedLetters: "tos",
 *   wasCorrect: false,
 *   rejectionReason: undefined,
 *   inputMethod: "voice",
 * }
 * ```
 */
export interface RecognitionEvent {
  /** User who made this attempt */
  userId: string

  /** The word they were trying to spell (e.g., "to", "book", "cat") */
  wordToSpell: string

  /** Raw transcript from Google Speech (e.g., "tee ohs") */
  googleTranscript: string

  /** Letters extracted from transcript after phonetic mapping (e.g., "tos") */
  extractedLetters: string

  /** Whether the answer was marked correct */
  wasCorrect: boolean

  /** If rejected, why (e.g., "not_spelled_out", "too_fast") */
  rejectionReason?: string

  /** Input method used */
  inputMethod?: "voice" | "keyboard"
}

/**
 * Recognition log record as stored in the database.
 * Extends RecognitionEvent with database metadata.
 */
export interface RecognitionLogRecord extends RecognitionEvent {
  /** Database ID */
  id: string

  /** When this event was logged */
  createdAt: Date
}

// =============================================================================
// PHONETIC MAPPING TYPES
// =============================================================================

/**
 * How a phonetic mapping was created.
 *
 * - "auto_learned": System inferred from gameplay patterns
 * - "manual": User explicitly configured in settings
 * - "support_added": Added by support team for a specific user
 */
export type PhoneticMappingSource = "auto_learned" | "manual" | "support_added"

/**
 * A learned phonetic mapping for a specific user.
 *
 * Maps what Google heard (e.g., "ohs") to what the user intended (e.g., "o").
 * These mappings supplement the global SPOKEN_LETTER_NAMES dictionary.
 *
 * @example
 * ```typescript
 * const mapping: PhoneticMapping = {
 *   userId: "abc123",
 *   heard: "ohs",
 *   intended: "o",
 *   source: "auto_learned",
 *   confidence: 0.85,
 *   occurrenceCount: 3,
 *   timesApplied: 12,
 * }
 * ```
 */
export interface PhoneticMapping {
  /** User this mapping belongs to */
  userId: string

  /** What Google transcribed (e.g., "ohs", "tio", "zed") */
  heard: string

  /** What it should map to (single letter, e.g., "o", "t", "z") */
  intended: string

  /** How this mapping was created */
  source: PhoneticMappingSource

  /**
   * Confidence score (0.0 - 1.0).
   *
   * For auto-learned mappings:
   * - 0.5 = first occurrence, uncertain
   * - 0.75 = 2 occurrences, likely correct
   * - 0.9+ = 3+ occurrences, high confidence
   *
   * For manual mappings: always 1.0
   */
  confidence: number

  /** How many times this pattern was observed before creating the mapping */
  occurrenceCount: number

  /** How many times this mapping has been applied during validation */
  timesApplied: number
}

/**
 * Phonetic mapping record as stored in the database.
 * Extends PhoneticMapping with database metadata.
 */
export interface PhoneticMappingRecord extends PhoneticMapping {
  /** Database ID */
  id: string

  /** When this mapping was created */
  createdAt: Date

  /** When this mapping was last updated */
  updatedAt: Date
}

// =============================================================================
// LEARNING ENGINE TYPES
// =============================================================================

/**
 * Result of analyzing a recognition event for learnable patterns.
 */
export interface LearningAnalysisResult {
  /** Whether we found a pattern that can be learned */
  canLearn: boolean

  /**
   * If canLearn is true, the potential mapping to create.
   * Null if we couldn't deduce a mapping.
   */
  potentialMapping: {
    heard: string
    intended: string
  } | null

  /**
   * Why we can or cannot learn from this event.
   *
   * - "single_unknown_deduced": Exactly one unknown, successfully deduced
   * - "all_known": All words in transcript already have mappings
   * - "multiple_unknowns": Can't deduce when 2+ words are unknown
   * - "word_mismatch": Extracted letters don't align with correct word, OR
   *                     the mapping would override a protected global mapping
   * - "already_correct": Answer was correct, nothing to learn
   *
   * ## Safety Note
   *
   * "word_mismatch" is also returned when a potential mapping would override
   * an existing global mapping. For example, if Google hears "vee" and we
   * deduce it should be "b", we reject this because "vee" → "v" is protected.
   * This prevents learning incorrect mappings when Google mishears letters.
   */
  reason:
    | "single_unknown_deduced"
    | "all_known"
    | "multiple_unknowns"
    | "word_mismatch"
    | "already_correct"
}

/**
 * Configuration for the learning engine.
 */
export interface LearningEngineConfig {
  /**
   * Minimum occurrences required before creating a mapping.
   * Prevents learning from one-off Google Speech errors.
   * Default: 2
   */
  minOccurrencesToLearn: number

  /**
   * Initial confidence score for new auto-learned mappings.
   * Default: 0.75
   */
  initialConfidence: number

  /**
   * Confidence boost per additional occurrence.
   * Applied when we see the same pattern again.
   * Default: 0.1
   */
  confidenceBoostPerOccurrence: number

  /**
   * Maximum confidence score (cap).
   * Default: 0.99
   */
  maxConfidence: number
}

/**
 * Default configuration for the learning engine.
 */
export const DEFAULT_LEARNING_CONFIG: LearningEngineConfig = {
  minOccurrencesToLearn: 2,
  initialConfidence: 0.75,
  confidenceBoostPerOccurrence: 0.1,
  maxConfidence: 0.99,
}

// =============================================================================
// VALIDATION INTEGRATION TYPES
// =============================================================================

/**
 * Options for answer validation with phonetic learning.
 * Extends the existing voice validation options.
 */
export interface PhoneticValidationOptions {
  /** User ID for looking up personalized mappings */
  userId?: string

  /** Pre-loaded user mappings (optional, for performance) */
  userMappings?: Map<string, string>
}

/**
 * Result of extracting letters with phonetic learning applied.
 */
export interface PhoneticExtractionResult {
  /** The extracted letters (e.g., "to") */
  letters: string

  /** Which user-specific mappings were applied */
  appliedUserMappings: Array<{
    heard: string
    intended: string
  }>

  /** Which global mappings were applied */
  appliedGlobalMappings: Array<{
    heard: string
    intended: string
  }>

  /** Words that couldn't be mapped (potential learning opportunities) */
  unmappedWords: string[]
}
