import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * HexPattern — Decorative hexagonal background pattern.
 *
 * A reusable SVG pattern component for adding subtle hexagonal backgrounds
 * to pages and sections. Currently renders a static pattern.
 *
 * ## Architecture Decision
 * We created this as a component (rather than a static SVG in `public/`)
 * because we anticipate future dynamic theming needs:
 *
 * ### Future Enhancements (Commented Out Below)
 * - Dynamic color via `currentColor` or CSS variables
 * - Theme-aware variants (light/dark mode)
 * - Configurable density/scale props
 * - Animation support (subtle drift, parallax)
 *
 * ## Usage
 * ```tsx
 * // As a full-page background
 * <div className="relative min-h-screen">
 *   <HexPattern className="absolute inset-0 -z-10" />
 *   <main className="relative">Content here</main>
 * </div>
 *
 * // As a section background
 * <section className="relative overflow-hidden">
 *   <HexPattern className="absolute inset-0 -z-10 opacity-50" />
 *   <div className="relative">Section content</div>
 * </section>
 * ```
 *
 * ## Asset Source
 * Pattern derived from Figma node `2641:7585` (hex-pattern).
 * Original dimensions: 1440x1440px
 *
 * @see STYLE_GUIDE.md for background pattern guidelines
 */

export interface HexPatternProps {
  /** Additional CSS classes for positioning and styling */
  className?: string
}

/**
 * Renders a repeating hexagonal SVG pattern.
 *
 * The pattern uses a single hexagon shape repeated via SVG `<pattern>`.
 * Color uses `currentColor` with `text-muted-foreground` for theme awareness.
 */
function HexPattern({ className }: HexPatternProps) {
  // Uses currentColor so the pattern inherits from text-muted-foreground
  // This follows the semantic color pattern - no hardcoded hex values
  return (
    <svg
      data-slot="hex-pattern"
      className={cn(
        "pointer-events-none text-muted-foreground",
        className
      )}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/*
          Hexagon pattern definition.
          Each hexagon is ~60px wide, arranged in a honeycomb layout.
          Uses currentColor for theme-aware coloring.

          Pattern math:
          - Hexagon width: 60px
          - Hexagon height: 60 * sqrt(3) / 2 ≈ 52px
          - Pattern repeats every 90px horizontally (1.5 * width)
          - Pattern repeats every 104px vertically (2 * height)
        */}
        <pattern
          id="hex-pattern"
          x="0"
          y="0"
          width="90"
          height="104"
          patternUnits="userSpaceOnUse"
        >
          {/* First hexagon - uses currentColor for theme awareness */}
          <path
            d="M30 0 L60 15 L60 45 L30 60 L0 45 L0 15 Z"
            fill="currentColor"
            fillOpacity="0.05"
            transform="translate(0, -8)"
          />
          {/* Second hexagon (offset for honeycomb) */}
          <path
            d="M30 0 L60 15 L60 45 L30 60 L0 45 L0 15 Z"
            fill="currentColor"
            fillOpacity="0.05"
            transform="translate(45, 44)"
          />
        </pattern>
      </defs>

      {/* Fill the entire SVG with the pattern */}
      <rect width="100%" height="100%" fill="url(#hex-pattern)" />
    </svg>
  )
}

export { HexPattern }
