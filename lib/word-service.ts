/**
 * Word Service — Data layer for spelling bee words.
 *
 * This module provides the interface for fetching words in the game.
 * Currently uses mock data for development; the implementation can be
 * swapped to D1 queries without changing the interface.
 *
 * ## Architecture
 *
 * The service uses the **Strategy Pattern** for data sources:
 * - `MockWordDataSource` - In-memory mock data for development
 * - `D1WordDataSource` - (Future) Cloudflare D1 database queries
 *
 * Game code uses the interface functions (`getRandomWord`, `getWordById`, etc.)
 * which internally delegate to the configured data source.
 *
 * ## Swapping to D1
 *
 * When D1 is ready, change `USE_DATABASE = true` and ensure the database
 * connection is passed to API routes via Cloudflare context.
 *
 * @see PRD Section 6 — Word System
 * @see ADR-011 (Merriam-Webster API Integration)
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Feature flag: Use D1 database instead of mock data.
 *
 * NOTE: This flag is now DEPRECATED. The app always uses the D1 database
 * via the /api/words/random endpoint. Mock data is only used as a fallback
 * when the API call fails (handled in word-fetcher.ts).
 *
 * @deprecated Use word-fetcher.ts for async word fetching
 */
const USE_DATABASE = false // Kept for backward compatibility with sync getRandomWord()

// =============================================================================
// TYPES
// =============================================================================

/**
 * Word difficulty tier (1-7).
 * Maps to player skill levels per Glicko-2 rating ranges.
 *
 * | Tier | Rating Range | Characteristics |
 * |------|--------------|-----------------|
 * | 1 | 1000-1149 | 3-4 letters, common, phonetic |
 * | 2 | 1150-1299 | 5-6 letters, common, mostly phonetic |
 * | 3 | 1300-1449 | 6-7 letters, some irregular spellings |
 * | 4 | 1450-1599 | 8-9 letters, silent letters, doubles |
 * | 5 | 1600-1749 | 10-11 letters, commonly misspelled |
 * | 6 | 1750-1899 | 12+ letters, complex patterns |
 * | 7 | 1900+ | Championship-level, obscure, foreign origins |
 *
 * @see ADR-012 (Hidden Skill Rating System - Glicko-2)
 */
export type WordTier = 1 | 2 | 3 | 4 | 5 | 6 | 7

/**
 * Word data structure used throughout the game.
 * Matches the database schema in db/schema.ts.
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
  /** URL to audio pronunciation (R2 URL when using D1) */
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
// DATA SOURCE INTERFACE
// =============================================================================

/**
 * Interface for word data sources.
 * Implement this to add new data sources (e.g., D1, test fixtures).
 */
interface WordDataSource {
  getWordsByTier(tier: WordTier): Word[]
  getWordById(id: string): Word | undefined
}

// =============================================================================
// MOCK DATA SOURCE
// =============================================================================

/**
 * Mock words for development and testing.
 * Each tier has 4 sample words covering the characteristics defined above.
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

/**
 * Mock data source implementation.
 * Used during development before D1 is configured.
 */
const mockDataSource: WordDataSource = {
  getWordsByTier(tier: WordTier): Word[] {
    return MOCK_WORDS.filter((word) => word.tier === tier)
  },

  getWordById(id: string): Word | undefined {
    return MOCK_WORDS.find((word) => word.id === id)
  },
}

// =============================================================================
// ACTIVE DATA SOURCE
// =============================================================================

/**
 * Get the active data source based on configuration.
 * When USE_DATABASE is true, this would return a D1-backed implementation.
 */
function getDataSource(): WordDataSource {
  if (USE_DATABASE) {
    // TODO: Return D1 data source when database is configured
    // This would require passing the D1 binding from the request context
    console.warn("[WordService] D1 not yet configured, falling back to mock")
  }
  return mockDataSource
}

// =============================================================================
// PUBLIC API — WORD RETRIEVAL
// =============================================================================

/**
 * Get all words for a specific tier.
 *
 * @param tier - Difficulty tier (1-7)
 * @returns Array of words in that tier
 */
export function getWordsByTier(tier: WordTier): Word[] {
  return getDataSource().getWordsByTier(tier)
}

/**
 * Get a random word from a specific tier.
 *
 * @param tier - Difficulty tier (1-7)
 * @param excludeIds - Word IDs to exclude (prevents repeats in a session)
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
  return getDataSource().getWordById(id)
}

// =============================================================================
// PUBLIC API — GAME CONFIGURATION
// =============================================================================

/**
 * Get the timer duration for a word based on tier and input method.
 *
 * Voice input gets a small bonus to account for speech processing latency.
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
 * Convert Glicko-2 rating to word difficulty tier.
 * Used by the skill rating system to select appropriate words.
 *
 * @param rating - Glicko-2 rating (typically 1000-1900)
 * @returns Word tier (1-7)
 *
 * @see ADR-012 (Hidden Skill Rating System - Glicko-2)
 */
export function ratingToTier(rating: number): WordTier {
  if (rating < 1150) return 1
  if (rating < 1300) return 2
  if (rating < 1450) return 3
  if (rating < 1600) return 4
  if (rating < 1750) return 5
  if (rating < 1900) return 6
  return 7
}

/**
 * Get the starting tier for a player rank (legacy function).
 * Prefer using `ratingToTier()` with Glicko-2 ratings.
 *
 * @param rank - Player rank name
 * @returns Starting word tier for that rank
 * @deprecated Use ratingToTier() with Glicko-2 skill ratings instead
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
// PUBLIC API — AUDIO PLAYBACK
// =============================================================================

/**
 * Play the pronunciation audio for a word.
 *
 * When audioUrl is available (from R2), plays the cached Merriam-Webster audio.
 * Falls back to browser Speech Synthesis when no audio file exists.
 *
 * @param word - The word to pronounce
 */
export async function playWordAudio(word: Word): Promise<void> {
  if (typeof window === "undefined") return

  // Prefer cached audio file from R2
  if (word.audioUrl) {
    try {
      const audio = new Audio(word.audioUrl)
      await audio.play()
      return
    } catch (error) {
      console.warn("[WordService] Audio playback failed, using synthesis:", error)
    }
  }

  // Fallback to browser speech synthesis
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(word.word)
    utterance.rate = 0.8 // Slightly slower for clarity
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }
}

/**
 * Play "Your word is [word]" introduction.
 *
 * @param word - The word to introduce
 */
export async function playWordIntro(word: Word): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return

  const utterance = new SpeechSynthesisUtterance(`Your word is ${word.word}`)
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}

/**
 * Play the word used in a sentence.
 *
 * @param word - The word with sentence
 */
export async function playWordSentence(word: Word): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return

  const utterance = new SpeechSynthesisUtterance(word.sentence)
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}

/**
 * Play the word's definition.
 *
 * @param word - The word with definition
 */
export async function playWordDefinition(word: Word): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return

  const utterance = new SpeechSynthesisUtterance(word.definition)
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}
