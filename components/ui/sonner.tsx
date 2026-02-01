"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import {
  CircleCheckIcon,
  CircleInfoIcon,
  TriangleWarningIcon,
  CircleWarningIcon,
} from "@/lib/icons"

// =============================================================================
// LOADING SPINNER
// =============================================================================
// Simple SVG spinner that matches the Nucleo icon style (24px viewBox).
// Uses animate-spin for rotation animation.

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// =============================================================================
// TOASTER
// =============================================================================
// Toast notifications using Sonner with PlayLexi styling.
//
// Style overrides (icon alignment, colors) are in globals.css.
// Search for "SONNER TOAST" to find them.
//
// @see app/globals.css for CSS overrides
// @see https://sonner.emilkowal.ski for Sonner API

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <CircleInfoIcon className="size-4" />,
        warning: <TriangleWarningIcon className="size-4" />,
        error: <CircleWarningIcon className="size-4" />,
        loading: <LoadingSpinner className="size-4 animate-spin" />,
      }}
      // Custom class enables CSS overrides in globals.css without !important
      toastOptions={{
        classNames: {
          toast: "playlexi-toast",
        },
      }}
      // Map Sonner's CSS variables to PlayLexi design tokens
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
