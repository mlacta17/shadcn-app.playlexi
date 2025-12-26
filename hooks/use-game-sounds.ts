"use client"

import * as React from "react"

/**
 * Sound file paths - all sounds should be in public/sounds/
 *
 * Current files:
 * - CorrectAnswerFeedback_sound.mp3 - played on correct answer
 * - WrongAnswerFeedback_sound.mp3 - played on wrong answer
 *
 * Optional future sounds:
 * - tick.mp3     (~10KB) - timer warning tick
 * - heart-lost.mp3 (~15KB) - life lost
 */
const SOUND_PATHS = {
  correct: "/sounds/CorrectAnswerFeedback_sound.mp3",
  wrong: "/sounds/WrongAnswerFeedback_sound.mp3",
} as const

export type SoundName = keyof typeof SOUND_PATHS

export interface UseGameSoundsOptions {
  /** Master volume (0-1). Default: 1 */
  volume?: number
  /** Whether sounds are enabled. Default: true */
  enabled?: boolean
}

export interface UseGameSoundsReturn {
  /** Play the correct answer sound */
  playCorrect: () => void
  /** Play the wrong answer sound */
  playWrong: () => void
  /** Play any sound by name */
  play: (sound: SoundName) => void
  /** Whether sounds are ready to play */
  isReady: boolean
  /** Enable/disable sounds */
  setEnabled: (enabled: boolean) => void
  /** Set master volume (0-1) */
  setVolume: (volume: number) => void
}

/**
 * Hook for managing game sound effects.
 *
 * This hook handles audio preloading and playback for game feedback sounds.
 * Follows the same pattern as other game hooks: hook owns logic, components are presentational.
 *
 * ## Features
 * - Preloads sounds on mount for instant playback
 * - Respects user's sound preferences (enable/disable)
 * - Volume control
 * - Graceful fallback if audio fails to load
 * - Memoized play functions to prevent unnecessary re-renders
 *
 * ## Audio Format
 * Uses MP3 for universal browser support (including iOS Safari).
 * Recommended settings: 128kbps, 44.1kHz, mono.
 *
 * ## Usage
 * ```tsx
 * function GameScreen() {
 *   const { playCorrect, playWrong } = useGameSounds()
 *
 *   const handleAnswer = (isCorrect: boolean) => {
 *     if (isCorrect) {
 *       playCorrect()
 *     } else {
 *       playWrong()
 *     }
 *   }
 *
 *   return <AnswerButton onClick={() => handleAnswer(true)} />
 * }
 * ```
 *
 * @param options - Configuration options
 */
function useGameSounds(options: UseGameSoundsOptions = {}): UseGameSoundsReturn {
  const { volume: initialVolume = 1, enabled: initialEnabled = true } = options

  // Audio elements cache - persists across renders
  const audioCache = React.useRef<Map<SoundName, HTMLAudioElement>>(new Map())

  // State
  const [isReady, setIsReady] = React.useState(false)
  const [enabled, setEnabled] = React.useState(initialEnabled)
  const [volume, setVolume] = React.useState(initialVolume)

  // Preload all sounds on mount
  React.useEffect(() => {
    let isMounted = true
    const cache = audioCache.current

    const preloadSounds = async () => {
      const soundNames = Object.keys(SOUND_PATHS) as SoundName[]

      await Promise.all(
        soundNames.map((name) => {
          return new Promise<void>((resolve) => {
            const audio = new Audio(SOUND_PATHS[name])
            audio.preload = "auto"
            audio.volume = volume

            // Resolve on load or error (graceful fallback)
            audio.addEventListener("canplaythrough", () => {
              cache.set(name, audio)
              resolve()
            }, { once: true })

            audio.addEventListener("error", () => {
              // Log warning but don't fail - game works without sound
              console.warn(`[useGameSounds] Failed to load sound: ${name}`)
              resolve()
            }, { once: true })

            // Trigger load
            audio.load()
          })
        })
      )

      if (isMounted) {
        setIsReady(true)
      }
    }

    preloadSounds()

    return () => {
      isMounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update volume on all cached audio elements when volume changes
  React.useEffect(() => {
    audioCache.current.forEach((audio) => {
      audio.volume = Math.max(0, Math.min(1, volume))
    })
  }, [volume])

  // Play function - memoized with useCallback
  const play = React.useCallback(
    (sound: SoundName) => {
      if (!enabled) return

      const audio = audioCache.current.get(sound)
      if (!audio) {
        // Sound not loaded - fail silently (game continues without sound)
        return
      }

      // Reset to beginning (allows rapid repeated plays)
      audio.currentTime = 0

      // Play with error handling
      audio.play().catch(() => {
        // Autoplay may be blocked - fail silently
        // This is expected behavior on some browsers until user interaction
      })
    },
    [enabled]
  )

  // Convenience methods
  const playCorrect = React.useCallback(() => play("correct"), [play])
  const playWrong = React.useCallback(() => play("wrong"), [play])

  return {
    playCorrect,
    playWrong,
    play,
    isReady,
    setEnabled,
    setVolume,
  }
}

export { useGameSounds, SOUND_PATHS }
