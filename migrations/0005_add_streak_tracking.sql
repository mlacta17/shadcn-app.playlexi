-- Migration: Add Streak Tracking
--
-- Adds streak tracking for solo endless mode to enhance player engagement.
-- Streak = consecutive correct answers within a single game session.
--
-- ## Why Streak Matters (Game Design)
--
-- 1. Immediate feedback - Players see their momentum
-- 2. Skill indicator - Consistent accuracy > lucky accuracy
-- 3. Micro-goal - "Can I beat my streak?" within a game session
-- 4. Personal best tracking - "Best streak ever" across all games
--
-- ## Schema Changes
--
-- game_players.longest_streak:
--   - Stores the longest streak achieved in that specific game
--   - Calculated server-side from game_rounds on game completion
--   - Used for displaying current game stats on results page
--
-- user_ranks.best_streak:
--   - Stores the player's all-time best streak for each track
--   - Updated when longest_streak exceeds current best_streak
--   - Used for lifetime stats display
--
-- @see lib/services/game-service.ts finalizeGame()
-- @see app/(focused)/game/result/page.tsx

-- Step 1: Add longest_streak column to game_players
-- Records the longest streak achieved in this specific game session
ALTER TABLE `game_players` ADD COLUMN `longest_streak` INTEGER DEFAULT 0 NOT NULL;

--> statement-breakpoint

-- Step 2: Add best_streak column to user_ranks
-- Records the all-time best streak for this track (endless_voice, endless_keyboard, etc.)
ALTER TABLE `user_ranks` ADD COLUMN `best_streak` INTEGER DEFAULT 0 NOT NULL;
