"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface VoiceWaveformProps {
  /** Audio analyser node from useVoiceRecorder hook - when provided, shows active state */
  analyserNode?: AnalyserNode | null
  /** Number of bars in the waveform */
  barCount?: number
  /** Gap between bars in pixels */
  barGap?: number
  /** Width of each bar in pixels */
  barWidth?: number
  /** Minimum bar height (inactive state) */
  minBarHeight?: number
  /** Maximum bar height (active state) */
  maxBarHeight?: number
  /** Sensitivity multiplier for audio input (0.5 - 3.0) */
  sensitivity?: number
  /** Additional class names */
  className?: string
}

/**
 * Voice waveform visualizer component.
 *
 * - **Inactive state**: Shows minimal, uniform short bars when no analyserNode is provided
 * - **Active state**: Reacts to audio input when analyserNode is provided
 *
 * @example
 * ```tsx
 * const { analyserNode } = useVoiceRecorder()
 * <VoiceWaveform analyserNode={analyserNode} />
 * ```
 */
function VoiceWaveform({
  analyserNode,
  barCount = 34,
  barGap = 3,
  barWidth = 6,
  minBarHeight = 4,
  maxBarHeight = 67,
  sensitivity = 1.5,
  className,
}: VoiceWaveformProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const animationRef = React.useRef<number | null>(null)
  const dataArrayRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null)

  // Calculate canvas dimensions
  const canvasWidth = barCount * barWidth + (barCount - 1) * barGap
  const canvasHeight = maxBarHeight

  // Get the bar color from CSS variable (foreground = black in light mode)
  const getBarColor = React.useCallback(() => {
    if (typeof window !== "undefined") {
      const styles = getComputedStyle(document.documentElement)
      return styles.getPropertyValue("--foreground").trim() || "#0a0a0a"
    }
    return "#0a0a0a"
  }, [])

  // Draw inactive state - minimal uniform bars
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
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        ctx.fill()
      }
    },
    [barCount, barGap, barWidth, minBarHeight, canvasWidth, canvasHeight, getBarColor]
  )

  // Draw active waveform from audio data
  const drawActive = React.useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const color = getBarColor()
      const dataArray = dataArrayRef.current

      if (!analyserNode || !dataArray) return

      analyserNode.getByteFrequencyData(dataArray)
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // Sample the frequency data to match our bar count
      const bufferLength = analyserNode.frequencyBinCount
      const step = Math.floor(bufferLength / barCount)

      for (let i = 0; i < barCount; i++) {
        // Average a range of frequencies for smoother visualization
        let sum = 0
        const startIndex = i * step
        for (let j = 0; j < step; j++) {
          sum += dataArray[startIndex + j] || 0
        }
        const average = sum / step

        // Scale the value to bar height
        const normalizedValue = average / 255
        const barHeight = Math.max(
          minBarHeight,
          minBarHeight + normalizedValue * (maxBarHeight - minBarHeight) * sensitivity
        )

        const x = i * (barWidth + barGap)
        const y = (canvasHeight - barHeight) / 2

        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2)
        ctx.fill()
      }
    },
    [analyserNode, barCount, barGap, barWidth, minBarHeight, maxBarHeight, sensitivity, canvasWidth, canvasHeight, getBarColor]
  )

  // Animation loop
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

  // Initialize data array when analyser changes
  React.useEffect(() => {
    if (analyserNode) {
      const bufferLength = analyserNode.frequencyBinCount
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(bufferLength))
      // Start animation when analyser is connected
      animationRef.current = requestAnimationFrame(animate)
    } else {
      dataArrayRef.current = null
      // Draw static inactive state
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          drawInactive(ctx)
        }
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [analyserNode, animate, drawInactive])

  // Initial draw
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && !analyserNode) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        drawInactive(ctx)
      }
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
        style={{ width: canvasWidth, height: canvasHeight }}
      />
    </div>
  )
}

export { VoiceWaveform }
