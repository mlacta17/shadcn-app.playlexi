/**
 * Game Components
 *
 * Domain-specific components for PlayLexi game functionality.
 * These components are located in `components/game/` rather than `components/ui/`
 * because they contain game-specific logic or styling.
 *
 * Pattern: Components here can be "smart" (use hooks) or "presentational" (no hooks).
 * See COMPONENT_INVENTORY.md Architecture Decisions for details.
 *
 * @example
 * ```tsx
 * import { HeartsDisplay } from "@/components/game"
 *
 * <HeartsDisplay remaining={2} />
 * ```
 */

export { HeartsDisplay } from "./hearts-display"
export type { HeartsDisplayProps } from "./hearts-display"
