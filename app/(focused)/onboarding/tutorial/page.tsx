"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { useSession } from "@/lib/auth/client"
import { ArrowLeftIcon, ArrowRightIcon } from "@/lib/icons"

import { TopNavbar } from "@/components/ui/top-navbar"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

// =============================================================================
// TYPES & DATA
// =============================================================================

interface TutorialStep {
  step: number
  title: string
  description: string
  image: string
}

/**
 * Tutorial content from PRD Section 2.2.1.
 * 4 steps teaching how to play.
 */
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    step: 1,
    title: "Press Start, then listen carefully to the word",
    description:
      "You can replay the word as many times as you'd like. Use the definition and sentence buttons for extra clues.",
    image: "/images/tutorial/step-1.png",
  },
  {
    step: 2,
    title: "Use the microphone and spell the word letter by letter",
    description:
      "Saying the whole word will not count towards the microphone's recording, only letters.",
    image: "/images/tutorial/step-2.png",
  },
  {
    step: 3,
    title: "The game adapts to your skill level",
    description:
      "As you play, the difficulty adjusts automatically. Words get harder as you improve — no setup needed!",
    image: "/images/tutorial/step-3.png",
  },
  {
    step: 4,
    title: "In real games, you'll have lives",
    description:
      "In Endless mode, you start with 3 hearts. Each mistake costs one heart. When you run out, the game ends. In Blitz mode, there's no hearts — just a 3-minute timer!",
    image: "/images/tutorial/step-4.png",
  },
]

// =============================================================================
// CONTENT COMPONENT
// =============================================================================

function TutorialContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  // Read returnTo from URL or sessionStorage (backup for page refresh).
  // Validated to prevent open redirect attacks — must be a relative path.
  const returnTo = React.useMemo(() => {
    const fallback = "/"

    const raw = searchParams.get("returnTo")
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
      // Safe relative path — store as backup for page refresh
      if (typeof window !== "undefined") {
        sessionStorage.setItem("playlexi_tutorial_returnTo", raw)
      }
      return raw
    }

    // No URL param or invalid — try sessionStorage backup
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("playlexi_tutorial_returnTo")
      if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
        return stored
      }
    }

    return fallback
  }, [searchParams])

  const [currentStep, setCurrentStep] = React.useState(0)

  const step = TUTORIAL_STEPS[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1
  const progressPercent = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100

  // ---------------------------------------------------------------------------
  // Complete Tutorial Helper
  // ---------------------------------------------------------------------------

  const completeTutorial = React.useCallback(() => {
    // Set localStorage flag (works for all users)
    localStorage.setItem("playlexi_tutorial_complete", "true")

    // If authenticated, also sync to server
    if (session) {
      fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hasCompletedTutorial: true }),
      }).catch(() => {
        // Non-critical — localStorage is the primary check
      })
    }

    // Clean up sessionStorage
    sessionStorage.removeItem("playlexi_tutorial_returnTo")

    // Navigate to the return destination
    router.push(returnTo)
  }, [session, router, returnTo])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    router.push("/")
  }

  const handleSkip = () => {
    completeTutorial()
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleNext = () => {
    if (isLastStep) {
      completeTutorial()
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation */}
      <TopNavbar onClose={handleClose} onSkip={handleSkip} />

      {/* Progress Bar */}
      <Progress value={progressPercent} className="h-2 rounded-none" />

      {/* Main Content */}
      <main className="flex flex-1 flex-col">
        {/* Desktop Layout: Title above card, arrows on sides */}
        <div className="hidden flex-1 flex-col items-center px-6 py-10 md:flex">
          {/* Page Title */}
          <div className="mb-10 flex max-w-sm flex-col items-center gap-2 text-center">
            <h1 className="text-3xl font-bold text-card-foreground">Tutorial</h1>
            <p className="text-sm text-muted-foreground">
              Here&apos;s what you need to know before you play:
            </p>
          </div>

          {/* Card with Navigation Arrows */}
          <div className="flex items-center gap-8">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="icon-lg"
              onClick={handlePrevious}
              disabled={isFirstStep}
              aria-label="Previous step"
            >
              <ArrowLeftIcon />
            </Button>

            {/* Step Card */}
            <Card className="w-full max-w-xl">
              <CardContent className="flex flex-col gap-3 pt-6">
                <Badge variant="secondary" size="number">
                  {step.step}
                </Badge>
                <p className="text-base font-semibold text-card-foreground">
                  {step.title}
                </p>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  {/* Placeholder for tutorial images */}
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Tutorial illustration {step.step}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </CardFooter>
            </Card>

            {/* Next Button */}
            <Button
              variant="outline"
              size="icon-lg"
              onClick={handleNext}
              aria-label={isLastStep ? "Start playing" : "Next step"}
            >
              <ArrowRightIcon />
            </Button>
          </div>
        </div>

        {/* Mobile Layout: Card takes full width, arrows at bottom */}
        <div className="flex flex-1 flex-col gap-6 px-6 pb-12 pt-6 md:hidden">
          {/* Step Card */}
          <Card className="flex-1">
            <CardContent className="flex flex-col gap-3 pt-6">
              <Badge variant="secondary" size="number">
                {step.step}
              </Badge>
              <p className="text-base font-semibold text-card-foreground">
                {step.title}
              </p>
            </CardContent>
            <CardFooter className="flex flex-1 flex-col gap-2">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                {/* Placeholder for tutorial images */}
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Tutorial illustration {step.step}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </CardFooter>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon-lg"
              onClick={handlePrevious}
              disabled={isFirstStep}
              aria-label="Previous step"
            >
              <ArrowLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              onClick={handleNext}
              aria-label={isLastStep ? "Start playing" : "Next step"}
            >
              <ArrowRightIcon />
            </Button>
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
 * Onboarding Tutorial Page
 *
 * Teaches new users how to play before their first game.
 * 4 steps with progress indicator, previous/next navigation.
 *
 * Accepts `?returnTo=/game/daily` search param to redirect after completion.
 * Sets `localStorage("playlexi_tutorial_complete")` on finish/skip.
 * If authenticated, also PATCHes `/api/users/me` with `hasCompletedTutorial: true`.
 *
 * @see PRD.md Section 2.2.1 — Tutorial (4 Steps)
 * @see Figma node 2703:15700
 */
export default function TutorialPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-background flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading tutorial...</div>
        </div>
      }
    >
      <TutorialContent />
    </Suspense>
  )
}
