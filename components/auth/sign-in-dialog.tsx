"use client"

import { useRouter } from "next/navigation"
import { CircleUserIcon } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { AppleSignInButton } from "@/components/auth/apple-sign-in-button"

interface SignInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Sign-in modal shown when anonymous users tap the "Sign in" button in the navbar.
 *
 * Displays Google and Apple OAuth buttons in a centered dialog.
 * Matches the Figma design at node 3097:49442.
 *
 * "Sign up" link routing:
 * - If `localStorage("playlexi_tutorial_complete")` is set → `/login`
 * - Otherwise → `/onboarding/tutorial?returnTo=/login` (tutorial first, then OAuth)
 *
 * @see components/game/sign-up-prompt-dialog.tsx for the locked-game-card variant
 */
function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  const router = useRouter()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-20 items-center justify-center rounded-full bg-secondary">
            <div className="flex size-14 items-center justify-center rounded-full border bg-background">
              <CircleUserIcon className="size-7 text-foreground" />
            </div>
          </div>
          <DialogTitle className="text-2xl">Sign into your account</DialogTitle>
          <DialogDescription>
            Log in to unlock tailored content and stay connected with your community.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <GoogleSignInButton callbackURL="/auth/callback">
            Sign in with Google
          </GoogleSignInButton>
          <AppleSignInButton callbackURL="/auth/callback">
            Sign in with Apple
          </AppleSignInButton>
        </div>

        <div className="flex items-center justify-center gap-1 text-sm">
          <span className="text-muted-foreground">Don&apos;t have an account?</span>
          <Button
            variant="link"
            className="h-auto p-0 text-sm font-medium"
            onClick={() => {
              onOpenChange(false)
              // New users who haven't seen the tutorial get it first,
              // then land on /login for OAuth. Users who already completed
              // the tutorial skip straight to OAuth.
              const tutorialComplete =
                localStorage.getItem("playlexi_tutorial_complete") === "true"
              if (tutorialComplete) {
                router.push("/login")
              } else {
                router.push("/onboarding/tutorial?returnTo=/login")
              }
            }}
          >
            Sign up
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { SignInDialog }
