/**
 * Avatar Selector Component
 *
 * Used in profile creation for selecting a user avatar.
 * Supports three avatar types (Dog, Person, Cat) with state-based styling.
 *
 * ## States
 * - Default: Gray background
 * - Hover: Colored background (unique per avatar type)
 * - Selected: Colored background + blue ring
 *
 * ## Future: Rive Animation
 * The large preview should use Rive animation in the future.
 * Currently uses static SVG placeholders.
 *
 * @see lib/avatar-utils.ts for avatar configurations
 * @see lib/avatar-icons.tsx for shared SVG components
 */

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { type AvatarConfig } from "@/lib/avatar-utils"
import { AvatarIcon } from "@/lib/avatar-icons"

// =============================================================================
// AVATAR OPTION (SMALL SELECTABLE)
// =============================================================================

interface AvatarOptionProps {
  avatar: AvatarConfig
  isSelected: boolean
  onSelect: (id: number) => void
}

/**
 * Small avatar option for selection grid.
 * Shows hover and selected states.
 */
function AvatarOption({ avatar, isSelected, onSelect }: AvatarOptionProps) {
  const [isHovered, setIsHovered] = React.useState(false)

  // Use active color when hovered or selected
  const bgColor = isHovered || isSelected ? avatar.activeBg : avatar.defaultBg

  return (
    <button
      type="button"
      onClick={() => onSelect(avatar.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative size-[62px] rounded-full transition-all duration-200",
        "flex items-center justify-center",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isSelected && "shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#3b82f6]"
      )}
      style={{ backgroundColor: bgColor }}
      aria-label={`Select ${avatar.name} avatar`}
      aria-pressed={isSelected}
    >
      <AvatarIcon type={avatar.type} className="size-10" />
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
 * Shows the selected avatar at full size.
 *
 * TODO: Replace with Rive animation in the future.
 */
function AvatarPreview({ avatar, size = 204, className }: AvatarPreviewProps) {
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: avatar.activeBg,
      }}
    >
      <AvatarIcon
        type={avatar.type}
        className="w-3/4 h-3/4"
      />
    </div>
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export { AvatarOption, AvatarPreview }
