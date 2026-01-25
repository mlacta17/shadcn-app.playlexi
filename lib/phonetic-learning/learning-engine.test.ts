/**
 * Phonetic Learning Engine Tests
 *
 * These tests verify the core learning algorithms that:
 * 1. Analyze failed recognition attempts
 * 2. Deduce unknown phonetic mappings
 * 3. Protect against learning incorrect mappings
 * 4. Aggregate patterns across multiple attempts
 *
 * If these break, users' speech recognition won't improve over time.
 */

import { describe, it, expect } from "vitest"
import {
  isProtectedMapping,
  validatePotentialMapping,
  analyzeForLearning,
  findLearnablePatterns,
  createMappingFromPattern,
  applyMappingsToTranscript,
  type PatternCandidate,
} from "./learning-engine"
import { SPOKEN_LETTER_NAMES } from "../answer-validation"

// =============================================================================
// isProtectedMapping() - Prevents overriding global mappings
// =============================================================================

describe("isProtectedMapping", () => {
  it("returns true for standard letter names", () => {
    expect(isProtectedMapping("ay")).toBe(true)
    expect(isProtectedMapping("bee")).toBe(true)
    expect(isProtectedMapping("see")).toBe(true)
    expect(isProtectedMapping("vee")).toBe(true)
  })

  it("returns true for common mishearings in global mappings", () => {
    // These are commonly misheard variations that are in SPOKEN_LETTER_NAMES
    expect(isProtectedMapping("oh")).toBe(true)  // o
    expect(isProtectedMapping("cue")).toBe(true) // q
    expect(isProtectedMapping("are")).toBe(true) // r
  })

  it("returns false for NATO phonetic (not in SPOKEN_LETTER_NAMES)", () => {
    // NATO phonetic is handled separately in extractLettersFromVoice
    // but not in SPOKEN_LETTER_NAMES, so it's NOT protected
    expect(isProtectedMapping("alpha")).toBe(false)
    expect(isProtectedMapping("bravo")).toBe(false)
    expect(isProtectedMapping("delta")).toBe(false)
  })

  it("returns false for novel sounds not in global dictionary", () => {
    expect(isProtectedMapping("ohs")).toBe(false)
    expect(isProtectedMapping("tio")).toBe(false)
    expect(isProtectedMapping("xyz123")).toBe(false)
  })

  it("handles case insensitivity", () => {
    expect(isProtectedMapping("BEE")).toBe(true)
    expect(isProtectedMapping("Bee")).toBe(true)
    expect(isProtectedMapping("OHS")).toBe(false)
  })

  it("handles whitespace", () => {
    expect(isProtectedMapping("  bee  ")).toBe(true)
    expect(isProtectedMapping("  ohs  ")).toBe(false)
  })
})

// =============================================================================
// validatePotentialMapping() - Safety check before creating mappings
// =============================================================================

describe("validatePotentialMapping", () => {
  describe("protected mappings", () => {
    it("rejects mappings that would override global mappings", () => {
      const result = validatePotentialMapping("vee", "b", new Map())
      expect(result.isValid).toBe(false)
      expect(result.reason).toBe("protected_global_mapping")
    })

    it("rejects even if intended matches the global mapping", () => {
      // "bee" → "b" is already in globals, we shouldn't create user mapping
      const result = validatePotentialMapping("bee", "b", new Map())
      expect(result.isValid).toBe(false)
      expect(result.reason).toBe("protected_global_mapping")
    })
  })

  describe("novel mappings", () => {
    it("accepts truly novel sounds", () => {
      const result = validatePotentialMapping("ohs", "o", new Map())
      expect(result.isValid).toBe(true)
      expect(result.reason).toBe("valid_novel_mapping")
    })

    it("accepts novel sounds even with existing user mappings for other sounds", () => {
      const userMappings = new Map([["tio", "t"]])
      const result = validatePotentialMapping("ohs", "o", userMappings)
      expect(result.isValid).toBe(true)
    })
  })

  describe("user mapping conflicts", () => {
    it("rejects when user already has different mapping for same heard", () => {
      const userMappings = new Map([["ohs", "a"]]) // user has ohs → a
      const result = validatePotentialMapping("ohs", "o", userMappings) // trying to set ohs → o
      expect(result.isValid).toBe(false)
      expect(result.reason).toBe("conflicts_with_existing_user_mapping")
    })

    it("accepts when user already has same mapping", () => {
      const userMappings = new Map([["ohs", "o"]])
      const result = validatePotentialMapping("ohs", "o", userMappings)
      expect(result.isValid).toBe(true)
    })
  })
})

// =============================================================================
// analyzeForLearning() - Core inference algorithm
// =============================================================================

describe("analyzeForLearning", () => {
  describe("correct answers", () => {
    it("returns canLearn=false for correct answers", () => {
      const result = analyzeForLearning({
        wordToSpell: "cat",
        googleTranscript: "see ay tee",
        extractedLetters: "cat",
        wasCorrect: true,
      })
      expect(result.canLearn).toBe(false)
      expect(result.reason).toBe("already_correct")
    })
  })

  describe("all known mappings", () => {
    it("returns canLearn=false when all words are already known", () => {
      const result = analyzeForLearning({
        wordToSpell: "cat",
        googleTranscript: "see ay tee",
        extractedLetters: "cat",
        wasCorrect: false, // marked incorrect for test purposes
      })
      expect(result.canLearn).toBe(false)
      expect(result.reason).toBe("all_known")
    })
  })

  describe("single unknown deduction", () => {
    it("deduces unknown at end of word", () => {
      // "to" - "tee" is known (t), "ohs" is unknown
      const result = analyzeForLearning(
        {
          wordToSpell: "to",
          googleTranscript: "tee ohs",
          extractedLetters: "tos",
          wasCorrect: false,
        },
        SPOKEN_LETTER_NAMES
      )

      expect(result.canLearn).toBe(true)
      expect(result.potentialMapping).toEqual({
        heard: "ohs",
        intended: "o",
      })
      expect(result.reason).toBe("single_unknown_deduced")
    })

    it("deduces unknown at beginning of word", () => {
      // "on" - "ohs" is unknown, "en" is known (n)
      const result = analyzeForLearning(
        {
          wordToSpell: "on",
          googleTranscript: "ohs en",
          extractedLetters: "osn",
          wasCorrect: false,
        },
        SPOKEN_LETTER_NAMES
      )

      expect(result.canLearn).toBe(true)
      expect(result.potentialMapping).toEqual({
        heard: "ohs",
        intended: "o",
      })
    })

    it("deduces unknown in middle of word", () => {
      // "cat" - "see" is known, "xyz" is unknown, "tee" is known
      // This creates a 3-letter word where middle is unknown
      const mockGlobals = {
        ...SPOKEN_LETTER_NAMES,
        see: "c",
        tee: "t",
      }

      const result = analyzeForLearning(
        {
          wordToSpell: "cat",
          googleTranscript: "see xyz tee",
          extractedLetters: "c?t",
          wasCorrect: false,
        },
        mockGlobals
      )

      expect(result.canLearn).toBe(true)
      expect(result.potentialMapping).toEqual({
        heard: "xyz",
        intended: "a",
      })
    })
  })

  describe("multiple unknowns", () => {
    it("returns canLearn=false when multiple unknowns exist", () => {
      const result = analyzeForLearning(
        {
          wordToSpell: "cat",
          googleTranscript: "unknown1 unknown2 unknown3",
          extractedLetters: "???",
          wasCorrect: false,
        },
        {} // empty mappings so all words are unknown
      )

      expect(result.canLearn).toBe(false)
      expect(result.reason).toBe("multiple_unknowns")
    })
  })

  describe("safety - protected mappings", () => {
    it("rejects deduction if it would create protected mapping", () => {
      // Even if deduction logic would work, if "vee" is protected, reject
      const result = analyzeForLearning(
        {
          wordToSpell: "bat", // b-a-t
          googleTranscript: "vee ay tee", // vee should map to b based on context
          extractedLetters: "vat", // but vee already maps to v globally
          wasCorrect: false,
        },
        SPOKEN_LETTER_NAMES
      )

      // This would try to learn vee → b, but vee is protected
      expect(result.canLearn).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("handles empty transcript", () => {
      const result = analyzeForLearning({
        wordToSpell: "cat",
        googleTranscript: "",
        extractedLetters: "",
        wasCorrect: false,
      })
      expect(result.canLearn).toBe(false)
    })

    it("handles single letter words", () => {
      const result = analyzeForLearning(
        {
          wordToSpell: "a",
          googleTranscript: "ohs",
          extractedLetters: "os",
          wasCorrect: false,
        },
        SPOKEN_LETTER_NAMES
      )

      expect(result.canLearn).toBe(true)
      expect(result.potentialMapping?.intended).toBe("a")
    })
  })
})

// =============================================================================
// findLearnablePatterns() - Aggregate patterns across events
// =============================================================================

describe("findLearnablePatterns", () => {
  it("returns empty array when no events", () => {
    const patterns = findLearnablePatterns([])
    expect(patterns).toEqual([])
  })

  it("returns empty array when all events are correct", () => {
    const events = [
      {
        id: "1",
        userId: "user1",
        wordToSpell: "cat",
        googleTranscript: "see ay tee",
        extractedLetters: "cat",
        wasCorrect: true,
      },
    ]
    const patterns = findLearnablePatterns(events)
    expect(patterns).toEqual([])
  })

  it("finds pattern when same mapping appears multiple times", () => {
    const events = [
      {
        id: "1",
        userId: "user1",
        wordToSpell: "to",
        googleTranscript: "tee ohs",
        extractedLetters: "tos",
        wasCorrect: false,
      },
      {
        id: "2",
        userId: "user1",
        wordToSpell: "go",
        googleTranscript: "gee ohs",
        extractedLetters: "gos",
        wasCorrect: false,
      },
    ]

    const patterns = findLearnablePatterns(events, SPOKEN_LETTER_NAMES)

    expect(patterns.length).toBe(1)
    expect(patterns[0].heard).toBe("ohs")
    expect(patterns[0].intended).toBe("o")
    expect(patterns[0].occurrenceCount).toBe(2)
  })

  it("respects minimum occurrence threshold", () => {
    const events = [
      {
        id: "1",
        userId: "user1",
        wordToSpell: "to",
        googleTranscript: "tee ohs",
        extractedLetters: "tos",
        wasCorrect: false,
      },
    ]

    // Default requires 2 occurrences
    const patterns = findLearnablePatterns(events, SPOKEN_LETTER_NAMES)
    expect(patterns.length).toBe(0)

    // With config allowing 1 occurrence
    const patternsWithLowerThreshold = findLearnablePatterns(
      events,
      SPOKEN_LETTER_NAMES,
      new Map(),
      { minOccurrencesToLearn: 1, initialConfidence: 0.75, confidenceBoostPerOccurrence: 0.1, maxConfidence: 0.99 }
    )
    expect(patternsWithLowerThreshold.length).toBe(1)
  })

  it("groups same heard+intended pairs together", () => {
    const events = [
      {
        id: "1",
        userId: "user1",
        wordToSpell: "to",
        googleTranscript: "tee ohs",
        extractedLetters: "tos",
        wasCorrect: false,
      },
      {
        id: "2",
        userId: "user1",
        wordToSpell: "go",
        googleTranscript: "gee ohs",
        extractedLetters: "gos",
        wasCorrect: false,
      },
      {
        id: "3",
        userId: "user1",
        wordToSpell: "no",
        googleTranscript: "en ohs",
        extractedLetters: "nos",
        wasCorrect: false,
      },
    ]

    const patterns = findLearnablePatterns(events, SPOKEN_LETTER_NAMES)

    expect(patterns.length).toBe(1)
    expect(patterns[0].occurrenceCount).toBe(3)
    expect(patterns[0].eventIds).toEqual(["1", "2", "3"])
  })

  it("rejects patterns that would override protected mappings", () => {
    // Try to create events that would learn vee → b (wrong!)
    // This shouldn't return any patterns since vee is protected
    const events = [
      {
        id: "1",
        userId: "user1",
        wordToSpell: "bat",
        googleTranscript: "vee ay tee",
        extractedLetters: "vat",
        wasCorrect: false,
      },
      {
        id: "2",
        userId: "user1",
        wordToSpell: "but",
        googleTranscript: "vee you tee",
        extractedLetters: "vut",
        wasCorrect: false,
      },
    ]

    const patterns = findLearnablePatterns(events, SPOKEN_LETTER_NAMES)
    expect(patterns.length).toBe(0) // Should not learn vee → b
  })
})

// =============================================================================
// createMappingFromPattern() - Create database record
// =============================================================================

describe("createMappingFromPattern", () => {
  const basePattern: PatternCandidate = {
    heard: "ohs",
    intended: "o",
    occurrenceCount: 3,
    eventIds: ["1", "2", "3"],
  }

  it("creates mapping with correct fields", () => {
    const mapping = createMappingFromPattern(basePattern, "user123")

    expect(mapping.userId).toBe("user123")
    expect(mapping.heard).toBe("ohs")
    expect(mapping.intended).toBe("o")
    expect(mapping.source).toBe("auto_learned")
    expect(mapping.occurrenceCount).toBe(3)
  })

  it("calculates confidence based on occurrences", () => {
    const lowOccurrence = { ...basePattern, occurrenceCount: 2 }
    const highOccurrence = { ...basePattern, occurrenceCount: 10 }

    const lowMapping = createMappingFromPattern(lowOccurrence, "user")
    const highMapping = createMappingFromPattern(highOccurrence, "user")

    expect(highMapping.confidence).toBeGreaterThan(lowMapping.confidence)
  })

  it("caps confidence at maxConfidence", () => {
    const veryHighOccurrence = { ...basePattern, occurrenceCount: 100 }
    const mapping = createMappingFromPattern(veryHighOccurrence, "user", {
      minOccurrencesToLearn: 2,
      initialConfidence: 0.75,
      confidenceBoostPerOccurrence: 0.1,
      maxConfidence: 0.99,
    })

    expect(mapping.confidence).toBe(0.99)
  })
})

// =============================================================================
// applyMappingsToTranscript() - Use learned mappings
// =============================================================================

describe("applyMappingsToTranscript", () => {
  it("applies user mappings with priority over global", () => {
    const userMappings = new Map([["ohs", "o"]])

    const result = applyMappingsToTranscript(
      "tee ohs",
      SPOKEN_LETTER_NAMES,
      userMappings
    )

    expect(result.letters).toBe("to")
    expect(result.appliedUserMappings).toContainEqual({
      heard: "ohs",
      intended: "o",
    })
  })

  it("falls back to global mappings", () => {
    const result = applyMappingsToTranscript(
      "tee oh",
      SPOKEN_LETTER_NAMES,
      new Map()
    )

    expect(result.letters).toBe("to")
    expect(result.appliedGlobalMappings.length).toBe(2)
  })

  it("tracks unmapped words", () => {
    const result = applyMappingsToTranscript(
      "tee xyz123 oh",
      SPOKEN_LETTER_NAMES,
      new Map()
    )

    expect(result.unmappedWords).toContain("xyz123")
  })

  it("handles single letter words directly", () => {
    const result = applyMappingsToTranscript(
      "a b c",
      {},
      new Map()
    )

    expect(result.letters).toBe("abc")
  })

  it("handles empty transcript", () => {
    const result = applyMappingsToTranscript("", SPOKEN_LETTER_NAMES, new Map())
    expect(result.letters).toBe("")
  })

  it("normalizes case", () => {
    const userMappings = new Map([["ohs", "o"]])

    const result = applyMappingsToTranscript(
      "TEE OHS",
      SPOKEN_LETTER_NAMES,
      userMappings
    )

    expect(result.letters).toBe("to")
  })
})
