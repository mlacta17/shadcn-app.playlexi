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
 * 1. avatarId → Renders PlayLexi character image
 * 2. avatarUrl → Renders image via AvatarImage
 * 3. fallbackInitials → Renders text fallback
 *
 * @see lib/avatar-utils.ts for avatar configurations
 * @see components/ui/avatar.tsx for base Avatar component
 * @see components/ui/avatar-selector.tsx for selection mode
 * @see Figma node 2753:35494 (Avatar states)
 */

"use client"

import Image from "next/image"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { getAvatarById, getAvatarSrc } from "@/lib/avatar-utils"

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
 * Shows the character image when avatarId is provided.
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

  // Determine pixel size based on variant
  const pixelSize = size === "sm" ? 32 : size === "lg" ? 48 : 40

  // If we have a PlayLexi avatar, render it with the character image
  if (avatarConfig) {
    const imageSrc = getAvatarSrc(avatarConfig, "active")

    return (
      <Avatar size={size} className={className}>
        <Image
          src={imageSrc}
          alt={`${avatarConfig.name} avatar`}
          width={pixelSize}
          height={pixelSize}
          className="size-full object-cover"
        />
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
