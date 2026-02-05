/**
 * Merriam-Webster API Client
 *
 * Fetches word definitions, example sentences, and audio URLs from the MW API.
 * Used by the seed script to populate the words table.
 *
 * ## API Documentation
 * - Learner's Dictionary: https://dictionaryapi.com/products/api-learners-dictionary
 * - Collegiate Dictionary: https://dictionaryapi.com/products/api-collegiate-dictionary
 *
 * ## Audio URL Format
 * Audio files are hosted at: https://media.merriam-webster.com/audio/prons/en/us/mp3/{subdirectory}/{filename}.mp3
 * Subdirectory rules:
 * - If filename begins with "bix", use "bix"
 * - If filename begins with "gg", use "gg"
 * - If filename begins with a number or punctuation, use "number"
 * - Otherwise, use the first letter of the filename
 *
 * @see ADR-011 (Merriam-Webster API Integration)
 */

// Environment variables (loaded via dotenv in the seed script)
const LEARNERS_KEY = process.env.MERRIAM_WEBSTER_LEARNERS_KEY
const COLLEGIATE_KEY = process.env.MERRIAM_WEBSTER_COLLEGIATE_KEY

const LEARNERS_BASE_URL = "https://dictionaryapi.com/api/v3/references/learners/json"
const COLLEGIATE_BASE_URL = "https://dictionaryapi.com/api/v3/references/collegiate/json"
const AUDIO_BASE_URL = "https://media.merriam-webster.com/audio/prons/en/us/mp3"

export interface WordData {
  word: string
  definition: string
  exampleSentence: string
  partOfSpeech: string
  audioUrl: string | null
  audioFilename: string | null
  syllables: number | null
  etymology: string | null
}

export interface MWApiError {
  word: string
  error: string
  suggestions?: string[]
}

/**
 * Determine the audio subdirectory based on MW's rules.
 */
function getAudioSubdirectory(filename: string): string {
  if (filename.startsWith("bix")) return "bix"
  if (filename.startsWith("gg")) return "gg"
  if (/^[0-9]/.test(filename) || /^[^a-zA-Z]/.test(filename)) return "number"
  return filename.charAt(0).toLowerCase()
}

/**
 * Construct the full audio URL from the audio filename.
 */
function buildAudioUrl(audioFilename: string): string {
  const subdirectory = getAudioSubdirectory(audioFilename)
  return `${AUDIO_BASE_URL}/${subdirectory}/${audioFilename}.mp3`
}

/**
 * Extract word data from Learner's Dictionary API response.
 * Learner's has better example sentences and clearer definitions.
 */
function parseLearnersResponse(word: string, data: unknown[]): WordData | null {
  // Check if response is an array of strings (suggestions, word not found)
  if (typeof data[0] === "string") {
    return null
  }

  const entry = data[0] as Record<string, unknown>
  if (!entry || typeof entry !== "object") return null

  // Extract definition
  let definition = ""
  const shortdef = entry.shortdef as string[] | undefined
  if (shortdef && shortdef.length > 0) {
    definition = shortdef[0]
  }

  // Extract part of speech
  const partOfSpeech = (entry.fl as string) || "unknown"

  // Extract example sentence from def array
  let exampleSentence = ""
  const def = entry.def as Array<{ sseq?: unknown }> | undefined
  if (def && def[0]?.sseq) {
    const sseq = def[0].sseq as unknown[][][]
    for (const sense of sseq) {
      for (const item of sense) {
        if (Array.isArray(item) && item[0] === "sense") {
          const senseData = item[1] as { dt?: unknown[] }
          if (senseData.dt) {
            for (const dtItem of senseData.dt) {
              if (Array.isArray(dtItem) && dtItem[0] === "vis") {
                const examples = dtItem[1] as Array<{ t?: string }>
                if (examples[0]?.t) {
                  // Clean up the example (remove {it} tags, etc.)
                  exampleSentence = examples[0].t
                    .replace(/\{it\}/g, "")
                    .replace(/\{\/it\}/g, "")
                    .replace(/\{[^}]+\}/g, "")
                    .trim()
                  break
                }
              }
            }
          }
        }
        if (exampleSentence) break
      }
      if (exampleSentence) break
    }
  }

  // If no example sentence found, create a generic one
  if (!exampleSentence) {
    exampleSentence = `Can you spell the word "${word}"?`
  }

  // Extract audio filename
  let audioFilename: string | null = null
  let audioUrl: string | null = null
  const hwi = entry.hwi as { prs?: Array<{ sound?: { audio?: string } }> } | undefined
  if (hwi?.prs?.[0]?.sound?.audio) {
    audioFilename = hwi.prs[0].sound.audio
    audioUrl = buildAudioUrl(audioFilename)
  }

  // Extract syllable count from headword info
  let syllables: number | null = null
  if (hwi) {
    const hw = (hwi as { hw?: string }).hw
    if (hw) {
      // Syllables are separated by dots or hyphens in the headword
      syllables = hw.split(/[*-]/).length
    }
  }

  return {
    word,
    definition,
    exampleSentence,
    partOfSpeech,
    audioUrl,
    audioFilename,
    syllables,
    etymology: null, // Learner's doesn't have etymology
  }
}

/**
 * Extract word data from Collegiate Dictionary API response.
 * Collegiate has etymology and more obscure words.
 */
function parseCollegiateResponse(word: string, data: unknown[]): WordData | null {
  // Check if response is an array of strings (suggestions, word not found)
  if (typeof data[0] === "string") {
    return null
  }

  const entry = data[0] as Record<string, unknown>
  if (!entry || typeof entry !== "object") return null

  // Extract definition
  let definition = ""
  const shortdef = entry.shortdef as string[] | undefined
  if (shortdef && shortdef.length > 0) {
    definition = shortdef[0]
  }

  // Extract part of speech
  const partOfSpeech = (entry.fl as string) || "unknown"

  // Extract etymology
  let etymology: string | null = null
  const et = entry.et as Array<[string, string]> | undefined
  if (et && et[0]) {
    // Clean up etymology text
    etymology = et
      .map((e) => (Array.isArray(e) ? e[1] : ""))
      .join(" ")
      .replace(/\{[^}]+\}/g, "")
      .trim()
    if (etymology.length > 500) {
      etymology = etymology.substring(0, 497) + "..."
    }
  }

  // Extract audio filename
  let audioFilename: string | null = null
  let audioUrl: string | null = null
  const hwi = entry.hwi as { prs?: Array<{ sound?: { audio?: string } }> } | undefined
  if (hwi?.prs?.[0]?.sound?.audio) {
    audioFilename = hwi.prs[0].sound.audio
    audioUrl = buildAudioUrl(audioFilename)
  }

  // Extract syllable count
  let syllables: number | null = null
  if (hwi) {
    const hw = (hwi as { hw?: string }).hw
    if (hw) {
      syllables = hw.split(/[*-]/).length
    }
  }

  // Extract example sentence from def array (same structure as Learner's)
  let exampleSentence = ""
  const def = entry.def as Array<{ sseq?: unknown }> | undefined
  if (def && def[0]?.sseq) {
    const sseq = def[0].sseq as unknown[][][]
    for (const sense of sseq) {
      for (const item of sense) {
        if (Array.isArray(item) && item[0] === "sense") {
          const senseData = item[1] as { dt?: unknown[] }
          if (senseData.dt) {
            for (const dtItem of senseData.dt) {
              if (Array.isArray(dtItem) && dtItem[0] === "vis") {
                const examples = dtItem[1] as Array<{ t?: string }>
                if (examples[0]?.t) {
                  // Clean up the example (remove {it} tags, etc.)
                  exampleSentence = examples[0].t
                    .replace(/\{it\}/g, "")
                    .replace(/\{\/it\}/g, "")
                    .replace(/\{[^}]+\}/g, "")
                    .trim()
                  break
                }
              }
            }
          }
        }
        if (exampleSentence) break
      }
      if (exampleSentence) break
    }
  }

  // Only use placeholder if no example found
  if (!exampleSentence) {
    exampleSentence = `Can you spell the word "${word}"?`
  }

  return {
    word,
    definition,
    exampleSentence,
    partOfSpeech,
    audioUrl,
    audioFilename,
    syllables,
    etymology,
  }
}

/**
 * Fetch word data from Merriam-Webster APIs.
 *
 * Strategy:
 * 1. Try Learner's Dictionary first (better examples, clearer definitions)
 * 2. Fall back to Collegiate for obscure words or etymology
 * 3. Merge data from both if beneficial
 */
export async function fetchWordData(word: string): Promise<WordData | MWApiError> {
  if (!LEARNERS_KEY || !COLLEGIATE_KEY) {
    throw new Error("Missing MW API keys. Set MERRIAM_WEBSTER_LEARNERS_KEY and MERRIAM_WEBSTER_COLLEGIATE_KEY")
  }

  // Try Learner's Dictionary first
  try {
    const learnersUrl = `${LEARNERS_BASE_URL}/${encodeURIComponent(word)}?key=${LEARNERS_KEY}`
    const learnersResponse = await fetch(learnersUrl)

    if (!learnersResponse.ok) {
      throw new Error(`Learner's API returned ${learnersResponse.status}`)
    }

    const learnersData = (await learnersResponse.json()) as unknown[]
    const learnersResult = parseLearnersResponse(word, learnersData)

    if (learnersResult && learnersResult.definition) {
      // Got good data from Learner's, optionally fetch etymology from Collegiate
      const collegiateUrl = `${COLLEGIATE_BASE_URL}/${encodeURIComponent(word)}?key=${COLLEGIATE_KEY}`
      const collegiateResponse = await fetch(collegiateUrl)

      if (collegiateResponse.ok) {
        const collegiateData = (await collegiateResponse.json()) as unknown[]
        const collegiateResult = parseCollegiateResponse(word, collegiateData)

        if (collegiateResult?.etymology) {
          learnersResult.etymology = collegiateResult.etymology
        }
        // If Learner's had no audio, try Collegiate
        if (!learnersResult.audioUrl && collegiateResult?.audioUrl) {
          learnersResult.audioUrl = collegiateResult.audioUrl
          learnersResult.audioFilename = collegiateResult.audioFilename
        }
      }

      return learnersResult
    }

    // Learner's didn't have the word, check if it returned suggestions
    if (Array.isArray(learnersData) && typeof learnersData[0] === "string") {
      // Try Collegiate for obscure words
      const collegiateUrl = `${COLLEGIATE_BASE_URL}/${encodeURIComponent(word)}?key=${COLLEGIATE_KEY}`
      const collegiateResponse = await fetch(collegiateUrl)

      if (collegiateResponse.ok) {
        const collegiateData = (await collegiateResponse.json()) as unknown[]
        const collegiateResult = parseCollegiateResponse(word, collegiateData)

        if (collegiateResult && collegiateResult.definition) {
          return collegiateResult
        }

        // Collegiate also returned suggestions
        if (Array.isArray(collegiateData) && typeof collegiateData[0] === "string") {
          return {
            word,
            error: "Word not found in either dictionary",
            suggestions: collegiateData.slice(0, 5) as string[],
          }
        }
      }

      return {
        word,
        error: "Word not found in Learner's Dictionary",
        suggestions: learnersData.slice(0, 5) as string[],
      }
    }

    return {
      word,
      error: "Could not parse response from Learner's Dictionary",
    }
  } catch (error) {
    return {
      word,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Download audio file as a Buffer.
 */
export async function downloadAudio(audioUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(audioUrl)
    if (!response.ok) {
      console.error(`Failed to download audio: ${response.status} ${audioUrl}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    console.error(`Error downloading audio from ${audioUrl}:`, error)
    return null
  }
}

/**
 * Check if the result is an error.
 */
export function isApiError(result: WordData | MWApiError): result is MWApiError {
  return "error" in result
}
