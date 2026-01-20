/**
 * Logo Component — PlayLexi
 *
 * Consistent branding component used across the application.
 * Available in multiple sizes for different contexts (navbar, login, etc.)
 */

import Link from "next/link"
import { cn } from "@/lib/utils"

// =============================================================================
// LOGO SVG
// =============================================================================

/**
 * PlayLexi brand mark SVG.
 * Abstract pencil/checkmark design representing learning and achievement.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-9", className)}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Yellow pencil body */}
      <path
        d="M8 28L6 30V32H8L10 30L28 12L26 8L8 28Z"
        fill="#FCB040"
      />
      {/* Dark tip/checkmark */}
      <path
        d="M26 8L28 12L32 8L28 4L26 8Z"
        fill="#171717"
      />
      {/* Pencil eraser top */}
      <path
        d="M6 30L4 28L6 26L8 28L6 30Z"
        fill="#171717"
      />
    </svg>
  )
}

// =============================================================================
// LOGO COMPONENT
// =============================================================================

interface LogoProps {
  /** Size variant */
  size?: "sm" | "default" | "lg"
  /** Whether to show the wordmark text */
  showWordmark?: boolean
  /** Optional link destination (defaults to home) */
  href?: string
  /** Disable link behavior (just render logo) */
  asStatic?: boolean
  /** Additional class names */
  className?: string
}

/**
 * PlayLexi Logo component.
 *
 * Renders the brand mark with optional wordmark text.
 * Automatically wraps in a Link unless asStatic is true.
 *
 * @example
 * ```tsx
 * // Navbar logo (small, link to home)
 * <Logo size="sm" />
 *
 * // Login page logo (larger, static)
 * <Logo size="lg" asStatic />
 *
 * // With wordmark
 * <Logo showWordmark />
 * ```
 */
function Logo({
  size = "default",
  showWordmark = false,
  href = "/",
  asStatic = false,
  className,
}: LogoProps) {
  const sizeClasses = {
    sm: "size-8",
    default: "size-9",
    lg: "size-12",
  }

  const wordmarkSizes = {
    sm: "text-lg",
    default: "text-xl",
    lg: "text-2xl",
  }

  const content = (
    <div
      data-slot="logo"
      className={cn("flex items-center gap-2", className)}
    >
      <LogoMark className={sizeClasses[size]} />
      {showWordmark && (
        <span
          className={cn(
            "font-bold text-foreground",
            wordmarkSizes[size]
          )}
        >
          PlayLexi
        </span>
      )}
    </div>
  )

  if (asStatic) {
    return content
  }

  return (
    <Link href={href} aria-label="PlayLexi Home">
      {content}
    </Link>
  )
}

export { Logo, LogoMark }
