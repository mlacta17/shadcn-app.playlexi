/**
 * Avatar Icon Components
 *
 * SVG icons for PlayLexi's three avatar characters.
 * These are static placeholders that will eventually be replaced with Rive animations.
 *
 * ## Usage
 *
 * ```tsx
 * import { DogIcon, PersonIcon, CatIcon, AvatarIcon } from "@/lib/avatar-icons"
 *
 * // Direct usage
 * <DogIcon className="size-8" />
 *
 * // Dynamic by type
 * <AvatarIcon type="cat" className="size-8" />
 * ```
 *
 * ## Future: Rive Animation
 * These SVG icons are placeholders. The plan is to replace them with Rive
 * animations for a more engaging user experience. When that happens:
 * 1. Create a RiveAvatar component
 * 2. Update AvatarIcon to conditionally render Rive or SVG
 * 3. Keep SVGs as static fallbacks
 *
 * @see lib/avatar-utils.ts for avatar configurations
 */

import { type AvatarType } from "@/lib/avatar-utils"

// =============================================================================
// DOG AVATAR
// =============================================================================

/**
 * Dog character avatar.
 * Gray dog with floppy ears.
 */
function DogIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ears */}
      <ellipse cx="14" cy="20" rx="10" ry="14" fill="#a3a3a3" />
      <ellipse cx="50" cy="20" rx="10" ry="14" fill="#a3a3a3" />
      {/* Face */}
      <circle cx="32" cy="36" r="22" fill="#d4d4d4" />
      {/* Eyes */}
      <circle cx="24" cy="32" r="3" fill="#171717" />
      <circle cx="40" cy="32" r="3" fill="#171717" />
      {/* Nose */}
      <ellipse cx="32" cy="42" rx="4" ry="3" fill="#171717" />
      {/* Mouth */}
      <path
        d="M28 46 Q32 50 36 46"
        stroke="#171717"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

// =============================================================================
// PERSON AVATAR
// =============================================================================

/**
 * Person character avatar.
 * Cartoon person with dark hair and rosy cheeks.
 */
function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Hair */}
      <ellipse cx="32" cy="22" rx="20" ry="14" fill="#171717" />
      {/* Face */}
      <circle cx="32" cy="36" r="18" fill="#ffdc93" />
      {/* Eyes */}
      <circle cx="26" cy="34" r="2.5" fill="#171717" />
      <circle cx="38" cy="34" r="2.5" fill="#171717" />
      {/* Smile */}
      <path
        d="M26 42 Q32 46 38 42"
        stroke="#171717"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Cheeks */}
      <circle cx="22" cy="40" r="3" fill="#ffb3b3" opacity="0.5" />
      <circle cx="42" cy="40" r="3" fill="#ffb3b3" opacity="0.5" />
    </svg>
  )
}

// =============================================================================
// CAT AVATAR
// =============================================================================

/**
 * Cat character avatar.
 * Yellow cat with pointed ears and whiskers.
 */
function CatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ears */}
      <polygon points="12,8 20,28 4,28" fill="#ffdc45" />
      <polygon points="52,8 60,28 44,28" fill="#ffdc45" />
      {/* Inner ears */}
      <polygon points="12,14 17,26 7,26" fill="#ffb3b3" />
      <polygon points="52,14 57,26 47,26" fill="#ffb3b3" />
      {/* Face */}
      <circle cx="32" cy="38" r="22" fill="#ffdc45" />
      {/* Eyes */}
      <ellipse cx="24" cy="36" rx="3" ry="4" fill="#171717" />
      <ellipse cx="40" cy="36" rx="3" ry="4" fill="#171717" />
      {/* Nose */}
      <polygon points="32,42 29,46 35,46" fill="#171717" />
      {/* Whiskers */}
      <line x1="10" y1="42" x2="22" y2="44" stroke="#171717" strokeWidth="1.5" />
      <line x1="10" y1="48" x2="22" y2="46" stroke="#171717" strokeWidth="1.5" />
      <line x1="54" y1="42" x2="42" y2="44" stroke="#171717" strokeWidth="1.5" />
      <line x1="54" y1="48" x2="42" y2="46" stroke="#171717" strokeWidth="1.5" />
    </svg>
  )
}

// =============================================================================
// DYNAMIC AVATAR ICON
// =============================================================================

interface AvatarIconProps {
  /** Avatar type to render */
  type: AvatarType
  /** CSS class name for sizing */
  className?: string
}

/**
 * Render avatar icon dynamically by type.
 *
 * Use this when the avatar type is determined at runtime.
 * For static usage, import the specific icon directly.
 */
function AvatarIcon({ type, className }: AvatarIconProps) {
  switch (type) {
    case "dog":
      return <DogIcon className={className} />
    case "person":
      return <PersonIcon className={className} />
    case "cat":
      return <CatIcon className={className} />
  }
}

export { DogIcon, PersonIcon, CatIcon, AvatarIcon }
