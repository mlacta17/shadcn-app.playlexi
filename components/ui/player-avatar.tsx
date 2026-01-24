/**
 * Player Avatar Component
 *
 * Bridges PlayLexi's avatar system with the generic Shadcn Avatar.
 * Renders a user's selected avatar character (dog/person/cat) inside
 * the standard Avatar container.
 *
 * ## Architecture
 *
 * PlayLexi has two avatar display modes:
 *
 * 1. **Selection Mode** (`avatar-selector.tsx`)
 *    - Used during profile creation
 *    - Interactive with hover/selected states
 *    - Large preview + selection grid
 *
 * 2. **Display Mode** (this component)
 *    - Used everywhere else (navbar, leaderboard, game UI)
 *    - Non-interactive, display only
 *    - Consistent sizing via Shadcn Avatar
 *
 * ## Usage
 *
 * ```tsx
 * // By avatar ID (preferred for PlayLexi users)
 * <PlayerAvatar avatarId={2} size="lg" />
 *
 * // With image URL fallback (for external users or future features)
 * <PlayerAvatar avatarUrl="https://..." fallbackInitials="JD" />
 *
 * // Combined (shows avatar character, falls back to image, then initials)
 * <PlayerAvatar avatarId={1} avatarUrl="https://..." fallbackInitials="JD" />
 * ```
 *
 * ## Priority Order
 * 1. avatarId → Renders PlayLexi character SVG
 * 2. avatarUrl → Renders image via AvatarImage
 * 3. fallbackInitials → Renders text fallback
 *
 * @see lib/avatar-utils.ts for avatar configurations
 * @see lib/avatar-icons.tsx for shared SVG components
 * @see components/ui/avatar.tsx for base Avatar component
 * @see components/ui/avatar-selector.tsx for selection mode
 */

"use client"

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { getAvatarById } from "@/lib/avatar-utils"
import { AvatarIcon } from "@/lib/avatar-icons"
import { cn } from "@/lib/utils"

// =============================================================================
// PLAYER AVATAR COMPONENT
// =============================================================================

export interface PlayerAvatarProps {
  /** PlayLexi avatar ID (1=dog, 2=person, 3=cat) */
  avatarId?: number
  /** Fallback image URL (for users with custom photos) */
  avatarUrl?: string
  /** Initials to show when no avatar is available */
  fallbackInitials?: string
  /** Size variant matching Shadcn Avatar */
  size?: "sm" | "default" | "lg"
  /** Additional class names */
  className?: string
}

/**
 * Display a user's avatar in the PlayLexi system.
 *
 * Combines Shadcn Avatar with PlayLexi's character system.
 * Shows the character SVG on a colored background when avatarId is provided.
 */
function PlayerAvatar({
  avatarId,
  avatarUrl,
  fallbackInitials,
  size = "default",
  className,
}: PlayerAvatarProps) {
  // Look up avatar config if ID provided
  const avatarConfig = avatarId ? getAvatarById(avatarId) : undefined

  // If we have a PlayLexi avatar, render it with colored background
  if (avatarConfig) {
    return (
      <Avatar size={size} className={className}>
        {/* Colored background with character SVG */}
        <div
          className="flex size-full items-center justify-center rounded-full"
          style={{ backgroundColor: avatarConfig.activeBg }}
        >
          <AvatarIcon
            type={avatarConfig.type}
            className={cn(
              // Scale SVG to fit within avatar
              size === "sm" && "size-4",
              size === "default" && "size-5",
              size === "lg" && "size-7"
            )}
          />
        </div>
      </Avatar>
    )
  }

  // Fall back to image URL or initials
  return (
    <Avatar size={size} className={className}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt="User avatar" />}
      <AvatarFallback>
        {fallbackInitials || "?"}
      </AvatarFallback>
    </Avatar>
  )
}

export { PlayerAvatar }
