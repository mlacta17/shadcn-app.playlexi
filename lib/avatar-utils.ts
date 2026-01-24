/**
 * Avatar Utilities
 *
 * Configuration for the three avatar types used in profile selection.
 * Each avatar has a unique background color that changes based on state.
 *
 * ## States
 * - Default: Gray background (#d7d7d7)
 * - Hover: Unique color per avatar type
 * - Selected: Unique color + blue ring
 *
 * ## Future: Rive Animation
 * The large avatar preview should eventually use Rive animation.
 * For now, we use static SVG placeholders.
 */

// =============================================================================
// TYPES
// =============================================================================

export type AvatarType = "dog" | "person" | "cat"

export interface AvatarConfig {
  id: number
  type: AvatarType
  name: string
  /** Background color when in default/inactive state */
  defaultBg: string
  /** Background color when hovered or selected */
  activeBg: string
}

// =============================================================================
// AVATAR CONFIGURATIONS
// =============================================================================

/**
 * Avatar configurations with their unique colors.
 *
 * Colors derived from Figma design:
 * - Dog: #7dff66 (lime green)
 * - Person: #ff6a8d (pink/coral)
 * - Cat: #ff6a8d (pink) - same as person in this design
 */
export const AVATARS: AvatarConfig[] = [
  {
    id: 1,
    type: "dog",
    name: "Dog",
    defaultBg: "#d7d7d7",
    activeBg: "#7dff66",
  },
  {
    id: 2,
    type: "person",
    name: "Person",
    defaultBg: "#d7d7d7",
    activeBg: "#ff6a8d",
  },
  {
    id: 3,
    type: "cat",
    name: "Cat",
    defaultBg: "#d7d7d7",
    activeBg: "#ff6a8d",
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
