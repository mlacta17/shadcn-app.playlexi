"use client"

import * as React from "react"
import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { RankBadge, RANK_LABELS, type RankTier } from "@/components/game/rank-badge"
import { GoogleSignInButton } from "@/components/auth"
import { Button } from "@/components/ui/button"
import { TopNavbar } from "@/components/ui/top-navbar"

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * SessionStorage key for placement test results.
 * Used to persist data between OAuth redirect.
 */
const PLACEMENT_STORAGE_KEY = "playlexi_placement_result"

/**
 * Map numeric tier (1-7) to RankTier name.
 */
const TIER_TO_RANK: Record<number, RankTier> = {
  1: "new-bee",
  2: "bumble-bee",
  3: "busy-bee",
  4: "honey-bee",
  5: "worker-bee",
  6: "royal-bee",
  7: "bee-keeper",
}

// =============================================================================
// INNER COMPONENT (uses useSearchParams)
// =============================================================================

/**
 * Inner content component that uses useSearchParams.
 * Must be wrapped in Suspense.
 */
function RankResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get tier from URL params or sessionStorage
  const [earnedRank, setEarnedRank] = React.useState<RankTier>("new-bee")

  React.useEffect(() => {
    // Try to get tier from URL params first (e.g., ?tier=3)
    const tierParam = searchParams.get("tier")
    if (tierParam) {
      const tier = parseInt(tierParam, 10)
      if (tier >= 1 && tier <= 7) {
        setEarnedRank(TIER_TO_RANK[tier])
        // Also store in sessionStorage for persistence through OAuth
        try {
          sessionStorage.setItem(
            PLACEMENT_STORAGE_KEY,
            JSON.stringify({
              derivedTier: tier,
              rating: 1000 + (tier - 1) * 150, // Rough estimate
              ratingDeviation: 200,
              timestamp: Date.now(),
            })
          )
        } catch {
          // sessionStorage not available
        }
        return
      }
    }

    // Fall back to sessionStorage
    try {
      const stored = sessionStorage.getItem(PLACEMENT_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.derivedTier >= 1 && data.derivedTier <= 7) {
          setEarnedRank(TIER_TO_RANK[data.derivedTier])
        }
      }
    } catch {
      // sessionStorage not available or invalid data
    }
  }, [searchParams])

  const rankLabel = RANK_LABELS[earnedRank]

  const handleClose = () => {
    // Return to home (will prompt to sign up again if they return)
    router.push("/")
  }

  const handleSignIn = () => {
    // Existing users can sign in
    router.push("/login")
  }

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Minimal navbar with just close button */}
      <TopNavbar onClose={handleClose} hideSkip />

      {/* Main content - centered vertically and horizontally */}
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-xl flex-col items-center gap-12">
          {/* Rank badge and message */}
          <div className="flex flex-col items-center gap-6 text-center">
            <RankBadge rank={earnedRank} size="xl" />

            {/* Title and subtitle */}
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-bold text-card-foreground">
                You&apos;ve qualified as a &quot;{rankLabel}&quot; Rank
              </h1>
              <p className="text-sm text-muted-foreground">
                Create an account to save your progress and continue playing for free
              </p>
            </div>
          </div>

          {/* Sign up buttons */}
          <div className="flex w-full max-w-sm flex-col gap-3">
            {/*
              OAuth callback goes to /auth/callback which:
              1. Checks if user already exists → dashboard
              2. New user → /onboarding/profile (reads placement from sessionStorage)
            */}
            <GoogleSignInButton
              callbackURL="/auth/callback"
              className="h-9"
            >
              Sign up with Google
            </GoogleSignInButton>

            {/*
              Apple Sign-In: Coming soon
              Requires Apple Developer account setup
            */}
            <Button
              variant="outline"
              className="h-9 w-full gap-2"
              disabled
            >
              <AppleIcon />
              Sign up with Apple (Coming Soon)
            </Button>

            {/* Sign in link */}
            <div className="flex items-center justify-center gap-1 text-sm">
              <span className="text-muted-foreground">Already have an account?</span>
              <Button
                variant="link"
                className="h-auto p-0 text-sm font-medium"
                onClick={handleSignIn}
              >
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

/**
 * Rank Result Page — Shown after placement game completion.
 *
 * Displays the user's earned rank and prompts them to create an account
 * to save their progress. This is the final step before OAuth sign-up
 * in the new user onboarding flow.
 *
 * ## Data Flow
 * 1. Placement test stores results in sessionStorage
 * 2. This page reads the tier to display
 * 3. OAuth redirects to /auth/callback
 * 4. Profile page reads sessionStorage to initialize user
 *
 * Flow: Tutorial → Placement Game → **Rank Result** → OAuth → Profile
 *
 * @see PRD.md Section 2.2.3 — Rank Assignment Screen
 * @see Figma node 2610:6076
 */
export default function RankResultPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <RankResultContent />
    </Suspense>
  )
}

// =============================================================================
// ICONS
// =============================================================================

/**
 * Apple logo icon.
 * Uses currentColor to match surrounding text.
 */
function AppleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M12.15 8.4c-.02-1.76 1.44-2.6 1.5-2.64a3.26 3.26 0 0 0-2.56-1.39c-1.08-.11-2.12.64-2.67.64-.56 0-1.41-.63-2.32-.61a3.43 3.43 0 0 0-2.89 1.76c-1.24 2.15-.32 5.33.88 7.07.59.85 1.29 1.8 2.2 1.77.89-.04 1.22-.57 2.3-.57 1.06 0 1.37.57 2.29.55.95-.02 1.56-.86 2.14-1.72a7.1 7.1 0 0 0 .97-2 3.13 3.13 0 0 1-1.84-2.86zM10.44 3.22a3.2 3.2 0 0 0 .73-2.28 3.26 3.26 0 0 0-2.1 1.1 3.04 3.04 0 0 0-.75 2.2c.78.06 1.58-.38 2.12-1.02z" />
    </svg>
  )
}
