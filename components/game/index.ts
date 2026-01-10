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
 * import { HeartsDisplay, GameTimer, GameFeedbackOverlay, RankBadge } from "@/components/game"
 *
 * <HeartsDisplay remaining={2} />
 * <GameTimer totalSeconds={15} remainingSeconds={10} />
 * <GameFeedbackOverlay type="correct" isVisible={true} />
 * <RankBadge rank="honey-bee" size="md" />
 * ```
 */

export { HeartsDisplay } from "./hearts-display"
export type { HeartsDisplayProps } from "./hearts-display"

export { GameTimer, CRITICAL_THRESHOLD_SECONDS } from "./game-timer"
export type { GameTimerProps, GameTimerState } from "./game-timer"

export { GameFeedbackOverlay } from "./game-feedback-overlay"
export type { GameFeedbackOverlayProps, FeedbackOverlayType } from "./game-feedback-overlay"

export { RankBadge, RANK_LABELS, BADGE_PATHS, BADGE_SIZES } from "./rank-badge"
export type { RankBadgeProps, RankTier, BadgeSize } from "./rank-badge"

export { LeaderboardTable } from "./leaderboard-table"
export type { LeaderboardTableProps } from "./leaderboard-table"

export {
  leaderboardColumns,
  PlayerCell,
  RoundCell,
} from "./leaderboard-columns"
export type { LeaderboardPlayer } from "./leaderboard-columns"
