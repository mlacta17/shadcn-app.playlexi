/**
 * Apple Sign-In Button — PlayLexi
 *
 * A branded Apple sign-in button following Apple's Human Interface Guidelines.
 * Uses Better Auth for the OAuth flow.
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
 */

"use client"

import { useState } from "react"
import { signIn } from "@/lib/auth/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// =============================================================================
// APPLE ICON
// =============================================================================

/**
 * Official Apple logo SVG.
 * Monochrome to match Apple's brand guidelines.
 */
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-5", className)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
    >
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

// =============================================================================
// LOADING SPINNER
// =============================================================================

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-5 animate-spin", className)}
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
// APPLE SIGN-IN BUTTON
// =============================================================================

interface AppleSignInButtonProps {
  /** URL to redirect to after successful sign-in */
  callbackURL?: string
  /** Custom className for styling */
  className?: string
  /** Button text */
  children?: React.ReactNode
}

/**
 * Apple Sign-In Button.
 *
 * Triggers the Apple OAuth flow via Better Auth.
 * Shows a loading state while the OAuth redirect is in progress.
 *
 * @example
 * ```tsx
 * <AppleSignInButton callbackURL="/game/endless">
 *   Sign in with Apple
 * </AppleSignInButton>
 * ```
 */
export function AppleSignInButton({
  callbackURL = "/",
  className,
  children = "Continue with Apple",
}: AppleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleSignIn() {
    setIsLoading(true)
    try {
      await signIn.social({
        provider: "apple",
        callbackURL,
      })
    } catch (error) {
      console.error("[Auth] Apple sign-in failed:", error)
      setIsLoading(false)
    }
    // Note: setIsLoading(false) is not called on success because
    // the page will redirect to Apple OAuth
  }

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleSignIn}
      disabled={isLoading}
      className={cn("w-full gap-3", className)}
    >
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <AppleIcon />
      )}
      <span>{isLoading ? "Redirecting..." : children}</span>
    </Button>
  )
}
