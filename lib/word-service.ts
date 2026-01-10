/**
 * Word Service — Data layer for spelling bee words.
 *
 * This module provides the interface and implementation for fetching words.
 * Currently uses mock data; will be replaced with database queries in Phase 4.
 *
 * ## Architecture
 * - Defines the `Word` interface used throughout the app
 * - Provides `getWord()` to fetch words by difficulty tier
 * - Provides `getRandomWord()` for variety within a tier
 * - Mock data covers all 7 difficulty tiers per PRD Section 6.4
 *
 * ## Future Integration
 * The interface is designed to be database-agnostic. When connecting to
 * the real word database (Merriam-Webster sourced), only the implementation
 * changes — not the interface.
 *
 * @see PRD Section 6 — Word System
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Word difficulty tier (1-7).
 * Maps to player rank tiers per PRD Section 6.5.
 *
 * | Tier | Characteristics |
 * |------|-----------------|
 * | 1 | 3-4 letters, common, phonetic |
 * | 2 | 5-6 letters, common, mostly phonetic |
 * | 3 | 6-7 letters, some irregular spellings |
 * | 4 | 8-9 letters, silent letters, doubles |
 * | 5 | 10-11 letters, commonly misspelled |
 * | 6 | 12+ letters, complex patterns |
 * | 7 | Championship-level, obscure, foreign origins |
 */
export type WordTier = 1 | 2 | 3 | 4 | 5 | 6 | 7

/**
 * Word data structure.
 * Matches the database schema from PRD Section 6.3.
 */
export interface Word {
  /** Unique identifier */
  id: string
  /** The word to spell */
  word: string
  /** Difficulty tier (1-7) */
  tier: WordTier
  /** Dictionary definition */
  definition: string
  /** Example sentence using the word */
  sentence: string
  /** URL to audio pronunciation (optional for mock data) */
  audioUrl?: string
  /** Part of speech (noun, verb, adjective, etc.) */
  partOfSpeech?: string
}

/**
 * Result of a word fetch operation.
 * Uses Result pattern for explicit error handling.
 */
export type WordResult =
  | { success: true; word: Word }
  | { success: false; error: string }

// =============================================================================
// MOCK DATA
// =============================================================================

/**
 * Mock words for development and testing.
 * Organized by tier for easy lookup.
 *
 * Note: Audio URLs are placeholders. In production, these will point to
 * cached Merriam-Webster audio files.
 */
const MOCK_WORDS: Word[] = [
  // Tier 1 — Simple, 3-4 letters, phonetic
  {
    id: "t1-001",
    word: "cat",
    tier: 1,
    definition: "A small domesticated carnivorous mammal with soft fur.",
    sentence: "The cat sat on the windowsill watching the birds.",
    partOfSpeech: "noun",
  },
  {
    id: "t1-002",
    word: "dog",
    tier: 1,
    definition: "A domesticated carnivorous mammal kept as a pet or for work.",
    sentence: "The dog wagged its tail when its owner came home.",
    partOfSpeech: "noun",
  },
  {
    id: "t1-003",
    word: "sun",
    tier: 1,
    definition: "The star around which the earth orbits.",
    sentence: "The sun rises in the east every morning.",
    partOfSpeech: "noun",
  },
  {
    id: "t1-004",
    word: "run",
    tier: 1,
    definition: "To move at a speed faster than a walk.",
    sentence: "I like to run in the park every morning.",
    partOfSpeech: "verb",
  },

  // Tier 2 — 5-6 letters, common, mostly phonetic
  {
    id: "t2-001",
    word: "house",
    tier: 2,
    definition: "A building for human habitation.",
    sentence: "They bought a new house near the school.",
    partOfSpeech: "noun",
  },
  {
    id: "t2-002",
    word: "plant",
    tier: 2,
    definition: "A living organism that grows in the ground.",
    sentence: "She watered the plant every day.",
    partOfSpeech: "noun",
  },
  {
    id: "t2-003",
    word: "smile",
    tier: 2,
    definition: "A pleased, kind, or amused facial expression.",
    sentence: "His smile lit up the entire room.",
    partOfSpeech: "noun",
  },
  {
    id: "t2-004",
    word: "table",
    tier: 2,
    definition: "A piece of furniture with a flat top and legs.",
    sentence: "We gathered around the table for dinner.",
    partOfSpeech: "noun",
  },

  // Tier 3 — 6-7 letters, some irregular spellings
  {
    id: "t3-001",
    word: "garden",
    tier: 3,
    definition: "A piece of ground used for growing flowers or vegetables.",
    sentence: "She spent the afternoon working in the garden.",
    partOfSpeech: "noun",
  },
  {
    id: "t3-002",
    word: "market",
    tier: 3,
    definition: "A regular gathering of people for buying and selling goods.",
    sentence: "We visited the farmers market on Saturday.",
    partOfSpeech: "noun",
  },
  {
    id: "t3-003",
    word: "simple",
    tier: 3,
    definition: "Easily understood or done; not complicated.",
    sentence: "The instructions were simple to follow.",
    partOfSpeech: "adjective",
  },
  {
    id: "t3-004",
    word: "bridge",
    tier: 3,
    definition: "A structure carrying a road over a river or obstacle.",
    sentence: "The old stone bridge crossed the river.",
    partOfSpeech: "noun",
  },

  // Tier 4 — 8-9 letters, silent letters, doubles
  {
    id: "t4-001",
    word: "beautiful",
    tier: 4,
    definition: "Pleasing the senses or mind aesthetically.",
    sentence: "The sunset was absolutely beautiful.",
    partOfSpeech: "adjective",
  },
  {
    id: "t4-002",
    word: "dangerous",
    tier: 4,
    definition: "Able or likely to cause harm or injury.",
    sentence: "Swimming in the rough sea can be dangerous.",
    partOfSpeech: "adjective",
  },
  {
    id: "t4-003",
    word: "knowledge",
    tier: 4,
    definition: "Facts, information, and skills acquired through experience.",
    sentence: "Her knowledge of history is impressive.",
    partOfSpeech: "noun",
  },
  {
    id: "t4-004",
    word: "excellent",
    tier: 4,
    definition: "Extremely good; outstanding.",
    sentence: "The chef prepared an excellent meal.",
    partOfSpeech: "adjective",
  },

  // Tier 5 — 10-11 letters, commonly misspelled
  {
    id: "t5-001",
    word: "necessary",
    tier: 5,
    definition: "Required to be done; essential.",
    sentence: "It is necessary to wear a seatbelt while driving.",
    partOfSpeech: "adjective",
  },
  {
    id: "t5-002",
    word: "occurrence",
    tier: 5,
    definition: "An incident or event.",
    sentence: "The strange occurrence puzzled everyone.",
    partOfSpeech: "noun",
  },
  {
    id: "t5-003",
    word: "accommodate",
    tier: 5,
    definition: "To provide lodging or sufficient space for.",
    sentence: "The hotel can accommodate up to 200 guests.",
    partOfSpeech: "verb",
  },
  {
    id: "t5-004",
    word: "embarrass",
    tier: 5,
    definition: "To cause someone to feel awkward or ashamed.",
    sentence: "I didn't mean to embarrass you in front of everyone.",
    partOfSpeech: "verb",
  },

  // Tier 6 — 12+ letters, complex patterns
  {
    id: "t6-001",
    word: "conscientious",
    tier: 6,
    definition: "Wishing to do what is right; thorough and careful.",
    sentence: "She is a conscientious worker who never misses deadlines.",
    partOfSpeech: "adjective",
  },
  {
    id: "t6-002",
    word: "surveillance",
    tier: 6,
    definition: "Close observation, especially of a suspected person.",
    sentence: "The building was under constant surveillance.",
    partOfSpeech: "noun",
  },
  {
    id: "t6-003",
    word: "entrepreneur",
    tier: 6,
    definition: "A person who organizes and operates a business.",
    sentence: "The young entrepreneur started her company at age 22.",
    partOfSpeech: "noun",
  },
  {
    id: "t6-004",
    word: "questionnaire",
    tier: 6,
    definition: "A set of printed questions for gathering information.",
    sentence: "Please complete this questionnaire before your appointment.",
    partOfSpeech: "noun",
  },

  // Tier 7 — Championship-level, obscure, foreign origins
  {
    id: "t7-001",
    word: "onomatopoeia",
    tier: 7,
    definition: "The formation of a word from a sound associated with it.",
    sentence: "Words like 'buzz' and 'hiss' are examples of onomatopoeia.",
    partOfSpeech: "noun",
  },
  {
    id: "t7-002",
    word: "serendipity",
    tier: 7,
    definition: "The occurrence of events by chance in a happy way.",
    sentence: "Finding that book was pure serendipity.",
    partOfSpeech: "noun",
  },
  {
    id: "t7-003",
    word: "pneumonia",
    tier: 7,
    definition: "A lung infection causing inflammation of the air sacs.",
    sentence: "He was hospitalized with a severe case of pneumonia.",
    partOfSpeech: "noun",
  },
  {
    id: "t7-004",
    word: "mischievous",
    tier: 7,
    definition: "Causing or showing a fondness for causing trouble playfully.",
    sentence: "The mischievous puppy chewed through another shoe.",
    partOfSpeech: "adjective",
  },
]

// =============================================================================
// SERVICE FUNCTIONS
// =============================================================================

/**
 * Get all words for a specific tier.
 *
 * @param tier - Difficulty tier (1-7)
 * @returns Array of words in that tier
 */
export function getWordsByTier(tier: WordTier): Word[] {
  return MOCK_WORDS.filter((word) => word.tier === tier)
}

/**
 * Get a random word from a specific tier.
 *
 * @param tier - Difficulty tier (1-7)
 * @param excludeIds - Word IDs to exclude (prevents repeats)
 * @returns A word result with success/error state
 *
 * @example
 * ```tsx
 * const result = getRandomWord(3, ["t3-001"])
 * if (result.success) {
 *   console.log(result.word.word) // e.g., "market"
 * }
 * ```
 */
export function getRandomWord(
  tier: WordTier,
  excludeIds: string[] = []
): WordResult {
  const tierWords = getWordsByTier(tier)
  const availableWords = tierWords.filter((w) => !excludeIds.includes(w.id))

  if (availableWords.length === 0) {
    // If all words in tier are exhausted, allow repeats
    if (tierWords.length === 0) {
      return { success: false, error: `No words available for tier ${tier}` }
    }
    // Reset and pick from all tier words
    const randomIndex = Math.floor(Math.random() * tierWords.length)
    return { success: true, word: tierWords[randomIndex] }
  }

  const randomIndex = Math.floor(Math.random() * availableWords.length)
  return { success: true, word: availableWords[randomIndex] }
}

/**
 * Get a specific word by ID.
 *
 * @param id - Word ID
 * @returns The word if found, undefined otherwise
 */
export function getWordById(id: string): Word | undefined {
  return MOCK_WORDS.find((word) => word.id === id)
}

/**
 * Get the timer duration for a word based on tier and input method.
 * Per PRD Section 4.3.
 *
 * @param tier - Word difficulty tier
 * @param inputMethod - "voice" or "keyboard"
 * @returns Timer duration in seconds
 */
export function getTimerDuration(
  tier: WordTier,
  inputMethod: "voice" | "keyboard"
): number {
  const baseTimes: Record<WordTier, number> = {
    1: 10,
    2: 12,
    3: 15,
    4: 18,
    5: 22,
    6: 28,
    7: 35,
  }

  const voiceBonus = inputMethod === "voice" ? 3 : 0
  return baseTimes[tier] + voiceBonus
}

/**
 * Get the starting tier for a player rank.
 * Per PRD Section 6.5.
 *
 * @param rank - Player rank name
 * @returns Starting word tier for that rank
 */
export function getStartingTierForRank(
  rank:
    | "new-bee"
    | "bumble-bee"
    | "busy-bee"
    | "honey-bee"
    | "worker-bee"
    | "royal-bee"
    | "bee-keeper"
): WordTier {
  const rankTiers: Record<string, WordTier> = {
    "new-bee": 1,
    "bumble-bee": 1,
    "busy-bee": 2,
    "honey-bee": 3,
    "worker-bee": 4,
    "royal-bee": 5,
    "bee-keeper": 6,
  }
  return rankTiers[rank] ?? 1
}

// =============================================================================
// AUDIO UTILITIES (Placeholder for Phase 4)
// =============================================================================

/**
 * Play the pronunciation audio for a word.
 * Currently a no-op — will integrate with audio files in Phase 4.
 *
 * @param word - The word to pronounce
 */
export async function playWordAudio(word: Word): Promise<void> {
  // TODO: Phase 4 — Integrate with cached Merriam-Webster audio files
  // For now, we'll use the browser's Speech Synthesis API as a fallback
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(word.word)
    utterance.rate = 0.8 // Slightly slower for clarity
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }
}

/**
 * Play "The word is [blank]" introduction.
 * Uses Speech Synthesis as a placeholder.
 *
 * @param word - The word to introduce
 */
export async function playWordIntro(word: Word): Promise<void> {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(`The word is ${word.word}`)
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }
}

/**
 * Play the word used in a sentence.
 *
 * @param word - The word with sentence
 */
export async function playWordSentence(word: Word): Promise<void> {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(word.sentence)
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }
}

/**
 * Play the word's definition.
 *
 * @param word - The word with definition
 */
export async function playWordDefinition(word: Word): Promise<void> {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(word.definition)
    utterance.rate = 0.9
    window.speechSynthesis.speak(utterance)
  }
}
