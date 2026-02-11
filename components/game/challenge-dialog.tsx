/**
 * Challenge Dialog — PlayLexi
 *
 * Modal dialog for sharing today's Daily Spell challenge with friends.
 * Shows a shareable link and tracks how many friends have accepted.
 *
 * ## Features
 *
 * - Generates a unique challenge link for the user
 * - Copy-to-clipboard functionality
 * - Shows count of accepted invitations
 * - Tracks referrals via the challenge API
 *
 * ## API Integration
 *
 * - GET /api/daily-spell/challenge - Get or create challenge link
 * - Returns: { code, acceptedCount }
 *
 * @see Figma node 3000:35653
 * @see /app/api/daily-spell/challenge/route.ts
 */

"use client"

import * as React from "react"

import { CopyIcon, CheckIcon, CircleUserIcon } from "@/lib/icons"
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"

// =============================================================================
// TYPES
// =============================================================================

interface ChallengeDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
}

interface ChallengeData {
  code: string
  acceptedCount: number
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Challenge a Friend Dialog
 *
 * Displays a shareable link for today's Daily Spell challenge
 * and shows how many friends have accepted the invitation.
 */
export function ChallengeDialog({ open, onOpenChange }: ChallengeDialogProps) {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [isLoading, setIsLoading] = React.useState(true)
  const [challengeData, setChallengeData] = React.useState<ChallengeData | null>(null)
  const [isCopied, setIsCopied] = React.useState(false)

  // ---------------------------------------------------------------------------
  // Derived Values
  // ---------------------------------------------------------------------------

  // Generate the full share URL
  const shareUrl = challengeData
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/c/${challengeData.code}`
    : ""

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Fetch challenge data when dialog opens
  React.useEffect(() => {
    if (open) {
      fetchChallengeData()
    }
  }, [open])

  // Reset copied state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setIsCopied(false)
    }
  }, [open])

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const fetchChallengeData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/daily-spell/challenge")
      if (response.ok) {
        const data = (await response.json()) as ChallengeData
        setChallengeData(data)
      } else {
        console.error("[ChallengeDialog] Failed to fetch challenge data")
        showErrorToast("Failed to load challenge link")
      }
    } catch (error) {
      console.error("[ChallengeDialog] Error fetching challenge data:", error)
      showErrorToast("Failed to load challenge link")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setIsCopied(true)
      showSuccessToast("Link copied to clipboard!")

      // Reset copied state after 2 seconds
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      console.error("[ChallengeDialog] Copy failed:", error)
      showErrorToast("Failed to copy link")
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Send today's challenge to a friend
          </DialogTitle>
          <DialogDescription>
            Share your unique link and see if your friends can beat your score!
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex flex-col gap-4">
          {/* Share Link Section */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              Share your link
            </label>
            <div className="flex gap-2 items-end">
              <Input
                readOnly
                value={isLoading ? "Loading..." : shareUrl}
                className="h-9 flex-1"
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                className="shadow-xs"
                onClick={handleCopyLink}
                disabled={isLoading || !shareUrl}
                aria-label={isCopied ? "Copied" : "Copy link"}
              >
                {isCopied ? <CheckIcon /> : <CopyIcon />}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <Separator />

          {/* Invitees Section */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-foreground">
              Your invitees
            </label>
            <div className="flex items-center gap-2">
              <CircleUserIcon className="size-5 text-muted-foreground" />
              <span className="flex-1 text-sm text-foreground">
                Accepted invitations
              </span>
              <span className="text-sm font-medium text-foreground">
                {isLoading ? "—" : challengeData?.acceptedCount ?? 0}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
