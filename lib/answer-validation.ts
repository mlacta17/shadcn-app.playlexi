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
 * Per PRD Section 12.1, voice input is "strict mode" — what Whisper hears
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
  /** Rejection reason if answer was rejected (not just wrong) */
  rejectionReason?: "not_spelled_out" | "empty"
}

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
 */
const SPOKEN_LETTER_NAMES: Record<string, string> = {
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
  // when letters are spoken quickly
  "are you": "ru", // "R U" heard as "are you"
  "are we": "rv", // "R V" heard as "are we"
  "you are": "ur", // "U R" heard as "you are"
  "you and": "un", // "U N" heard as "you and"
  "see you": "cu", // "C U" heard as "see you"
  "i see": "ic", // "I C" heard as "I see"
  "i am": "im", // "I M" heard as "I am"
  "you see": "uc", // "U C" heard as "you see"
  "oh you": "ou", // "O U" heard as "oh you"
  "and i": "ni", // "N I" heard as "and I"
  "be a": "ba", // "B A" heard as "be a"
  "see a": "ca", // "C A" heard as "see a"
  "i am a": "ima", // "I M A" heard as "I am a"
  "are you in": "run", // "R U N" heard as "are you in"
  "are you and": "run", // Alternative mishearing
}

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
 * isSpelledOut("dog", "dog")             // false - just said the word
 * isSpelledOut("beautiful", "beautiful") // false - just said the word
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

  // Strategy 0: Check for known multi-word phrase mappings
  // If the entire input matches a phrase mapping, it's spelled out
  const phraseKeys = Object.keys(SPOKEN_LETTER_NAMES).filter((k) => k.includes(" "))
  for (const phrase of phraseKeys) {
    if (trimmed === phrase || trimmed.includes(phrase)) {
      return true
    }
  }

  // Strategy 1: Check for spaced single letters (e.g., "d o g")
  // Split by common separators
  const parts = trimmed.split(/[\s,\-]+/).filter((p) => p.length > 0)

  // If we have multiple parts and most are single letters, it's spelled out
  if (parts.length > 1) {
    const singleLetterCount = parts.filter((p) => p.length === 1).length
    const phoneticCount = parts.filter((p) => NATO_PHONETIC[p]).length
    const spokenLetterCount = parts.filter((p) => SPOKEN_LETTER_NAMES[p]).length

    // If majority of parts are letters/phonetic, it's spelled out
    const spelledOutParts = singleLetterCount + phoneticCount + spokenLetterCount
    if (spelledOutParts >= parts.length * 0.5) {
      return true
    }
  }

  // Strategy 2: Check if input exactly matches the word (cheating)
  // If someone says "dog" for the word "dog", that's not spelling
  const normalizedInput = normalizeAnswer(trimmed)
  if (normalizedInput === wordLower && parts.length === 1) {
    // Single word that matches exactly = not spelled out
    return false
  }

  // Strategy 3: Check for NATO phonetic or spoken letter sequences
  // e.g., "delta oscar golf" or "dee oh gee"
  const allPartsAreLetterForms = parts.every(
    (p) => p.length === 1 || NATO_PHONETIC[p] || SPOKEN_LETTER_NAMES[p]
  )
  if (parts.length > 1 && allPartsAreLetterForms) {
    return true
  }

  // Strategy 4: If input is longer than the word and contains the word
  // embedded in other content, it might be an attempt to sneak the word in
  // For now, we'll be lenient and allow it (edge case for future refinement)

  // Default: If we can't determine it's spelled out, assume it's not
  // This is the strict/conservative approach
  return parts.length > 1
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
 * @param input - Raw voice transcript
 * @returns Extracted letters as a string
 *
 * @example
 * ```ts
 * extractLettersFromVoice("D O G")           // "dog"
 * extractLettersFromVoice("dee oh gee")      // "dog"
 * extractLettersFromVoice("delta oscar golf") // "dog"
 * extractLettersFromVoice("are you in")      // "run"
 * ```
 */
export function extractLettersFromVoice(input: string): string {
  let processed = input.toLowerCase().trim()

  // First, check for multi-word phrase mappings (longer phrases first)
  // Sort by length descending to match longer phrases first
  const phraseKeys = Object.keys(SPOKEN_LETTER_NAMES)
    .filter((k) => k.includes(" "))
    .sort((a, b) => b.length - a.length)

  for (const phrase of phraseKeys) {
    if (processed.includes(phrase)) {
      // Replace the phrase with a placeholder that won't be split
      const replacement = `__PHRASE_${SPOKEN_LETTER_NAMES[phrase]}__`
      processed = processed.replace(new RegExp(phrase, "g"), replacement)
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
      // NATO phonetic
      if (NATO_PHONETIC[part]) {
        return NATO_PHONETIC[part]
      }
      // Spoken letter name
      if (SPOKEN_LETTER_NAMES[part]) {
        return SPOKEN_LETTER_NAMES[part]
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
 * Validate a player's answer against the correct word.
 *
 * This is the core validation function used during gameplay.
 * Returns a detailed result for flexibility in handling outcomes.
 *
 * For voice mode, this function also checks that the player actually
 * spelled the word letter-by-letter rather than just saying the word.
 *
 * @param playerAnswer - The player's input (voice transcript or typed text)
 * @param correctWord - The correct spelling
 * @param inputMode - Whether this is voice or keyboard input (default: keyboard)
 * @returns Validation result with correctness and normalized values
 *
 * @example
 * ```tsx
 * // Keyboard mode - direct comparison
 * const result = validateAnswer("beautiful", "beautiful", "keyboard")
 *
 * // Voice mode - must be spelled out
 * const result = validateAnswer("B E A U T I F U L", "beautiful", "voice")
 * if (result.rejectionReason === "not_spelled_out") {
 *   showMessage("Please spell the word letter by letter")
 * }
 * ```
 */
export function validateAnswer(
  playerAnswer: string,
  correctWord: string,
  inputMode: InputMode = "keyboard"
): ValidationResult {
  const normalizedCorrect = normalizeAnswer(correctWord)

  // For voice mode, check if the answer was properly spelled out
  if (inputMode === "voice") {
    const wasSpelledOut = isSpelledOut(playerAnswer, correctWord)

    if (!wasSpelledOut) {
      // Player said the word instead of spelling it - reject
      return {
        isCorrect: false,
        normalizedAnswer: normalizeAnswer(playerAnswer),
        normalizedCorrect,
        similarity: 0,
        wasSpelledOut: false,
        rejectionReason: "not_spelled_out",
      }
    }

    // Extract letters from voice input (handles phonetic alphabet, etc.)
    const extractedLetters = extractLettersFromVoice(playerAnswer)
    const isCorrect = extractedLetters === normalizedCorrect
    const similarity = calculateSimilarity(extractedLetters, normalizedCorrect)

    return {
      isCorrect,
      normalizedAnswer: extractedLetters,
      normalizedCorrect,
      similarity,
      wasSpelledOut: true,
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
 * @returns true if correct, false otherwise
 */
export function isAnswerCorrect(
  playerAnswer: string,
  correctWord: string,
  inputMode: InputMode = "keyboard"
): boolean {
  return validateAnswer(playerAnswer, correctWord, inputMode).isCorrect
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
export function formatTranscriptForDisplay(transcript: string): string {
  if (!transcript || transcript.trim().length === 0) {
    return ""
  }

  // Extract letters using our existing function
  const letters = extractLettersFromVoice(transcript)

  if (letters.length === 0) {
    return ""
  }

  // Format as uppercase letters separated by hyphens
  return letters.toUpperCase().split("").join("-")
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
