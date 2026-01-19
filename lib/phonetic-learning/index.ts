/**
 * Phonetic Learning System
 *
 * An adaptive system that improves speech recognition accuracy by learning
 * from each user's unique voice patterns. Instead of relying solely on
 * static phonetic mappings, the system observes gameplay and automatically
 * learns user-specific pronunciation variations.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │  TIER 1: Global Defaults (SPOKEN_LETTER_NAMES)              │
 * │  - 366 hardcoded mappings in answer-validation.ts           │
 * │  - Works for ~80% of users                                  │
 * ├─────────────────────────────────────────────────────────────┤
 * │  TIER 2: Auto-Learned Mappings (per user)                   │
 * │  - System learns from user's gameplay patterns              │
 * │  - Stored in database                                       │
 * ├─────────────────────────────────────────────────────────────┤
 * │  TIER 3: Manual Calibration (optional, future)              │
 * │  - User explicitly corrects mappings                        │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Lookup order: Tier 3 → Tier 2 → Tier 1
 * ```
 *
 * ## Usage
 *
 * ### Logging Recognition Events (Phase 4.1)
 *
 * ```typescript
 * import { logRecognitionEvent } from "@/lib/phonetic-learning"
 *
 * // After each voice answer submission
 * await logRecognitionEvent({
 *   userId: currentUser.id,
 *   wordToSpell: "book",
 *   googleTranscript: "bee ohs ohs kay",
 *   extractedLetters: "book",
 *   wasCorrect: true,
 *   inputMethod: "voice",
 * })
 * ```
 *
 * ### Auto-Learning (Phase 4.2)
 *
 * ```typescript
 * import {
 *   analyzeForLearning,
 *   findLearnablePatterns,
 *   createMappingFromPattern,
 * } from "@/lib/phonetic-learning"
 *
 * // Analyze a single event
 * const analysis = analyzeForLearning(failedEvent, SPOKEN_LETTER_NAMES)
 * if (analysis.canLearn) {
 *   console.log("Learned:", analysis.potentialMapping)
 * }
 *
 * // Find patterns across multiple events
 * const patterns = findLearnablePatterns(userEvents)
 * for (const pattern of patterns) {
 *   const mapping = createMappingFromPattern(pattern, userId)
 *   // Save mapping to database
 * }
 * ```
 *
 * ### Applying Mappings
 *
 * ```typescript
 * import { applyMappingsToTranscript } from "@/lib/phonetic-learning"
 *
 * const result = applyMappingsToTranscript(
 *   "tee ohs",
 *   SPOKEN_LETTER_NAMES,
 *   userMappings // Map<string, string>
 * )
 * console.log(result.letters) // "to"
 * ```
 *
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Recognition logging types
  RecognitionEvent,
  RecognitionLogRecord,
  // Mapping types
  PhoneticMappingSource,
  PhoneticMapping,
  PhoneticMappingRecord,
  // Learning engine types
  LearningAnalysisResult,
  LearningEngineConfig,
  // Validation types
  PhoneticValidationOptions,
  PhoneticExtractionResult,
} from "./types"

export { DEFAULT_LEARNING_CONFIG } from "./types"

// =============================================================================
// RECOGNITION LOGGER EXPORTS (Phase 4.1)
// =============================================================================

export {
  // Client-side logging
  logRecognitionEvent,
  // Server-side helpers
  createLogRecord,
  validateRecognitionEvent,
  // Query helpers
  buildLogQuery,
  type RecognitionLogQuery,
} from "./recognition-logger"

// =============================================================================
// LEARNING ENGINE EXPORTS (Phase 4.2)
// =============================================================================

export {
  // Analysis
  analyzeForLearning,
  // Pattern detection
  findLearnablePatterns,
  type PatternCandidate,
  // Mapping creation
  createMappingFromPattern,
  // Mapping application
  applyMappingsToTranscript,
  // Safety validation (prevents learning incorrect mappings)
  isProtectedMapping,
  validatePotentialMapping,
  type MappingValidationResult,
} from "./learning-engine"
