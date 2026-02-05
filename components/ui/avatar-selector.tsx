/**
 * Avatar Selector Component
 *
 * Used in profile creation for selecting a user avatar.
 * Supports three avatar types (Dog, Person, Cat) with state-based styling.
 *
 * ## States
 * - Default: Gray avatar (not hovered, not selected)
 * - Hover: Colored avatar
 * - Selected: Colored avatar + blue ring
 *
 * ## Architecture
 * Uses image-based SVGs from /public/avatars/ rather than inline SVG components.
 * This matches the Figma design where each state has a different baked-in SVG.
 *
 * ## Future: Rive Animation
 * The large preview should use Rive animation in the future.
 * Currently uses static SVG images.
 *
 * @see lib/avatar-utils.ts for avatar configurations
 * @see Figma node 2753:35494 (Avatar states)
 * @see Figma node 2763:36175 (Avatar selection page)
 */

"use client"

import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { type AvatarConfig, getAvatarSrc } from "@/lib/avatar-utils"

// =============================================================================
// AVATAR OPTION (SMALL SELECTABLE)
// =============================================================================

interface AvatarOptionProps {
  avatar: AvatarConfig
  isSelected: boolean
  onSelect: (id: number) => void
  /** Size in pixels. Defaults to 62 (profile creation). Settings dialog uses 48. */
  size?: number
}

/**
 * Small avatar option for selection grid.
 * Shows hover and selected states.
 *
 * Default size: 62px (profile creation per Figma)
 * Settings dialog: 48px (per Figma node 2582:6142)
 */
function AvatarOption({ avatar, isSelected, onSelect, size = 62 }: AvatarOptionProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  // Use active (colored) image when hovered or selected
  const isActive = isHovered || isSelected
  const imageSrc = getAvatarSrc(avatar, isActive ? "active" : "default")

  return (
    <button
      type="button"
      onClick={() => onSelect(avatar.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ width: size, height: size }}
      className={cn(
        "relative rounded-full overflow-hidden transition-shadow duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isSelected && "shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#3b82f6]"
      )}
      aria-label={`Select ${avatar.name} avatar`}
      aria-pressed={isSelected}
    >
      <Image
        src={imageSrc}
        alt={`${avatar.name} avatar`}
        width={size}
        height={size}
        className="size-full object-cover"
        priority
      />
    </button>
  )
}

// =============================================================================
// AVATAR PREVIEW (LARGE)
// =============================================================================

interface AvatarPreviewProps {
  avatar: AvatarConfig
  /** Size in pixels. Defaults to 204 (desktop). */
  size?: number
  className?: string
}

/**
 * Large avatar preview.
 * Shows the selected avatar at full size with active (colored) styling.
 *
 * Default size: 204px (desktop), can be overridden.
 * Mobile typically uses 180px.
 *
 * TODO: Replace with Rive animation in the future.
 */
function AvatarPreview({ avatar, size = 204, className }: AvatarPreviewProps) {
  // Always show active (colored) state in preview
  const imageSrc = getAvatarSrc(avatar, "active")

  return (
    <div
      className={cn("rounded-full overflow-hidden", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={imageSrc}
        alt={`${avatar.name} avatar preview`}
        width={size}
        height={size}
        className="size-full object-cover"
        priority
      />
    </div>
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export { AvatarOption, AvatarPreview }
