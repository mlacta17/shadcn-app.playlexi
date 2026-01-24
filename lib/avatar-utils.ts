/**
 * Avatar Utilities
 *
 * Configuration for the three avatar types used in profile selection.
 * Each avatar has different SVG files for default (gray) and active (colored) states.
 *
 * ## States
 * - Default: Gray background - used when not hovered or selected
 * - Active: Colored background - used when hovered or selected
 * - Selected: Active state + blue focus ring
 *
 * ## SVG Files
 * Located in /public/avatars/ with naming convention:
 * - {type}-default.svg — Gray state
 * - {type}-active.svg — Colored state (hover/selected)
 *
 * ## Future: Rive Animation
 * The large avatar preview should eventually use Rive animation.
 * For now, we use static SVG images.
 *
 * @see Figma node 2753:35494 (Avatar component states)
 * @see Figma node 2763:36175 (Avatar selection page)
 */

// =============================================================================
// TYPES
// =============================================================================

export type AvatarType = "dog" | "person" | "cat"

export interface AvatarConfig {
  id: number
  type: AvatarType
  name: string
  /** Path to default state SVG (gray background) */
  defaultSrc: string
  /** Path to active state SVG (colored background - hover/selected) */
  activeSrc: string
}

// =============================================================================
// AVATAR CONFIGURATIONS
// =============================================================================

/**
 * Avatar configurations with their SVG paths.
 *
 * SVG files sourced from Figma design:
 * - Dog: Gray seal-like creature, green when active
 * - Person: Human with black hair, yellow when active
 * - Cat: Yellow cat, pink when active
 */
export const AVATARS: AvatarConfig[] = [
  {
    id: 1,
    type: "dog",
    name: "Dog",
    defaultSrc: "/avatars/dog-default.svg",
    activeSrc: "/avatars/dog-active.svg",
  },
  {
    id: 2,
    type: "person",
    name: "Person",
    defaultSrc: "/avatars/person-default.svg",
    activeSrc: "/avatars/person-active.svg",
  },
  {
    id: 3,
    type: "cat",
    name: "Cat",
    defaultSrc: "/avatars/cat-default.svg",
    activeSrc: "/avatars/cat-active.svg",
  },
]

/**
 * Get avatar config by ID.
 */
export function getAvatarById(id: number): AvatarConfig | undefined {
  return AVATARS.find((a) => a.id === id)
}

/**
 * Get avatar config by type.
 */
export function getAvatarByType(type: AvatarType): AvatarConfig | undefined {
  return AVATARS.find((a) => a.type === type)
}

/**
 * Get the appropriate SVG source for an avatar based on its state.
 */
export function getAvatarSrc(
  avatar: AvatarConfig,
  state: "default" | "active"
): string {
  return state === "active" ? avatar.activeSrc : avatar.defaultSrc
}
