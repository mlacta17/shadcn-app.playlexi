/**
 * Answer Validation — Utilities for checking spelling answers.
 *
 * This module handles the core game logic of comparing player input
 * against the correct spelling.
 *
 * ## Architecture
 * - Pure functions with no side effects
 * - Handles both voice and keyboard input normalization
 * - Provides detailed feedback for wrong answers (future enhancement)
 *
 * ## Voice Input Considerations
 * Per PRD Section 12.1, voice input is "strict mode" — what the speech provider hears
 * is final. However, we still normalize for:
 * - Case differences (voice may produce "CAT" or "Cat")
 * - Extra spaces (recognition may add spaces between letters)
 * - Punctuation (recognition may add periods)
 *
 * ## Anti-Cheat: Spelled Letters vs Whole Word
 * For voice input, players must spell the word letter-by-letter (e.g., "D O G").
 * Simply saying the whole word (e.g., "dog") is NOT valid and should be rejected.
 * The validation detects spelled letters by checking for:
 * 1. Separators between characters (spaces, dashes, commas)
 * 2. NATO phonetic alphabet words ("alpha", "bravo", etc.)
 * 3. Spoken letter names ("dee", "oh", "gee")
 *
 * @see PRD Section 12.1 — Voice Recognition
 */

// =============================================================================
// TYPES
// =============================================================================

/** Input method for validation - affects how the answer is processed */
export type InputMode = "voice" | "keyboard"

/**
 * Result of an answer validation check.
 */
export interface ValidationResult {
  /** Whether the answer is correct */
  isCorrect: boolean
  /** The normalized player answer */
  normalizedAnswer: string
  /** The normalized correct answer */
  normalizedCorrect: string
  /** Similarity score (0-1) for partial credit analysis */
  similarity: number
  /** For voice mode: whether the input was properly spelled out */
  wasSpelledOut?: boolean
  /**
   * Rejection reason if answer was rejected (not just wrong).
   * - "not_spelled_out": Transcript doesn't look like spelled letters
   * - "too_fast": Duration too short for spelling
   * - "too_few_interim": Not enough interim results (word said, not spelled)
   * - "anti_cheat_failed": Composite anti-cheat score too low
   * - "empty": No answer provided
   */
  rejectionReason?: "not_spelled_out" | "too_fast" | "too_few_interim" | "anti_cheat_failed" | "empty"
}

// =============================================================================
// ANTI-CHEAT NOTES
// =============================================================================
// Anti-cheat is now handled at the provider level (Google Cloud Speech-to-Text).
// The provider uses multi-signal analysis:
// 1. Word count vs letter count
// 2. Single-letter word ratio
// 3. Gaps between words
// 4. Duration per letter (min 0.15s/letter)
//
// See lib/providers/google-speech-provider.ts for implementation.
// =============================================================================

/**
 * Detailed analysis of an incorrect answer.
 * Useful for future features like hints or "close enough" feedback.
 */
export interface AnswerAnalysis {
  /** Letters that were correct */
  correctLetters: number
  /** Total letters in the correct word */
  totalLetters: number
  /** Percentage correct (0-100) */
  percentageCorrect: number
  /** Whether the answer was close (>80% correct) */
  wasClose: boolean
}

// =============================================================================
// NORMALIZATION
// =============================================================================

/**
 * Normalize an answer string for comparison.
 *
 * Handles common variations from both voice and keyboard input:
 * - Converts to lowercase
 * - Removes all spaces
 * - Removes punctuation
 * - Trims whitespace
 *
 * @param input - Raw input string
 * @returns Normalized string for comparison
 *
 * @example
 * ```ts
 * normalizeAnswer("C A T")  // "cat"
 * normalizeAnswer("Cat.")   // "cat"
 * normalizeAnswer(" DOG ")  // "dog"
 * ```
 */
export function normalizeAnswer(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "") // Remove all whitespace
    .replace(/[^a-z]/g, "") // Remove non-letter characters
    .trim()
}

// =============================================================================
// VOICE INPUT DETECTION — Anti-Cheat for Spelled Letters
// =============================================================================

/**
 * NATO phonetic alphabet mapping.
 * Used to detect when players spell using phonetic alphabet.
 * e.g., "alpha bravo charlie" → "abc"
 */
const NATO_PHONETIC: Record<string, string> = {
  alpha: "a",
  bravo: "b",
  charlie: "c",
  delta: "d",
  echo: "e",
  foxtrot: "f",
  golf: "g",
  hotel: "h",
  india: "i",
  juliet: "j",
  juliett: "j",
  kilo: "k",
  lima: "l",
  mike: "m",
  november: "n",
  oscar: "o",
  papa: "p",
  quebec: "q",
  romeo: "r",
  sierra: "s",
  tango: "t",
  uniform: "u",
  victor: "v",
  whiskey: "w",
  xray: "x",
  "x-ray": "x",
  yankee: "y",
  zulu: "z",
}

/**
 * Common spoken letter names that speech recognition might produce.
 * Includes aggressive variations for Web Speech API mishearings.
 * e.g., "bee" for B, "see" for C, "double-u" for W
 *
 * NOTE: This mapping is intentionally aggressive to handle common
 * speech recognition errors. Some mappings may seem unusual but
 * are based on real-world testing with Web Speech API.
 *
 * This is TIER 1 of the three-tier mapping system:
 * - TIER 1: Global defaults (this dictionary) - works for ~80% of users
 * - TIER 2: Auto-learned mappings (per user) - learned from gameplay
 * - TIER 3: Manual calibration (per user) - explicitly configured
 *
 * @see lib/phonetic-learning/learning-engine.ts
 * @see docs/ROADMAP.md Phase 4: Adaptive Phonetic Learning System
 */
export const SPOKEN_LETTER_NAMES: Record<string, string> = {
  // === A ===
  ay: "a",
  eh: "a",
  aye: "a",
  hey: "a",
  a: "a",

  // === B ===
  bee: "b",
  be: "b",
  bea: "b",
  b: "b",

  // === C ===
  see: "c",
  sea: "c",
  si: "c",
  cee: "c",
  c: "c",

  // === D ===
  dee: "d",
  de: "d",
  d: "d",

  // === E ===
  ee: "e",
  e: "e",

  // === F ===
  ef: "f",
  eff: "f",
  f: "f",

  // === G ===
  gee: "g",
  ge: "g",
  ji: "g",
  g: "g",

  // === H ===
  aitch: "h",
  ache: "h",
  h: "h",
  age: "h",
  each: "h",
  etch: "h",

  // === I ===
  eye: "i",
  i: "i",
  // Note: "aye" is mapped to "a" above - context-dependent

  // === J ===
  jay: "j",
  j: "j",
  je: "j",

  // === K ===
  kay: "k",
  k: "k",
  que: "k",
  kaye: "k",

  // === L ===
  el: "l",
  ell: "l",
  l: "l",
  elle: "l",

  // === M ===
  em: "m",
  m: "m",

  // === N ===
  en: "n",
  n: "n",
  and: "n", // Common mishearing: "n" → "and"

  // === O ===
  oh: "o",
  o: "o",
  owe: "o",

  // === P ===
  pee: "p",
  pe: "p",
  p: "p",

  // === Q ===
  cue: "q",
  queue: "q",
  q: "q",
  kew: "q",
  cu: "q",

  // === R ===
  ar: "r",
  are: "r",
  r: "r",
  our: "r", // Common mishearing

  // === S ===
  es: "s",
  ess: "s",
  s: "s",
  ass: "s", // Unfortunate but common mishearing

  // === T ===
  tee: "t",
  te: "t",
  t: "t",
  tea: "t",

  // === U ===
  you: "u",
  u: "u",
  yu: "u",
  ew: "u",

  // === V ===
  vee: "v",
  ve: "v",
  v: "v",
  we: "v", // Mishearing "vee" as "we"

  // === W ===
  "double-u": "w",
  "double u": "w",
  doubleu: "w",
  w: "w",
  "double you": "w",
  doubleyou: "w",

  // === X ===
  ex: "x",
  x: "x",
  ecks: "x",
  eggs: "x", // Mishearing

  // === Y ===
  why: "y",
  wye: "y",
  y: "y",
  wie: "y",

  // === Z ===
  zee: "z",
  zed: "z",
  z: "z",
  zhe: "z",
  the: "z", // Common mishearing of "zee"

  // === Common phrase fragments ===
  // These handle cases where speech API hears multi-word phrases
  // when letters are spoken quickly. Based on real speech recognition output testing.

  // Two-letter combinations
  "are you": "ru", // "R U" heard as "are you"
  "are we": "rv", // "R V" heard as "are we"
  "you are": "ur", // "U R" heard as "you are"
  "you and": "un", // "U N" heard as "you and"
  "you an": "un", // "U N" heard as "you an" (from your console!)
  "see you": "cu", // "C U" heard as "see you"
  "i see": "ic", // "I C" heard as "I see"
  "i am": "im", // "I M" heard as "I am"
  "you see": "uc", // "U C" heard as "you see"
  "oh you": "ou", // "O U" heard as "oh you"
  "and i": "ni", // "N I" heard as "and I"
  "be a": "ba", // "B A" heard as "be a"
  "see a": "ca", // "C A" heard as "see a"
  "a a": "aa", // "A A" heard as "a a"
  "see i": "ci", // "C I" heard as "see I"
  "i a": "ia", // "I A" heard as "I a"
  "a t": "at", // "A T" heard as "a t"
  "i t": "it", // "I T" heard as "I t"
  "s u": "su", // "S U" heard as "s u"
  "c a": "ca", // "C A" heard as "c a"
  "u n": "un", // "U N" heard as "u n"

  // Three-letter combinations
  "i am a": "ima", // "I M A" heard as "I am a"
  "are you in": "run", // "R U N" heard as "are you in"
  "are you and": "run", // Alternative mishearing
  "are you an": "run", // "R U N" heard as "are you an" (from your console!)
  "see a t": "cat", // "C A T" heard as "see a t"
  "see a tea": "cat", // "C A T" heard as "see a tea"
  "see ay tea": "cat", // "C A T" phonetic
  "see ay t": "cat", // "C A T" variant
  "a a t": "aat", // "A A T" heard as "a a t" (from your console - partial)
  "you you an": "uun", // Mishearing variant

  // Four+ letter combinations
  "are you and i": "runi", // "R U N I"
  "see a tea es": "cats", // "C A T S"
}

// =============================================================================
// PRE-COMPUTED OPTIMIZATIONS (computed once at module load)
// =============================================================================

/**
 * Pre-computed phrase keys sorted by length (longest first).
 * This avoids re-sorting on every call to extractLettersFromVoice.
 *
 * Performance: O(n log n) once at load, vs O(n log n) on every call before.
 */
const PHRASE_KEYS_SORTED = Object.keys(SPOKEN_LETTER_NAMES)
  .filter((k) => k.includes(" "))
  .sort((a, b) => b.length - a.length)

/**
 * Pre-compiled regex patterns for phrase replacement.
 * Using a Map for O(1) lookup instead of creating new RegExp each time.
 *
 * Performance: Regex compilation is expensive (~10-50μs per regex).
 * Pre-compiling saves this cost on every extractLettersFromVoice call.
 */
const PHRASE_REGEX_MAP = new Map<string, RegExp>(
  PHRASE_KEYS_SORTED.map((phrase) => [phrase, new RegExp(phrase, "g")])
)

/**
 * Check if voice input appears to be spelled out letter-by-letter.
 *
 * This is the core anti-cheat function. For voice mode, players must
 * spell words (e.g., "D O G" or "dee oh gee"), not just say the word.
 *
 * Detection strategies:
 * 1. Contains known multi-word phrase mappings (e.g., "are you in" for R-U-N)
 * 2. Contains separators between single characters (spaces, dashes)
 * 3. Contains NATO phonetic alphabet words
 * 4. Contains spoken letter names
 * 5. Is a sequence of single letters
 *
 * @param input - Raw voice transcript
 * @param correctWord - The word being spelled (for context)
 * @returns true if input appears to be spelled out
 *
 * @example
 * ```ts
 * isSpelledOut("D O G", "dog")           // true - spaced letters
 * isSpelledOut("dee oh gee", "dog")      // true - spoken letter names
 * isSpelledOut("delta oscar golf", "dog") // true - NATO phonetic
 * isSpelledOut("are you in", "run")      // true - phrase mapping
 * isSpelledOut("cat", "cat")             // true - provider assembled spelled letters
 * isSpelledOut("dog", "cat")             // false - wrong word entirely
 * isSpelledOut("beautiful", "cat")       // false - wrong word entirely
 * ```
 */
export function isSpelledOut(input: string, correctWord: string): boolean {
  const trimmed = input.trim().toLowerCase()
  const wordLower = correctWord.toLowerCase()

  // Edge case: single letter words (a, I) - allow direct match
  if (wordLower.length === 1) {
    return true
  }

  // Edge case: empty input
  if (trimmed.length === 0) {
    return false
  }

  // Split by common separators (spaces, commas, dashes, periods)
  const parts = trimmed.split(/[\s,\.\-]+/).filter((p) => p.length > 0)

  // ==========================================================================
  // PROVIDER TRUST: Accept word-level output that matches correct answer
  // ==========================================================================
  // Speech providers like Google Cloud Speech-to-Text are smart enough to recognize when
  // someone is spelling a word letter-by-letter and return the assembled word.
  // Example: User spells "C-A-T", Google may return "Cat" (not "C A T")
  //
  // If the transcript matches the correct word, TRUST IT as correctly spelled.
  // The provider wouldn't return "Cat" unless it heard letters being spelled.
  //
  // This is NOT cheating - the user DID spell it, the provider just assembled it.
  // True cheating (just saying the word quickly) would result in different audio
  // patterns that the provider can distinguish.
  if (parts.length === 1 && parts[0] === wordLower) {
    // Transcript exactly matches the correct word - trust the provider
    return true
  }

  // ==========================================================================
  // ANTI-CHEAT: Reject single words that don't match the correct answer
  // ==========================================================================
  // If someone says a DIFFERENT word (not the correct answer), reject it.
  // This catches cases where someone says a random word instead of spelling.

  if (parts.length === 1) {
    const singlePart = parts[0]

    // Single part that doesn't match correct word AND isn't a letter name
    // = probably said a wrong word instead of spelling
    const isKnownLetter = singlePart.length === 1 ||
                          NATO_PHONETIC[singlePart] ||
                          SPOKEN_LETTER_NAMES[singlePart]
    if (!isKnownLetter && singlePart.length > 1) {
      // It's a multi-character word that's not a letter name
      // This is likely someone saying a word, not spelling
      return false
    }
  }

  // ==========================================================================
  // Check for known multi-word phrase mappings
  // ==========================================================================
  // Use pre-computed PHRASE_KEYS_SORTED for efficiency
  for (const phrase of PHRASE_KEYS_SORTED) {
    if (trimmed === phrase || trimmed.includes(phrase)) {
      return true
    }
  }

  // ==========================================================================
  // Check if parts are valid letter representations
  // ==========================================================================
  if (parts.length > 1) {
    // Count how many parts are recognized letter forms
    let recognizedCount = 0
    for (const part of parts) {
      if (part.length === 1 && /^[a-z]$/.test(part)) {
        recognizedCount++
      } else if (NATO_PHONETIC[part]) {
        recognizedCount++
      } else if (SPOKEN_LETTER_NAMES[part]) {
        recognizedCount++
      }
    }

    // Require at least 50% of parts to be recognized letters
    // This catches "C A T" but rejects "cat is"
    if (recognizedCount >= parts.length * 0.5) {
      return true
    }

    // If ALL parts are letter forms, definitely spelled out
    if (recognizedCount === parts.length) {
      return true
    }
  }

  // ==========================================================================
  // Default: Strict mode - if we can't confirm it's spelled, reject it
  // ==========================================================================
  // This is safer for anti-cheat. Better to ask player to re-spell than
  // to accept a cheated answer.
  return false
}

/**
 * Extract letters from voice input that may use phonetic alphabet or spoken names.
 *
 * Converts:
 * - Single letters: "d" → "d"
 * - NATO phonetic: "delta" → "d"
 * - Spoken names: "dee" → "d"
 * - Multi-word phrases: "are you in" → "run"
 *
 * ## User Mappings Priority
 *
 * When `userMappings` is provided, user-specific mappings take PRIORITY over
 * global defaults. This enables personalized phonetic recognition:
 *
 * - TIER 1: User mappings (learned from gameplay)
 * - TIER 2: Global SPOKEN_LETTER_NAMES (works for ~80% of users)
 * - TIER 3: NATO phonetic alphabet
 *
 * @param input - Raw voice transcript
 * @param userMappings - Optional user-specific phonetic mappings (heard → letter)
 * @returns Extracted letters as a string
 *
 * @example
 * ```ts
 * extractLettersFromVoice("D O G")           // "dog"
 * extractLettersFromVoice("dee oh gee")      // "dog"
 * extractLettersFromVoice("delta oscar golf") // "dog"
 * extractLettersFromVoice("are you in")      // "run"
 *
 * // With user mappings:
 * const userMappings = new Map([["ah", "a"], ["buh", "b"]])
 * extractLettersFromVoice("ah buh", userMappings) // "ab"
 * ```
 */
export function extractLettersFromVoice(
  input: string,
  userMappings?: Map<string, string>
): string {
  let processed = input.toLowerCase().trim()

  // First, check for multi-word phrase mappings (longer phrases first)
  // Uses pre-computed PHRASE_KEYS_SORTED and PHRASE_REGEX_MAP for performance
  for (const phrase of PHRASE_KEYS_SORTED) {
    if (processed.includes(phrase)) {
      // Replace the phrase with a placeholder that won't be split
      const replacement = `__PHRASE_${SPOKEN_LETTER_NAMES[phrase]}__`
      const regex = PHRASE_REGEX_MAP.get(phrase)!
      processed = processed.replace(regex, replacement)
    }
  }

  // Now split by separators
  const parts = processed.split(/[\s,\-]+/).filter((p) => p.length > 0)

  return parts
    .map((part) => {
      // Check for phrase placeholder
      const phraseMatch = part.match(/^__PHRASE_(.+)__$/)
      if (phraseMatch) {
        return phraseMatch[1]
      }

      // Single letter
      if (part.length === 1 && /^[a-z]$/.test(part)) {
        return part
      }

      // TIER 1: User-specific mappings (highest priority)
      // These are learned from the user's actual speech patterns
      if (userMappings?.has(part)) {
        return userMappings.get(part)!
      }

      // TIER 2: Global spoken letter names
      if (SPOKEN_LETTER_NAMES[part]) {
        return SPOKEN_LETTER_NAMES[part]
      }

      // TIER 3: NATO phonetic alphabet
      if (NATO_PHONETIC[part]) {
        return NATO_PHONETIC[part]
      }

      // Unknown - return as-is (will likely cause mismatch)
      return part
    })
    .join("")
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Letter timing data passed from speech recognition hook (transcript-based).
 * NOTE: Less reliable due to provider buffering - use AudioTimingData instead.
 */
export interface LetterTimingData {
  /** Average gap between letter appearances (ms) */
  averageLetterGapMs: number
  /** Whether the timing pattern looks like spelling */
  looksLikeSpelling: boolean
  /** Number of letters tracked */
  letterCount: number
}

/**
 * Audio-level timing data from speech recognition (Google Cloud Speech-to-Text).
 *
 * Google recognizes each spelled letter as a separate "word":
 * - Spelling "C-A-T" → wordCount: 3, words: ["C", "A", "T"]
 * - Saying "cat" → wordCount: 1, words: ["cat"]
 *
 * This makes anti-cheat simple: if wordCount > 1, user spelled it.
 * If wordCount === 1 with multiple letters, user said the whole word.
 */
export interface AudioTimingData {
  /**
   * Number of separate words detected by speech provider.
   * - Spelling "C-A-T" → 3 (each letter is a "word")
   * - Saying "cat" → 1 (whole word as one)
   */
  wordCount: number
  /**
   * Average gap between words (seconds). Less important now,
   * but kept for logging/debugging purposes.
   */
  avgGapSec: number
  /**
   * Pre-computed verdict from the speech hook.
   * true = user spelled letter-by-letter
   * false = user said the whole word
   */
  looksLikeSpelling: boolean
}

/**
 * Options for voice mode validation.
 * Now includes both transcript-based and audio-based anti-cheat data.
 */
export interface VoiceValidationOptions {
  /**
   * Letter timing data from transcript arrival (less reliable).
   * Use audioTiming instead when available.
   */
  letterTiming?: LetterTimingData
  /**
   * Audio-level timing data from speech provider (more reliable).
   * Based on actual audio timestamps, not transcript arrival patterns.
   */
  audioTiming?: AudioTimingData
  /**
   * User-specific phonetic mappings learned from gameplay.
   * Takes priority over global SPOKEN_LETTER_NAMES.
   * Map format: heard → intended (e.g., "ah" → "a")
   */
  userMappings?: Map<string, string>
}

/**
 * Validate a player's answer against the correct word.
 *
 * This is the core validation function used during gameplay.
 * Returns a detailed result for flexibility in handling outcomes.
 *
 * For voice mode, extracts letters from the transcript (handling phonetic
 * alphabet, spoken letter names, etc.) and compares against the correct word.
 *
 * ## Anti-Cheat: Letter Timing Detection
 * We use letter accumulation timing to detect cheating:
 * - **Spelling "C-A-T"**: Letters appear gradually (200-400ms gaps)
 * - **Saying "cat"**: All letters appear at once (<100ms total)
 *
 * This approach:
 * 1. Doesn't punish fast spellers (they still have 150-200ms gaps)
 * 2. Catches cheaters who just say the word (letters dump all at once)
 * 3. Is invisible to users (detection happens silently at submission)
 *
 * @param playerAnswer - The player's input (voice transcript or typed text)
 * @param correctWord - The correct spelling
 * @param inputMode - Whether this is voice or keyboard input (default: keyboard)
 * @param voiceOptions - Options including letter timing data for anti-cheat
 * @returns Validation result with correctness and normalized values
 *
 * @example
 * ```tsx
 * // Keyboard mode - direct comparison
 * const result = validateAnswer("beautiful", "beautiful", "keyboard")
 *
 * // Voice mode with anti-cheat
 * const result = validateAnswer("beautiful", "beautiful", "voice", {
 *   letterTiming: { averageLetterGapMs: 250, looksLikeSpelling: true, letterCount: 9 }
 * })
 * ```
 */
export function validateAnswer(
  playerAnswer: string,
  correctWord: string,
  inputMode: InputMode = "keyboard",
  _voiceOptions?: VoiceValidationOptions // Kept for API compatibility, but anti-cheat is disabled
): ValidationResult {
  const normalizedCorrect = normalizeAnswer(correctWord)

  // For voice mode, extract letters and compare
  if (inputMode === "voice") {
    // Extract letters from voice input (handles phonetic alphabet, etc.)
    // Pass user mappings if available for personalized recognition
    const extractedLetters = extractLettersFromVoice(
      playerAnswer,
      _voiceOptions?.userMappings
    )
    const lettersMatch = extractedLetters === normalizedCorrect
    const similarity = calculateSimilarity(extractedLetters, normalizedCorrect)

    // DEBUG: Log the validation inputs and result
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Validation] playerAnswer="${playerAnswer}", correctWord="${correctWord}", ` +
        `extracted="${extractedLetters}", normalized="${normalizedCorrect}", ` +
        `lettersMatch=${lettersMatch}, audioTiming=${JSON.stringify(_voiceOptions?.audioTiming)}`
      )
    }

    // =========================================================================
    // Anti-Cheat: LENIENT MODE
    // =========================================================================
    // We use a VERY lenient approach to avoid false positives.
    // The speech hook (use-speech-recognition.ts) pre-computes whether
    // the audio pattern looks like spelling vs saying.
    //
    // We only reject if:
    // - Provider detected a single word with 3+ letters
    // - AND the word was spoken very quickly (< 0.15s per letter)
    //
    // This catches obvious cheating (quickly saying "cat") while
    // allowing legitimate fast spellers (who still take >1s to spell).

    let wasSpelledOut = true // Default: trust the user
    let rejectionReason: ValidationResult["rejectionReason"] = undefined

    // Only check if letters match (no point rejecting wrong answers)
    if (lettersMatch && _voiceOptions?.audioTiming) {
      wasSpelledOut = _voiceOptions.audioTiming.looksLikeSpelling

      if (!wasSpelledOut) {
        rejectionReason = "not_spelled_out"

        if (process.env.NODE_ENV === "development") {
          console.log(
            `[AntiCheat] ❌ REJECTED: Answer was spoken too quickly. ` +
              `Please spell the word letter-by-letter.`
          )
        }
      } else if (process.env.NODE_ENV === "development") {
        console.log(
          `[AntiCheat] ✅ PASSED: Audio pattern looks like spelling. ` +
            `Answer="${extractedLetters}" accepted.`
        )
      }
    } else if (process.env.NODE_ENV === "development" && lettersMatch) {
      console.log(
        `[AntiCheat] ✅ PASSED: No audio timing data, trusting transcript. ` +
          `Answer="${extractedLetters}" matches correct="${normalizedCorrect}".`
      )
    }

    // Answer is correct if letters match (anti-cheat always passes)
    const isCorrect = lettersMatch && wasSpelledOut

    return {
      isCorrect,
      normalizedAnswer: extractedLetters,
      normalizedCorrect,
      similarity,
      wasSpelledOut,
      rejectionReason,
    }
  }

  // Keyboard mode - simple comparison
  const normalizedAnswer = normalizeAnswer(playerAnswer)
  const isCorrect = normalizedAnswer === normalizedCorrect
  const similarity = calculateSimilarity(normalizedAnswer, normalizedCorrect)

  return {
    isCorrect,
    normalizedAnswer,
    normalizedCorrect,
    similarity,
  }
}

/**
 * Quick check if an answer is correct.
 * Use this when you only need a boolean result.
 *
 * @param playerAnswer - The player's input
 * @param correctWord - The correct spelling
 * @param inputMode - Whether this is voice or keyboard input (default: keyboard)
 * @param voiceOptions - Additional options for voice mode validation
 * @returns true if correct, false otherwise
 */
export function isAnswerCorrect(
  playerAnswer: string,
  correctWord: string,
  inputMode: InputMode = "keyboard",
  voiceOptions?: VoiceValidationOptions
): boolean {
  return validateAnswer(playerAnswer, correctWord, inputMode, voiceOptions).isCorrect
}

// =============================================================================
// ANALYSIS (Future Enhancement)
// =============================================================================

/**
 * Calculate similarity between two strings using Levenshtein distance.
 *
 * Returns a value between 0 (completely different) and 1 (identical).
 * Used for determining "close" answers and potential partial credit.
 *
 * @param a - First string (normalized)
 * @param b - Second string (normalized)
 * @returns Similarity score (0-1)
 */
export function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  const distance = levenshteinDistance(a, b)
  const maxLength = Math.max(a.length, b.length)

  return 1 - distance / maxLength
}

/**
 * Levenshtein distance between two strings.
 * Measures the minimum number of single-character edits needed
 * to change one string into the other.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Number of edits required
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Analyze an incorrect answer for feedback.
 *
 * Provides detailed breakdown of how close the player was.
 * Useful for future features like:
 * - "Almost! You got 90% of the letters right"
 * - Showing which letters were wrong
 *
 * @param playerAnswer - The player's input (normalized)
 * @param correctWord - The correct spelling (normalized)
 * @returns Detailed analysis of the answer
 */
export function analyzeAnswer(
  playerAnswer: string,
  correctWord: string
): AnswerAnalysis {
  const normalized = normalizeAnswer(playerAnswer)
  const correct = normalizeAnswer(correctWord)

  // Count matching letters in order
  let correctLetters = 0
  const minLength = Math.min(normalized.length, correct.length)

  for (let i = 0; i < minLength; i++) {
    if (normalized[i] === correct[i]) {
      correctLetters++
    }
  }

  const totalLetters = correct.length
  const percentageCorrect =
    totalLetters > 0 ? Math.round((correctLetters / totalLetters) * 100) : 0
  const wasClose = percentageCorrect >= 80

  return {
    correctLetters,
    totalLetters,
    percentageCorrect,
    wasClose,
  }
}

// =============================================================================
// REAL-TIME DISPLAY TRANSFORMATION
// =============================================================================

/**
 * Transform raw voice transcript to display-friendly letter format.
 *
 * This function is used for **real-time UI display** to show the user
 * what letters the system is interpreting from their speech.
 *
 * Converts phrases and phonetics to spaced letters:
 * - "are you in" → "R-U-N"
 * - "dee oh gee" → "D-O-G"
 * - "d o g" → "D-O-G"
 *
 * @param transcript - Raw voice transcript
 * @param userMappings - Optional user-specific phonetic mappings
 * @returns Formatted letter display (uppercase, hyphen-separated)
 *
 * @example
 * ```ts
 * formatTranscriptForDisplay("are you in")  // "R-U-N"
 * formatTranscriptForDisplay("dee oh gee")  // "D-O-G"
 * formatTranscriptForDisplay("b e a")       // "B-E-A"
 * formatTranscriptForDisplay("")            // ""
 * ```
 */
export function formatTranscriptForDisplay(
  transcript: string,
  userMappings?: Map<string, string>
): string {
  // Fast path: empty input
  if (!transcript || transcript.length === 0) {
    return ""
  }

  // Extract letters using optimized function with user mappings
  const letters = extractLettersFromVoice(transcript, userMappings)

  // Fast path: no letters extracted
  if (letters.length === 0) {
    // If we couldn't extract letters, show the raw transcript briefly
    // This provides immediate feedback that something was heard
    // The transcript will be replaced once proper letters are recognized
    const trimmed = transcript.trim()
    if (trimmed.length > 0 && trimmed.length <= 20) {
      // Show raw input in lowercase for partial feedback
      return `(${trimmed})`
    }
    return ""
  }

  // Format as uppercase letters separated by hyphens
  // Using Array.from for proper unicode handling and join for efficiency
  return Array.from(letters.toUpperCase()).join("-")
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Check if an input is empty or only whitespace.
 * Per PRD Section 13.3, empty submissions are treated as wrong answers.
 *
 * @param input - Raw input string
 * @returns true if input is effectively empty
 */
export function isEmptyAnswer(input: string): boolean {
  return normalizeAnswer(input).length === 0
}

/**
 * Check if the input contains only valid spelling characters.
 * Useful for keyboard input validation.
 *
 * @param input - Raw input string
 * @returns true if input contains only letters
 */
export function isValidSpellingInput(input: string): boolean {
  const normalized = input.replace(/\s+/g, "").toLowerCase()
  return /^[a-z]*$/.test(normalized)
}
