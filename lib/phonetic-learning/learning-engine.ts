/**
 * Learning Engine — Phase 4.2: Auto-Learning Inference
 *
 * This module implements the core learning algorithm that:
 * 1. Analyzes failed recognition attempts
 * 2. Deduces what unknown sounds should map to
 * 3. Creates personalized phonetic mappings
 * 4. PROTECTS against learning incorrect mappings
 *
 * ## How It Works
 *
 * We know the correct word beforehand, so we can deduce unknown mappings:
 *
 * ```
 * Word to spell: "TO"
 * Google hears: ["tee", "ohs"]
 *
 * Step 1: Look up known mappings
 *   "tee" → "t" (known ✅)
 *   "ohs" → ??? (unknown ❓)
 *
 * Step 2: Deduce the unknown
 *   Correct word = "to" (2 letters: t, o)
 *   Known so far = "t" (1 letter)
 *   Remaining = "o"
 *   Therefore: "ohs" must equal "o"
 * ```
 *
 * ## Safety Constraints (CRITICAL)
 *
 * The system includes safeguards to prevent learning WRONG mappings:
 *
 * **Problem scenario:**
 * - User says "B" but Google mishears as "vee"
 * - Without safeguards: system learns "vee" → "b" (WRONG!)
 * - This corrupts legitimate "V" inputs
 *
 * **Safeguards implemented:**
 * 1. NEVER override existing global mappings (e.g., "vee" already → "v")
 * 2. Only learn truly novel sounds not in the global dictionary
 * 3. Require consistent patterns across multiple different words
 * 4. All 366 global mappings are "protected" - can't be remapped
 *
 * ## Other Constraints
 *
 * - Only learn when exactly ONE unknown exists (can't deduce multiple)
 * - Require 2+ occurrences before creating a mapping
 * - Per-user mappings only (isolate user-specific patterns)
 *
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */

import type {
  RecognitionEvent,
  LearningAnalysisResult,
  LearningEngineConfig,
  PhoneticMapping,
} from "./types"

// Import the global phonetic mappings from answer-validation
// We need this to know which words are already mapped
import { SPOKEN_LETTER_NAMES } from "../answer-validation"

// =============================================================================
// PROTECTED MAPPINGS — NEVER OVERRIDE THESE
// =============================================================================

/**
 * Build a Set of all "heard" values that already exist in global mappings.
 * These are PROTECTED — the learning system will NEVER create user mappings
 * that would override these.
 *
 * ## Why This Exists
 *
 * If Google mishears "B" as "vee", we don't want to learn "vee" → "b"
 * because "vee" is already correctly mapped to "v" in our global dictionary.
 *
 * This Set allows O(1) lookup to check if a word is protected.
 */
const PROTECTED_HEARD_VALUES: Set<string> = new Set(Object.keys(SPOKEN_LETTER_NAMES))

/**
 * Check if a "heard" value is protected (exists in global mappings).
 *
 * @param heard - The word Google transcribed
 * @returns True if this word is already mapped globally and should not be overridden
 *
 * @example
 * ```typescript
 * isProtectedMapping("vee")  // true — "vee" → "v" exists globally
 * isProtectedMapping("ohs")  // false — novel sound, can be learned
 * ```
 */
export function isProtectedMapping(heard: string): boolean {
  return PROTECTED_HEARD_VALUES.has(heard.toLowerCase().trim())
}

/**
 * Validation result for a potential mapping.
 */
export interface MappingValidationResult {
  /** Whether the mapping is safe to create */
  isValid: boolean
  /** Why the mapping was accepted or rejected */
  reason:
    | "valid_novel_mapping"
    | "protected_global_mapping"
    | "conflicts_with_existing_user_mapping"
    | "intended_mismatch"
}

/**
 * Validate whether a potential mapping is safe to create.
 *
 * This is the CRITICAL safety check that prevents learning incorrect mappings.
 *
 * ## Validation Rules
 *
 * 1. If "heard" exists in global mappings → REJECT (protected)
 * 2. If user already has a mapping for "heard" with different "intended" → REJECT (conflict)
 * 3. Otherwise → ACCEPT
 *
 * @param heard - What Google transcribed
 * @param intended - What we think it should map to
 * @param userMappings - User's existing learned mappings
 * @returns Validation result with reason
 *
 * @example
 * ```typescript
 * // This would be REJECTED — "vee" is protected
 * validatePotentialMapping("vee", "b", new Map())
 * // → { isValid: false, reason: "protected_global_mapping" }
 *
 * // This would be ACCEPTED — "ohs" is novel
 * validatePotentialMapping("ohs", "o", new Map())
 * // → { isValid: true, reason: "valid_novel_mapping" }
 * ```
 */
export function validatePotentialMapping(
  heard: string,
  intended: string,
  userMappings: Map<string, string> = new Map()
): MappingValidationResult {
  const normalizedHeard = heard.toLowerCase().trim()
  const normalizedIntended = intended.toLowerCase().trim()

  // Rule 1: Check if this is a protected global mapping
  if (isProtectedMapping(normalizedHeard)) {
    return {
      isValid: false,
      reason: "protected_global_mapping",
    }
  }

  // Rule 2: Check if user already has a different mapping for this "heard"
  if (userMappings.has(normalizedHeard)) {
    const existingIntended = userMappings.get(normalizedHeard)!
    if (existingIntended !== normalizedIntended) {
      return {
        isValid: false,
        reason: "conflicts_with_existing_user_mapping",
      }
    }
  }

  // All checks passed — this is a safe, novel mapping
  return {
    isValid: true,
    reason: "valid_novel_mapping",
  }
}

// =============================================================================
// LEARNING ANALYSIS
// =============================================================================

/**
 * Analyze a recognition event to determine if we can learn from it.
 *
 * This is the core inference algorithm. Given a failed attempt,
 * we try to deduce what the unknown sound should map to.
 *
 * @param event - The recognition event (typically a failed attempt)
 * @param globalMappings - The global SPOKEN_LETTER_NAMES dictionary
 * @param userMappings - User's existing learned mappings
 * @returns Analysis result with potential mapping if learnable
 *
 * @example
 * ```typescript
 * const result = analyzeForLearning(
 *   {
 *     wordToSpell: "to",
 *     googleTranscript: "tee ohs",
 *     extractedLetters: "tos",
 *     wasCorrect: false,
 *   },
 *   SPOKEN_LETTER_NAMES,
 *   new Map() // no user mappings yet
 * )
 *
 * // Result:
 * // {
 * //   canLearn: true,
 * //   potentialMapping: { heard: "ohs", intended: "o" },
 * //   reason: "single_unknown_deduced"
 * // }
 * ```
 */
export function analyzeForLearning(
  event: Pick<
    RecognitionEvent,
    "wordToSpell" | "googleTranscript" | "extractedLetters" | "wasCorrect"
  >,
  globalMappings: Record<string, string> = SPOKEN_LETTER_NAMES,
  userMappings: Map<string, string> = new Map()
): LearningAnalysisResult {
  // If the answer was correct, nothing to learn
  if (event.wasCorrect) {
    return {
      canLearn: false,
      potentialMapping: null,
      reason: "already_correct",
    }
  }

  const correctWord = event.wordToSpell.toLowerCase().trim()
  const transcript = event.googleTranscript.toLowerCase().trim()

  // Split transcript into words
  const transcriptWords = transcript
    .split(/\s+/)
    .filter((w) => w.length > 0)

  if (transcriptWords.length === 0) {
    return {
      canLearn: false,
      potentialMapping: null,
      reason: "word_mismatch",
    }
  }

  // Try to map each word, tracking unknowns
  const mappedLetters: string[] = []
  const unknowns: Array<{ word: string; position: number }> = []

  for (let i = 0; i < transcriptWords.length; i++) {
    const word = transcriptWords[i]

    // Check user mappings first (higher priority)
    if (userMappings.has(word)) {
      mappedLetters.push(userMappings.get(word)!)
      continue
    }

    // Check global mappings
    if (globalMappings[word]) {
      mappedLetters.push(globalMappings[word])
      continue
    }

    // Check if it's a single letter already
    if (word.length === 1 && /^[a-z]$/.test(word)) {
      mappedLetters.push(word)
      continue
    }

    // Unknown word - record position
    unknowns.push({ word, position: i })
    mappedLetters.push("?") // Placeholder
  }

  // If all words are known, nothing new to learn
  if (unknowns.length === 0) {
    return {
      canLearn: false,
      potentialMapping: null,
      reason: "all_known",
    }
  }

  // If multiple unknowns, we can't deduce which is which
  if (unknowns.length > 1) {
    return {
      canLearn: false,
      potentialMapping: null,
      reason: "multiple_unknowns",
    }
  }

  // Exactly one unknown - try to deduce it
  const unknown = unknowns[0]
  const knownPart = mappedLetters.filter((l) => l !== "?").join("")

  // Check if the known part is a prefix or suffix of the correct word
  // and the unknown fills in the gap

  // Case 1: Unknown is at the end
  if (unknown.position === transcriptWords.length - 1) {
    if (correctWord.startsWith(knownPart)) {
      const remaining = correctWord.slice(knownPart.length)
      if (remaining.length > 0 && remaining.length <= 2) {
        // SAFETY CHECK: Validate this mapping before returning
        const validation = validatePotentialMapping(unknown.word, remaining, userMappings)
        if (!validation.isValid) {
          return {
            canLearn: false,
            potentialMapping: null,
            reason: "word_mismatch",
          }
        }

        return {
          canLearn: true,
          potentialMapping: {
            heard: unknown.word,
            intended: remaining,
          },
          reason: "single_unknown_deduced",
        }
      }
    }
  }

  // Case 2: Unknown is at the beginning
  if (unknown.position === 0) {
    if (correctWord.endsWith(knownPart)) {
      const remaining = correctWord.slice(0, correctWord.length - knownPart.length)
      if (remaining.length > 0 && remaining.length <= 2) {
        // SAFETY CHECK: Validate this mapping before returning
        const validation = validatePotentialMapping(unknown.word, remaining, userMappings)
        if (!validation.isValid) {
          return {
            canLearn: false,
            potentialMapping: null,
            reason: "word_mismatch",
          }
        }

        return {
          canLearn: true,
          potentialMapping: {
            heard: unknown.word,
            intended: remaining,
          },
          reason: "single_unknown_deduced",
        }
      }
    }
  }

  // Case 3: Unknown is in the middle
  if (unknown.position > 0 && unknown.position < transcriptWords.length - 1) {
    const prefix = mappedLetters.slice(0, unknown.position).join("")
    const suffix = mappedLetters.slice(unknown.position + 1).join("")

    if (correctWord.startsWith(prefix) && correctWord.endsWith(suffix)) {
      const middle = correctWord.slice(prefix.length, correctWord.length - suffix.length)
      if (middle.length > 0 && middle.length <= 2) {
        // SAFETY CHECK: Validate this mapping before returning
        const validation = validatePotentialMapping(unknown.word, middle, userMappings)
        if (!validation.isValid) {
          return {
            canLearn: false,
            potentialMapping: null,
            reason: validation.reason === "protected_global_mapping"
              ? "word_mismatch" // Use existing reason type
              : "word_mismatch",
          }
        }

        return {
          canLearn: true,
          potentialMapping: {
            heard: unknown.word,
            intended: middle,
          },
          reason: "single_unknown_deduced",
        }
      }
    }
  }

  // Couldn't align the unknown with the correct word
  return {
    canLearn: false,
    potentialMapping: null,
    reason: "word_mismatch",
  }
}

// =============================================================================
// PATTERN AGGREGATION
// =============================================================================

/**
 * Pattern candidate for learning.
 * Aggregates multiple occurrences of the same (heard, intended) pair.
 */
export interface PatternCandidate {
  /** What Google heard */
  heard: string
  /** What it should map to */
  intended: string
  /** How many times we've seen this pattern */
  occurrenceCount: number
  /** Event IDs that contributed to this pattern */
  eventIds: string[]
}

/**
 * Aggregate recognition events to find learnable patterns.
 *
 * Groups failed attempts by (heard, intended) and returns patterns
 * that meet the minimum occurrence threshold AND pass safety validation.
 *
 * ## Safety
 *
 * Patterns are validated before being returned to ensure they don't
 * override protected global mappings. See `validatePotentialMapping()`.
 *
 * @param events - List of recognition events to analyze
 * @param globalMappings - The global SPOKEN_LETTER_NAMES dictionary
 * @param userMappings - User's existing learned mappings
 * @param config - Learning configuration
 * @returns List of pattern candidates ready to become mappings
 */
export function findLearnablePatterns(
  events: Array<RecognitionEvent & { id?: string }>,
  globalMappings: Record<string, string> = SPOKEN_LETTER_NAMES,
  userMappings: Map<string, string> = new Map(),
  config: LearningEngineConfig = {
    minOccurrencesToLearn: 2,
    initialConfidence: 0.75,
    confidenceBoostPerOccurrence: 0.1,
    maxConfidence: 0.99,
  }
): PatternCandidate[] {
  // Group by (heard, intended)
  const patternMap = new Map<string, PatternCandidate>()

  for (const event of events) {
    const analysis = analyzeForLearning(event, globalMappings, userMappings)

    if (analysis.canLearn && analysis.potentialMapping) {
      const key = `${analysis.potentialMapping.heard}:${analysis.potentialMapping.intended}`

      if (patternMap.has(key)) {
        const existing = patternMap.get(key)!
        existing.occurrenceCount++
        if (event.id) {
          existing.eventIds.push(event.id)
        }
      } else {
        patternMap.set(key, {
          heard: analysis.potentialMapping.heard,
          intended: analysis.potentialMapping.intended,
          occurrenceCount: 1,
          eventIds: event.id ? [event.id] : [],
        })
      }
    }
  }

  // Filter by minimum occurrences AND safety validation
  return Array.from(patternMap.values()).filter((p) => {
    // Check minimum occurrence threshold
    if (p.occurrenceCount < config.minOccurrencesToLearn) {
      return false
    }

    // Final safety check — ensure this pattern is still valid
    // (This is a belt-and-suspenders check since analyzeForLearning also validates)
    const validation = validatePotentialMapping(p.heard, p.intended, userMappings)
    if (!validation.isValid) {
      // Log for debugging in development
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[PhoneticLearning] Rejected pattern "${p.heard}" → "${p.intended}": ${validation.reason}`
        )
      }
      return false
    }

    return true
  })
}

// =============================================================================
// MAPPING CREATION
// =============================================================================

/**
 * Create a phonetic mapping from a pattern candidate.
 *
 * Calculates confidence based on occurrence count.
 *
 * @param pattern - The pattern candidate
 * @param userId - User ID for the mapping
 * @param config - Learning configuration
 * @returns Phonetic mapping ready for database insertion
 */
export function createMappingFromPattern(
  pattern: PatternCandidate,
  userId: string,
  config: LearningEngineConfig = {
    minOccurrencesToLearn: 2,
    initialConfidence: 0.75,
    confidenceBoostPerOccurrence: 0.1,
    maxConfidence: 0.99,
  }
): Omit<PhoneticMapping, "timesApplied"> {
  // Calculate confidence: starts at initial, increases with occurrences
  const extraOccurrences = pattern.occurrenceCount - config.minOccurrencesToLearn
  const confidenceBoost = extraOccurrences * config.confidenceBoostPerOccurrence
  const confidence = Math.min(
    config.initialConfidence + confidenceBoost,
    config.maxConfidence
  )

  return {
    userId,
    heard: pattern.heard,
    intended: pattern.intended,
    source: "auto_learned",
    confidence,
    occurrenceCount: pattern.occurrenceCount,
  }
}

// =============================================================================
// MAPPING APPLICATION
// =============================================================================

/**
 * Apply user mappings to a transcript to extract letters.
 *
 * This is called during answer validation. It merges user-specific
 * mappings with global mappings, with user mappings taking priority.
 *
 * @param transcript - Raw Google Speech transcript
 * @param globalMappings - Global SPOKEN_LETTER_NAMES
 * @param userMappings - User's learned mappings
 * @returns Object with extracted letters and which mappings were applied
 */
export function applyMappingsToTranscript(
  transcript: string,
  globalMappings: Record<string, string> = SPOKEN_LETTER_NAMES,
  userMappings: Map<string, string> = new Map()
): {
  letters: string
  appliedUserMappings: Array<{ heard: string; intended: string }>
  appliedGlobalMappings: Array<{ heard: string; intended: string }>
  unmappedWords: string[]
} {
  const words = transcript.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const letters: string[] = []
  const appliedUserMappings: Array<{ heard: string; intended: string }> = []
  const appliedGlobalMappings: Array<{ heard: string; intended: string }> = []
  const unmappedWords: string[] = []

  for (const word of words) {
    // User mappings take priority
    if (userMappings.has(word)) {
      const intended = userMappings.get(word)!
      letters.push(intended)
      appliedUserMappings.push({ heard: word, intended })
      continue
    }

    // Global mappings
    if (globalMappings[word]) {
      const intended = globalMappings[word]
      letters.push(intended)
      appliedGlobalMappings.push({ heard: word, intended })
      continue
    }

    // Single letter
    if (word.length === 1 && /^[a-z]$/.test(word)) {
      letters.push(word)
      continue
    }

    // Unmapped
    unmappedWords.push(word)
  }

  return {
    letters: letters.join(""),
    appliedUserMappings,
    appliedGlobalMappings,
    unmappedWords,
  }
}
