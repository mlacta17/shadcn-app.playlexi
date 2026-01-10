"use client"

import { useRouter } from "next/navigation"

import { RankBadge, RANK_LABELS, type RankTier } from "@/components/game/rank-badge"
import { Button } from "@/components/ui/button"
import { TopNavbar } from "@/components/ui/top-navbar"

/**
 * Rank Result Page — Shown after placement game completion.
 *
 * Displays the user's earned rank and prompts them to create an account
 * to save their progress. This is the final step before OAuth sign-up
 * in the new user onboarding flow.
 *
 * Flow: Tutorial → Placement Game → **Rank Result** → OAuth Sign Up
 *
 * @see PRD.md Section 2.2.3 — Rank Assignment Screen
 * @see Figma node 2610:6076
 */
export default function RankResultPage() {
  const router = useRouter()

  // TODO: Get actual rank from placement game result (context/params)
  // For now, defaulting to "new-bee" as the starting rank
  const earnedRank: RankTier = "new-bee"
  const rankLabel = RANK_LABELS[earnedRank]

  const handleClose = () => {
    // TODO: Decide where close should navigate
    // Options: back to home, back to placement, or show confirmation dialog
    router.push("/")
  }

  const handleGoogleSignUp = () => {
    // TODO: Implement Google OAuth
    console.log("Google sign up clicked")
  }

  const handleAppleSignUp = () => {
    // TODO: Implement Apple OAuth
    console.log("Apple sign up clicked")
  }

  const handleSignIn = () => {
    // TODO: Navigate to sign in page
    router.push("/signin")
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
            <Button
              variant="outline"
              className="h-9 w-full gap-2"
              onClick={handleGoogleSignUp}
            >
              <GoogleIcon />
              Sign up with Google
            </Button>

            <Button
              variant="outline"
              className="h-9 w-full gap-2"
              onClick={handleAppleSignUp}
            >
              <AppleIcon />
              Sign up with Apple
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

/**
 * Google "G" logo icon.
 * Original brand colors preserved for brand recognition.
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M15.68 8.18c0-.57-.05-1.12-.15-1.64H8v3.1h4.31a3.68 3.68 0 0 1-1.6 2.42v2h2.59c1.51-1.4 2.38-3.45 2.38-5.88z"
        fill="#4285F4"
      />
      <path
        d="M8 16c2.16 0 3.97-.72 5.3-1.94l-2.59-2a4.78 4.78 0 0 1-7.13-2.51H.93v2.06A8 8 0 0 0 8 16z"
        fill="#34A853"
      />
      <path
        d="M3.58 9.55a4.8 4.8 0 0 1 0-3.1V4.39H.93a8 8 0 0 0 0 7.22l2.65-2.06z"
        fill="#FBBC05"
      />
      <path
        d="M8 3.18c1.18 0 2.24.41 3.08 1.21l2.3-2.3A7.96 7.96 0 0 0 8 0 8 8 0 0 0 .93 4.39l2.65 2.06A4.77 4.77 0 0 1 8 3.18z"
        fill="#EA4335"
      />
    </svg>
  )
}

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
