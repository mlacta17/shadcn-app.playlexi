/**
 * Game Mode Configuration — PlayLexi
 *
 * Single source of truth for all game mode metadata used on the dashboard.
 * Each mode defines its card appearance (color, illustration, copy) and
 * navigation target.
 *
 * ## Adding a New Game Mode
 * 1. Add the illustration PNG to `/public/illustrations/game-cards/`
 * 2. Add a new entry to the GAME_MODES array below
 * 3. The dashboard carousel will pick it up automatically
 *
 * @see components/game/game-mode-card.tsx for the card component
 * @see app/(shell)/page.tsx for the dashboard page
 */

// =============================================================================
// TYPES
// =============================================================================

export interface GameModeConfig {
  /** Unique identifier for this mode */
  id: string
  /** Display title shown on the card */
  title: string
  /** Description text shown below the title */
  description: string
  /** Path to the illustration PNG in /public */
  illustration: string
  /** Accent color for the card background (hex) */
  accentColor: string
  /** Route to navigate to when card is tapped (omit if not playable) */
  href?: string
  /** Optional badge text (e.g., "Coming soon") */
  badge?: string
  /** Whether this mode requires authentication to play */
  requiresAuth?: boolean
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const GAME_MODES: GameModeConfig[] = [
  {
    id: "daily",
    title: "Daily game",
    description:
      "This is the same 5 words for everyone. You only have one attempt per day, and you can only play using your voice.",
    illustration: "/illustrations/game-cards/daily.png",
    accentColor: "#AD85D1",
    href: "/game/daily",
  },
  {
    id: "endless",
    title: "Endless",
    description:
      "Play solo and see how long you can survive. The further you go, the harder it gets! Can you climb to the top of the leaderboard?",
    illustration: "/illustrations/game-cards/endless.png",
    accentColor: "#FF7301",
    href: "/game/endless",
    requiresAuth: true,
  },
  {
    id: "blitz",
    title: "Blitz",
    description:
      "Beat the clock by spelling as many words as you can before time runs out! Every second counts here!",
    illustration: "/illustrations/game-cards/blitz.png",
    accentColor: "#FFA1CC",
    badge: "Coming soon",
  },
  {
    id: "multiplayer",
    title: "Multiplayer",
    description:
      "Go head-to-head with a friend in a fast-paced spelling showdown. Who can stay sharp and keep their cool?",
    illustration: "/illustrations/game-cards/multiplayer.png",
    accentColor: "#00A653",
    badge: "Coming soon",
  },
  {
    id: "phonetic-calibration",
    title: "Phonetic Calibration",
    description:
      "Want to make the game more accurate for you? Try calibrating the game to the way that you say letters!",
    illustration: "/illustrations/game-cards/endless.png",
    accentColor: "#0052D6",
  },
]
