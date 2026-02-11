/**
 * Share Result Dialog — PlayLexi
 *
 * Modal dialog for sharing Daily Spell game results as an image.
 * Allows users to download the result image or share to social media.
 *
 * ## Features
 *
 * - Displays a shareable result card image
 * - Download image to device
 * - Share to X (Twitter)
 * - Share to Facebook
 *
 * ## Image Generation
 *
 * The shareable image is generated based on the game result data.
 * For now, uses a placeholder - image generation can be implemented with:
 * - Server-side: Vercel OG / Satori
 * - Client-side: html2canvas / dom-to-image
 *
 * @see Figma node 2897:18080
 */

"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { DownloadIcon } from "@/lib/icons"
import { showSuccessToast, showErrorToast } from "@/lib/toast-utils"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// =============================================================================
// BRAND ICONS (X and Facebook)
// =============================================================================

/**
 * X (Twitter) brand icon
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4", className)}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/**
 * Facebook brand icon
 */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="#1877F2"
      className={cn("size-4", className)}
      aria-hidden="true"
    >
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

// =============================================================================
// TYPES
// =============================================================================

interface ShareResultDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Game result data for generating the share image */
  resultData?: {
    puzzleNumber: number
    score: number
    emojiRow: string
    percentile?: number | null
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Share Result Dialog
 *
 * Displays a shareable image of the game result with options to
 * download or share to social media platforms.
 */
export function ShareResultDialog({
  open,
  onOpenChange,
  resultData,
}: ShareResultDialogProps) {
  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  const imageRef = React.useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Derived Values
  // ---------------------------------------------------------------------------

  const shareText = resultData
    ? `Daily Spell #${resultData.puzzleNumber}\n${resultData.emojiRow}\nScore: ${resultData.score}/5\n\nPlay at playlexi.com`
    : "Check out my Daily Spell results on PlayLexi!"

  const shareUrl = typeof window !== "undefined" ? "https://playlexi.com" : ""

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDownload = async () => {
    // TODO: Implement actual image generation and download
    // Options:
    // 1. Use html2canvas to capture the preview div
    // 2. Fetch a pre-generated image from server
    // 3. Use canvas API to draw the result card

    try {
      showSuccessToast("Image download coming soon!")
      // Placeholder for actual implementation:
      // const canvas = await html2canvas(imageRef.current)
      // const link = document.createElement('a')
      // link.download = `daily-spell-${resultData?.puzzleNumber || 'result'}.png`
      // link.href = canvas.toDataURL()
      // link.click()
    } catch (error) {
      console.error("[ShareResultDialog] Download failed:", error)
      showErrorToast("Failed to download image")
    }
  }

  const handleShareTwitter = () => {
    const twitterUrl = new URL("https://twitter.com/intent/tweet")
    twitterUrl.searchParams.set("text", shareText)
    twitterUrl.searchParams.set("url", shareUrl)
    window.open(twitterUrl.toString(), "_blank", "noopener,noreferrer")
  }

  const handleShareFacebook = () => {
    const facebookUrl = new URL("https://www.facebook.com/sharer/sharer.php")
    facebookUrl.searchParams.set("u", shareUrl)
    facebookUrl.searchParams.set("quote", shareText)
    window.open(facebookUrl.toString(), "_blank", "noopener,noreferrer")
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] gap-4">
        {/* Header */}
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Share your result
          </DialogTitle>
          <DialogDescription>
            Download or share your Daily Spell result with friends!
          </DialogDescription>
        </DialogHeader>

        {/* Image Preview */}
        <div
          ref={imageRef}
          className="relative w-full aspect-[4/3] bg-muted rounded-lg overflow-hidden"
        >
          {/* Placeholder for the shareable result card */}
          {/* This will be replaced with actual generated image or designed component */}
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/10 to-secondary/10">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Daily Spell #{resultData?.puzzleNumber || "—"}
              </p>
              <p className="text-3xl tracking-wider">
                {resultData?.emojiRow || "✅✅✅✅✅"}
              </p>
              <p className="text-lg font-semibold text-foreground">
                Score: {resultData?.score ?? 0}/5
              </p>
              {resultData?.percentile && (
                <p className="text-sm text-muted-foreground">
                  Top {resultData.percentile}%
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                playlexi.com
              </p>
            </div>
          </div>
        </div>

        {/* Social Buttons */}
        <div className="flex flex-col gap-2">
          {/* Download Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 shadow-xs"
            onClick={handleDownload}
          >
            <DownloadIcon className="size-4" />
            Download image
          </Button>

          {/* Share on X (Twitter) */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 shadow-xs"
            onClick={handleShareTwitter}
          >
            <XIcon />
            Share on X (Twitter)
          </Button>

          {/* Share on Facebook */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 shadow-xs"
            onClick={handleShareFacebook}
          >
            <FacebookIcon />
            Share on Facebook
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
