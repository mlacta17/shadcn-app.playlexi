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
  /** Unlock audio context (call on user interaction for Safari) */
  unlockAudio: () => void
}

/**
 * Hook for managing game sound effects using Web Audio API.
 *
 * ## Why Web Audio API instead of HTMLAudioElement?
 *
 * Safari (especially iOS) has known issues with HTMLAudioElement:
 * 1. Reusing the same Audio element causes volume drops
 * 2. Microphone AudioContext interferes with Audio element playback
 * 3. Audio context can get "suspended" requiring user interaction to resume
 *
 * Web Audio API solves these by:
 * 1. Creating new buffer sources for each play (no reuse issues)
 * 2. Using a single AudioContext that can coexist with microphone
 * 3. Properly managing context state (suspended/running)
 *
 * ## Features
 * - Preloads sounds as AudioBuffers on mount
 * - Each play() creates a new source node (no reuse issues)
 * - Handles Safari's autoplay restrictions gracefully
 * - Volume control via GainNode
 * - Respects user's sound preferences
 *
 * ## Usage
 * ```tsx
 * function GameScreen() {
 *   const { playCorrect, playWrong, unlockAudio } = useGameSounds()
 *
 *   // Call unlockAudio on first user interaction (for Safari)
 *   const handleFirstInteraction = () => {
 *     unlockAudio()
 *   }
 *
 *   const handleAnswer = (isCorrect: boolean) => {
 *     if (isCorrect) playCorrect()
 *     else playWrong()
 *   }
 *
 *   return <AnswerButton onClick={handleAnswer} />
 * }
 * ```
 */
function useGameSounds(options: UseGameSoundsOptions = {}): UseGameSoundsReturn {
  const { volume: initialVolume = 1, enabled: initialEnabled = true } = options

  // Refs for Web Audio API components (persist across renders)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const gainNodeRef = React.useRef<GainNode | null>(null)
  const bufferCache = React.useRef<Map<SoundName, AudioBuffer>>(new Map())

  // State
  const [isReady, setIsReady] = React.useState(false)
  const [enabled, setEnabled] = React.useState(initialEnabled)
  const [volume, setVolumeState] = React.useState(initialVolume)

  /**
   * Initialize AudioContext lazily (Safari requires user gesture).
   *
   * Note: We use initialVolume from the closure rather than dynamic volume
   * because this function only runs once when AudioContext is first created.
   * Subsequent volume changes are handled by the separate useEffect.
   */
  const getAudioContext = React.useCallback(() => {
    if (!audioContextRef.current) {
      // Create AudioContext (with webkit prefix for older Safari versions)
      // Safari 14.1+ supports unprefixed AudioContext, but older versions need webkit prefix
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser")
      }

      audioContextRef.current = new AudioContextClass()

      // Create master gain node for volume control
      gainNodeRef.current = audioContextRef.current.createGain()
      gainNodeRef.current.gain.value = initialVolume
      gainNodeRef.current.connect(audioContextRef.current.destination)
    }
    return audioContextRef.current
  }, [initialVolume])

  /**
   * Resume AudioContext if suspended (required by Safari after user gesture)
   */
  const unlockAudio = React.useCallback(() => {
    const ctx = getAudioContext()
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {
        // Ignore errors - context may already be running
      })
    }
  }, [getAudioContext])

  /**
   * Fetch and decode an audio file into an AudioBuffer
   */
  const loadSound = React.useCallback(async (name: SoundName): Promise<AudioBuffer | null> => {
    try {
      const ctx = getAudioContext()
      const response = await fetch(SOUND_PATHS[name])
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      return audioBuffer
    } catch (error) {
      console.warn(`[useGameSounds] Failed to load sound: ${name}`, error)
      return null
    }
  }, [getAudioContext])

  // Preload all sounds on mount
  React.useEffect(() => {
    let isMounted = true

    const preloadSounds = async () => {
      const soundNames = Object.keys(SOUND_PATHS) as SoundName[]
      let loadedCount = 0

      await Promise.all(
        soundNames.map(async (name) => {
          const buffer = await loadSound(name)
          if (buffer && isMounted) {
            bufferCache.current.set(name, buffer)
            loadedCount++
          }
        })
      )

      // Only mark as ready if at least one sound loaded successfully
      // This ensures isReady reflects actual usability
      if (isMounted && loadedCount > 0) {
        setIsReady(true)
      }
    }

    preloadSounds()

    return () => {
      isMounted = false
    }
  }, [loadSound])

  // Update gain node when volume changes
  React.useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = Math.max(0, Math.min(1, volume))
    }
  }, [volume])

  // Cleanup AudioContext on unmount
  React.useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {
          // Ignore close errors
        })
      }
    }
  }, [])

  /**
   * Play a sound by creating a new buffer source.
   * Each call creates a fresh source node, avoiding Safari's reuse issues.
   */
  const play = React.useCallback(
    (sound: SoundName) => {
      if (!enabled) return

      const buffer = bufferCache.current.get(sound)
      if (!buffer) {
        // Sound not loaded - fail silently
        return
      }

      try {
        const ctx = getAudioContext()

        // Resume context if suspended (Safari autoplay policy)
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {})
        }

        // Create a new source node for this playback
        // (This is the key fix for Safari - never reuse source nodes)
        const source = ctx.createBufferSource()
        source.buffer = buffer

        // Connect through gain node for volume control
        if (gainNodeRef.current) {
          source.connect(gainNodeRef.current)
        } else {
          source.connect(ctx.destination)
        }

        // Play immediately
        source.start(0)

        // Source nodes auto-cleanup after playback ends
      } catch (error) {
        // Fail silently - game continues without sound
        console.warn(`[useGameSounds] Playback error for ${sound}:`, error)
      }
    },
    [enabled, getAudioContext]
  )

  // Convenience methods
  const playCorrect = React.useCallback(() => play("correct"), [play])
  const playWrong = React.useCallback(() => play("wrong"), [play])

  // Volume setter that updates both state and gain node
  const setVolume = React.useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume))
    setVolumeState(clampedVolume)
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = clampedVolume
    }
  }, [])

  return React.useMemo(
    () => ({
      playCorrect,
      playWrong,
      play,
      isReady,
      setEnabled,
      setVolume,
      unlockAudio,
    }),
    [playCorrect, playWrong, play, isReady, setEnabled, setVolume, unlockAudio]
  )
}

export { useGameSounds, SOUND_PATHS }
