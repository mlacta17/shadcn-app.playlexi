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
 * @see PRD Section 12.1 — Voice Recognition
 */

// =============================================================================
// TYPES
// =============================================================================

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
// VALIDATION
// =============================================================================

/**
 * Validate a player's answer against the correct word.
 *
 * This is the core validation function used during gameplay.
 * Returns a detailed result for flexibility in handling outcomes.
 *
 * @param playerAnswer - The player's input (voice transcript or typed text)
 * @param correctWord - The correct spelling
 * @returns Validation result with correctness and normalized values
 *
 * @example
 * ```tsx
 * const result = validateAnswer("beautiful", "beautiful")
 * if (result.isCorrect) {
 *   showCorrectFeedback()
 * } else {
 *   showWrongFeedback()
 * }
 * ```
 */
export function validateAnswer(
  playerAnswer: string,
  correctWord: string
): ValidationResult {
  const normalizedAnswer = normalizeAnswer(playerAnswer)
  const normalizedCorrect = normalizeAnswer(correctWord)

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
 * @returns true if correct, false otherwise
 */
export function isAnswerCorrect(
  playerAnswer: string,
  correctWord: string
): boolean {
  return validateAnswer(playerAnswer, correctWord).isCorrect
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
