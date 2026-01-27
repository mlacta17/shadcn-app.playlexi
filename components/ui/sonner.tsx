"use client"

import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  CircleInfoIcon,
  TriangleWarningIcon,
  CircleWarningIcon,
} from "@/lib/icons"

/**
 * Loading spinner for toast notifications.
 *
 * Simple SVG spinner that matches the Nucleo icon style.
 * Uses animate-spin for rotation animation.
 */
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

/**
 * Toast notification component using Sonner.
 *
 * Provides non-blocking feedback for user actions and error states.
 * Styled to match PlayLexi's design system using CSS variables.
 *
 * ## Usage
 *
 * 1. Add <Toaster /> to your root layout (already done)
 * 2. Import and call toast functions:
 *
 * ```tsx
 * import { toast } from "sonner"
 *
 * // Success toast
 * toast.success("Game saved!")
 *
 * // Error toast with retry action
 * toast.error("Failed to load word", {
 *   action: {
 *     label: "Retry",
 *     onClick: () => refetch()
 *   }
 * })
 *
 * // Loading toast with promise
 * toast.promise(saveGame(), {
 *   loading: "Saving...",
 *   success: "Saved!",
 *   error: "Failed to save"
 * })
 * ```
 *
 * @see https://sonner.emilkowal.ski for full API
 */
const Toaster = ({ ...props }: ToasterProps) => {
  // Detect dark mode from document class (works without ThemeProvider)
  const [theme, setTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    // Check if dark class is on html element
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "dark" : "light")

    // Watch for changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          const isDarkNow = document.documentElement.classList.contains("dark")
          setTheme(isDarkNow ? "dark" : "light")
        }
      }
    })

    observer.observe(document.documentElement, { attributes: true })
    return () => observer.disconnect()
  }, [])

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Position at bottom center (mobile-friendly, doesn't obscure game content)
      position="bottom-center"
      // Toast icons using Nucleo icon library
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <CircleInfoIcon className="size-4 text-focus" />,
        warning: <TriangleWarningIcon className="size-4 text-primary" />,
        error: <CircleWarningIcon className="size-4 text-destructive" />,
        loading: <LoadingSpinner className="size-4 animate-spin" />,
      }}
      // No custom CSS variables needed - we use unstyled mode and Tailwind classes
      // Enable close button for dismissibility
      closeButton={true}
      toastOptions={{
        // Disable Sonner's default styles so our Tailwind classes have full control
        // This sets data-styled="false" on toasts, preventing Sonner's CSS from applying
        unstyled: true,
        classNames: {
          // Toast container - matches Figma design (336px max-width, 16px padding, rounded-2xl)
          // flex layout with gap for icon + content + close button
          toast:
            "group toast flex items-start gap-2 bg-popover text-popover-foreground border border-border shadow-lg rounded-2xl p-4 w-[336px]",
          // Title text - medium weight per Figma
          title: "text-sm font-medium",
          // Description text - regular weight, muted color
          description: "text-sm text-muted-foreground",
          // Content wrapper (contains title + description)
          content: "flex-1 flex flex-col gap-1",
          // Action button - matches PlayLexi default button variant (yellow/primary, pill shape)
          actionButton:
            "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] text-sm font-medium h-6 px-2 rounded-full cursor-pointer transition-colors",
          // Cancel button - matches secondary button variant
          cancelButton:
            "bg-secondary text-secondary-foreground hover:bg-[var(--secondary-hover)] text-sm font-medium h-6 px-2 rounded-full cursor-pointer transition-colors",
          // Close button - styled like ghost icon button (matches Button variant="ghost" size="icon-sm")
          // Positioned top-right, circular, with hover background
          closeButton:
            "absolute right-2 top-2 size-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors",
          // Icon container - fixed size, flex centered
          icon: "shrink-0 mt-0.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
