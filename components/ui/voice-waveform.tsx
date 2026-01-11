"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Design System Tokens
 *
 * These map to the project's CSS variables defined in globals.css.
 * Using CSS variables ensures the component respects theme changes (light/dark mode).
 *
 * Colors:
 * - --foreground: Main text/icon color (near-black in light, near-white in dark)
 *
 * The component uses canvas for performance, so we read CSS variables
 * at runtime rather than using Tailwind classes directly.
 */

export interface VoiceWaveformProps {
  /** Audio analyser node from useSpeechRecognition hook - when provided, shows active state */
  analyserNode?: AnalyserNode | null
  /** Number of bars in the waveform (default: 34) */
  barCount?: number
  /** Gap between bars - uses Tailwind spacing scale: 0.5 = 2px, 0.75 = 3px, 1 = 4px (default: 0.75 = 3px) */
  barGap?: number
  /** Width of each bar - uses Tailwind spacing scale: 1.5 = 6px (default: 1.5 = 6px) */
  barWidth?: number
  /** Minimum bar height in px - shown in inactive state (default: 4px) */
  minBarHeight?: number
  /** Maximum bar height in px - peak height when active (default: 67px to match Figma) */
  maxBarHeight?: number
  /** Sensitivity multiplier for audio input - higher = more reactive (default: 1.5) */
  sensitivity?: number
  /** Additional class names */
  className?: string
}

/**
 * Voice waveform visualizer component.
 *
 * A canvas-based audio visualizer that displays:
 * - **Inactive state**: Minimal, uniform short bars when no analyserNode is provided
 * - **Active state**: Dynamic bars that react to audio input, mirrored from center
 *
 * ## Design System Compliance
 * - Uses `--foreground` CSS variable for bar color (respects light/dark mode)
 * - Bars use fully-rounded ends (like buttons per STYLE_GUIDE.md)
 * - Follows component patterns: data-slot, data-state attributes
 *
 * ## Architecture
 * This is a **presentational component**. Audio capture logic should live in
 * the `useSpeechRecognition` hook, which provides the analyserNode.
 *
 * @example
 * ```tsx
 * import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
 * import { VoiceWaveform } from "@/components/ui/voice-waveform"
 *
 * function MyComponent() {
 *   const { analyserNode, startRecording, stopRecording } = useSpeechRecognition()
 *
 *   return (
 *     <div className="flex flex-col items-center gap-6">
 *       <VoiceWaveform analyserNode={analyserNode} />
 *       <Button onClick={startRecording}>Record</Button>
 *     </div>
 *   )
 * }
 * ```
 */
function VoiceWaveform({
  analyserNode,
  barCount = 34,
  barGap = 3, // 0.75rem equivalent in px
  barWidth = 6, // 1.5rem equivalent in px
  minBarHeight = 4,
  maxBarHeight = 67,
  sensitivity = 1.5,
  className,
}: VoiceWaveformProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const animationRef = React.useRef<number | null>(null)
  const dataArrayRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null)
  const prevHeightsRef = React.useRef<number[]>([])
  const randomOffsetsRef = React.useRef<number[]>([])

  // Smoothing factor for transitions (0 = instant, 1 = no change)
  // Creates fluid, natural-feeling animations
  const smoothingFactor = 0.3

  // Asymmetry factor - adds organic variation to break perfect symmetry
  // ~12% variation makes it feel alive rather than robotic
  const asymmetryFactor = 0.12

  // Generate stable random offsets for each bar (only once per mount)
  // This creates consistent "personality" for the waveform
  if (randomOffsetsRef.current.length !== barCount) {
    randomOffsetsRef.current = Array.from({ length: barCount }, () =>
      1 + (Math.random() - 0.5) * 2 * asymmetryFactor
    )
  }

  // Calculate canvas dimensions
  const canvasWidth = barCount * barWidth + (barCount - 1) * barGap
  const canvasHeight = maxBarHeight

  /**
   * Reads the --foreground CSS variable from the document root.
   * This ensures the waveform respects the current theme (light/dark mode).
   *
   * Falls back to near-black (#0a0a0a) if variable is not found.
   */
  const getBarColor = React.useCallback(() => {
    if (typeof window === "undefined") return "#0a0a0a"

    const styles = getComputedStyle(document.documentElement)
    const foreground = styles.getPropertyValue("--foreground").trim()

    // Convert OKLCH to a usable color if needed, or use as-is
    // Most browsers support OKLCH in canvas fillStyle
    return foreground || "#0a0a0a"
  }, [])

  /**
   * Draws the inactive state - minimal uniform bars.
   * All bars are the same height (minBarHeight), creating a flat "idle" look.
   * Bars use fully-rounded ends (radius = barWidth/2) per STYLE_GUIDE.md button pattern.
   */
  const drawInactive = React.useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const color = getBarColor()
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      for (let i = 0; i < barCount; i++) {
        const barHeight = minBarHeight
        const x = i * (barWidth + barGap)
        const y = (canvasHeight - barHeight) / 2

        ctx.fillStyle = color
        ctx.beginPath()
        // Fully-rounded ends (like buttons) - radius is half the width
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        ctx.fill()
      }
    },
    [barCount, barGap, barWidth, minBarHeight, canvasWidth, canvasHeight, getBarColor]
  )

  /**
   * Draws the active state - dynamic bars responding to audio.
   *
   * Key behaviors:
   * 1. Mirrors from center - animation expands outward symmetrically
   * 2. Focuses on voice frequencies (100Hz-3000Hz) for better voice reactivity
   * 3. Applies smoothing for fluid transitions
   * 4. Adds subtle asymmetry (~12%) for organic feel
   */
  const drawActive = React.useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const color = getBarColor()
      const dataArray = dataArrayRef.current

      if (!analyserNode || !dataArray) return

      analyserNode.getByteFrequencyData(dataArray)
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Focus on voice frequencies (bins 2-40 ≈ 100Hz-3000Hz for human voice)
      const voiceStartBin = 2
      const voiceEndBin = 40
      const voiceBins = voiceEndBin - voiceStartBin

      // Calculate heights for half the bars (will be mirrored)
      const halfBars = Math.floor(barCount / 2)
      const step = Math.floor(voiceBins / halfBars)
      const heights: number[] = []

      for (let i = 0; i < halfBars; i++) {
        let sum = 0
        const startIndex = voiceStartBin + i * step
        for (let j = 0; j < step; j++) {
          sum += dataArray[startIndex + j] || 0
        }
        const average = sum / step
        const normalizedValue = average / 255
        const barHeight = Math.max(
          minBarHeight,
          minBarHeight + normalizedValue * (maxBarHeight - minBarHeight) * sensitivity
        )
        heights.push(barHeight)
      }

      // Initialize previous heights if needed
      if (prevHeightsRef.current.length !== barCount) {
        prevHeightsRef.current = new Array(barCount).fill(minBarHeight)
      }

      // Draw bars mirrored from center with smoothing and asymmetry
      for (let i = 0; i < barCount; i++) {
        const centerIndex = (barCount - 1) / 2
        const distanceFromCenter = Math.abs(i - centerIndex)
        const normalizedDistance = distanceFromCenter / centerIndex

        // Map to heights array (center gets most energy)
        const heightIndex = Math.min(Math.floor(normalizedDistance * halfBars), halfBars - 1)
        const baseHeight = heights[heightIndex] || minBarHeight

        // Apply asymmetry for organic feel
        const randomOffset = randomOffsetsRef.current[i] || 1
        const targetHeight = Math.min(maxBarHeight, Math.max(minBarHeight, baseHeight * randomOffset))

        // Smooth transition (lerp toward target)
        const prevHeight = prevHeightsRef.current[i] || minBarHeight
        const barHeight = prevHeight + (targetHeight - prevHeight) * (1 - smoothingFactor)
        prevHeightsRef.current[i] = barHeight

        const x = i * (barWidth + barGap)
        const y = (canvasHeight - barHeight) / 2

        ctx.fillStyle = color
        ctx.beginPath()
        // Fully-rounded ends (like buttons) - radius is half the width
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        ctx.fill()
      }
    },
    [analyserNode, barCount, barGap, barWidth, minBarHeight, maxBarHeight, sensitivity, smoothingFactor, canvasWidth, canvasHeight, getBarColor]
  )

  /** Animation loop - runs at 60fps when active */
  const animate = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (analyserNode && dataArrayRef.current) {
      drawActive(ctx)
      animationRef.current = requestAnimationFrame(animate)
    } else {
      drawInactive(ctx)
    }
  }, [analyserNode, drawActive, drawInactive])

  // Initialize/cleanup data array when analyser changes
  React.useEffect(() => {
    if (analyserNode) {
      const bufferLength = analyserNode.frequencyBinCount
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(bufferLength))
      animationRef.current = requestAnimationFrame(animate)
    } else {
      dataArrayRef.current = null
      // Draw static inactive state
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) drawInactive(ctx)
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [analyserNode, animate, drawInactive])

  // Initial draw on mount
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && !analyserNode) {
      const ctx = canvas.getContext("2d")
      if (ctx) drawInactive(ctx)
    }
  }, [analyserNode, drawInactive])

  return (
    <div
      data-slot="voice-waveform"
      data-state={analyserNode ? "active" : "inactive"}
      className={cn("flex items-center justify-center", className)}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="block"
        aria-hidden="true"
        style={{ width: canvasWidth, height: canvasHeight }}
      />
    </div>
  )
}

export { VoiceWaveform }
