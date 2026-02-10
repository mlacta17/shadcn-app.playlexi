"use client"

import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

// =============================================================================
// ACTION CARD COMPONENT
// =============================================================================

export interface ActionCardProps {
  /** Path to the illustration SVG */
  imageSrc: string
  /** Alt text for the illustration */
  imageAlt: string
  /** Card title text */
  title: string
  /** Card description text */
  description: string
  /** Image width in pixels (default: 44) */
  imageWidth?: number
  /** Image height in pixels (default: 44) */
  imageHeight?: number
  /** Click handler */
  onClick?: () => void
  /** Whether the card is disabled */
  disabled?: boolean
  /** Additional class names */
  className?: string
}

/**
 * Clickable action card with illustration, title, and description.
 *
 * Uses secondary button design system for consistent hover/focus states:
 * - Background: bg-secondary
 * - Hover: hover:bg-[var(--secondary-hover)]
 * - Shadow: shadow-xs
 *
 * Used in game result pages for actions like "Review game", "Play again",
 * "Share game", "Challenge a Friend", etc.
 *
 * @example
 * ```tsx
 * <ActionCard
 *   imageSrc="/illustrations/play-again.svg"
 *   imageAlt="Play again"
 *   title="Play again"
 *   description="Don't want to stop? Let's play again!"
 *   onClick={handlePlayAgain}
 * />
 * ```
 *
 * @see Figma node 2880:30127 (Endless result action cards)
 * @see Figma node 2913:15856 (Daily result action cards)
 */
function ActionCard({
  imageSrc,
  imageAlt,
  title,
  description,
  imageWidth = 44,
  imageHeight = 44,
  onClick,
  disabled = false,
  className,
}: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Layout
        "flex flex-col items-start gap-3 p-6 w-full text-left",
        // Styling (matches secondary button, shadow-xs per Figma)
        "bg-secondary rounded-xl shadow-xs",
        // Transitions
        "transition-colors",
        // Hover state (matches secondary button hover)
        "hover:bg-[var(--secondary-hover)]",
        // Focus state for accessibility
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Disabled state
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
    >
      {/* Illustration */}
      <div className="h-11 flex items-center justify-center">
        <Image
          src={imageSrc}
          alt={imageAlt}
          width={imageWidth}
          height={imageHeight}
          className="object-contain"
        />
      </div>
      {/* Text content */}
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}

export { ActionCard }
