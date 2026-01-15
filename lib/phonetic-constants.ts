/**
 * Phonetic Constants for Speech Recognition
 *
 * This module contains all phonetic mappings and letter-related constants
 * used across the speech recognition system:
 * - NATO phonetic alphabet
 * - Spoken letter names (including common mishearings)
 * - Azure phrase list for boosting recognition
 *
 * ## Why centralize these?
 * 1. **Consistency**: Same mappings used across validation and recognition
 * 2. **Maintainability**: Single place to add new variants/corrections
 * 3. **Testing**: Easier to test and validate phonetic mappings
 *
 * @see lib/answer-validation.ts - Uses these for transcript parsing
 * @see lib/providers/azure-speech-provider.ts - Uses these for phrase boosting
 */

// =============================================================================
// NATO PHONETIC ALPHABET
// =============================================================================

/**
 * NATO phonetic alphabet mapping.
 * Used to detect when players spell using phonetic alphabet.
 * e.g., "alpha bravo charlie" → "abc"
 */
export const NATO_PHONETIC: Record<string, string> = {
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

// =============================================================================
// SPOKEN LETTER NAMES
// =============================================================================

/**
 * Common spoken letter names that speech recognition might produce.
 * Includes aggressive variations for Web Speech API and Azure mishearings.
 * e.g., "bee" for B, "see" for C, "double-u" for W
 *
 * NOTE: This mapping is intentionally aggressive to handle common
 * speech recognition errors. Some mappings may seem unusual but
 * are based on real-world testing with various speech APIs.
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
  // when letters are spoken quickly. Based on real testing.

  // Two-letter combinations
  "are you": "ru", // "R U" heard as "are you"
  "are we": "rv", // "R V" heard as "are we"
  "you are": "ur", // "U R" heard as "you are"
  "you and": "un", // "U N" heard as "you and"
  "you an": "un", // "U N" heard as "you an"
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
  "are you an": "run", // "R U N" heard as "are you an"
  "see a t": "cat", // "C A T" heard as "see a t"
  "see a tea": "cat", // "C A T" heard as "see a tea"
  "see ay tea": "cat", // "C A T" phonetic
  "see ay t": "cat", // "C A T" variant
  "a a t": "aat", // "A A T" heard as "a a t"
  "you you an": "uun", // Mishearing variant

  // Four+ letter combinations
  "are you and i": "runi", // "R U N I"
  "see a tea es": "cats", // "C A T S"
}

// =============================================================================
// AZURE PHRASE LIST
// =============================================================================

/**
 * Letter names and patterns to boost via Azure's phrase list feature.
 * These exact strings will have increased recognition priority.
 *
 * Includes:
 * - Individual letter names (A-Z)
 * - Common letter sequences
 * - Phonetic variants (how letters sound when spoken)
 */
export const AZURE_PHRASE_LIST = [
  // Individual letter names (high priority for spelling)
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  // Space-separated letter sequences (common patterns)
  "A B", "B C", "C D", "D E", "E F", "F G", "G H", "H I", "I J",
  "R U N", "S U N", "C A T", "D O G", "R E D", "B L U E",
  "S P E L L", "W O R D", "T E S T",
  // Phonetic variants (how letters sound)
  "ay", "bee", "cee", "dee", "ee", "eff", "gee", "aitch",
  "eye", "jay", "kay", "ell", "em", "en", "oh", "pee",
  "cue", "are", "ess", "tee", "you", "vee",
  "double you", "double-u", "ex", "why", "zee", "zed",
]

// =============================================================================
// SIMPLE LETTER LIST
// =============================================================================

/**
 * Simple A-Z letter list for basic keyword matching.
 * Used as a minimal set when full phonetic mapping isn't needed.
 */
export const LETTERS_AZ = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
]
