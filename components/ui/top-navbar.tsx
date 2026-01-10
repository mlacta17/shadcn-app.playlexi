"use client"

import Link from "next/link"
import { XIcon } from "@/lib/icons"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface TopNavbarProps {
  /** Callback when close button is clicked */
  onClose?: () => void
  /** URL for close button link (alternative to onClose callback) */
  closeHref?: string
  /** Content to display in the center (e.g., title, game mode) */
  centerContent?: React.ReactNode
  /** Text for the skip link (default: "Skip") */
  skipLabel?: string
  /** URL for the skip link */
  skipHref?: string
  /** Callback when skip is clicked */
  onSkip?: () => void
  /** Whether to hide the skip link */
  hideSkip?: boolean
  /** Additional class names */
  className?: string
}

/**
 * Minimal top navigation for wizard-like flows.
 *
 * A contextual header with just a close button and optional skip link.
 * Used for focused experiences where full navigation isn't needed.
 *
 * @example
 * ```tsx
 * <TopNavbar
 *   onClose={() => router.back()}
 *   skipHref="/dashboard"
 *   skipLabel="Skip"
 * />
 * ```
 */
function TopNavbar({
  onClose,
  closeHref,
  centerContent,
  skipLabel = "Skip",
  skipHref,
  onSkip,
  hideSkip = false,
  className,
}: TopNavbarProps) {
  const closeButton = (
    <Button
      variant="outline"
      size="icon-sm"
      onClick={onClose}
      aria-label="Close"
    >
      <XIcon />
    </Button>
  )

  return (
    <nav
      data-slot="top-navbar"
      className={cn(
        "relative bg-background border-b shadow-sm flex h-16 w-full items-center justify-between px-6",
        className
      )}
    >
      {/* Close button */}
      {closeHref ? (
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={closeHref} aria-label="Close">
            <XIcon />
          </Link>
        </Button>
      ) : (
        closeButton
      )}

      {/* Center content (title, game mode, etc.) */}
      {centerContent && (
        <div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-foreground">
          {centerContent}
        </div>
      )}

      {/* Skip link */}
      {!hideSkip && (skipHref || onSkip) && (
        <Button variant="link" size="xs" asChild={!!skipHref} onClick={onSkip}>
          {skipHref ? <Link href={skipHref}>{skipLabel}</Link> : skipLabel}
        </Button>
      )}
    </nav>
  )
}

export { TopNavbar }
