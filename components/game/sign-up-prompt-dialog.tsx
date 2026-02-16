"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { Button } from "@/components/ui/button"
import { ShieldIcon } from "@/lib/icons"
import type { GameModeConfig } from "@/lib/game-modes"

interface SignUpPromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameMode: GameModeConfig | null
}

function SignUpPromptDialog({ open, onOpenChange, gameMode }: SignUpPromptDialogProps) {
  if (!gameMode) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <ShieldIcon className="size-6 text-muted-foreground" />
          </div>
          <DialogTitle>Sign up to play {gameMode.title}</DialogTitle>
          <DialogDescription>
            Create a free account to unlock all game modes and track your progress.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">&#10003;</span>
            Track your stats and streaks across devices
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">&#10003;</span>
            Play Endless, Blitz, and Multiplayer modes
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-primary">&#10003;</span>
            Compete on leaderboards with friends
          </li>
        </ul>

        <div className="flex flex-col gap-2 pt-2">
          <GoogleSignInButton callbackURL="/auth/callback" />
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { SignUpPromptDialog }
