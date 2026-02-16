"use client"

import { CircleUserIcon } from "@/lib/icons"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { AppleSignInButton } from "@/components/auth/apple-sign-in-button"
import type { GameModeConfig } from "@/lib/game-modes"

interface SignUpPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameMode: GameModeConfig | null
}

/**
 * Sign-up prompt shown when anonymous users tap a locked game card.
 *
 * Displays Google and Apple OAuth buttons in a centered dialog.
 * Matches the Figma design at node 3097:49514.
 *
 * @see components/auth/sign-in-dialog.tsx for the navbar sign-in variant
 */
function SignUpPromptDialog({ open, onOpenChange, gameMode }: SignUpPromptDialogProps) {
  if (!gameMode) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-20 items-center justify-center rounded-full bg-secondary">
            <div className="flex size-14 items-center justify-center rounded-full border bg-background">
              <CircleUserIcon className="size-7 text-foreground" />
            </div>
          </div>
          <DialogTitle className="text-2xl">Sign up to play {gameMode.title}</DialogTitle>
          <DialogDescription>
            Create a free account to unlock all game modes and track your progress
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <GoogleSignInButton callbackURL="/auth/callback" />
          <AppleSignInButton callbackURL="/auth/callback" />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { SignUpPromptDialog }
