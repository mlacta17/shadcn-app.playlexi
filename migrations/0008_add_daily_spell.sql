-- Migration: Add Daily Spell tables
--
-- Daily Spell is a daily word game (like Wordle) where all players
-- get the same 5 words each day. This migration adds:
--
-- 1. daily_spell_puzzles - One puzzle per day with 5 words
-- 2. daily_spell_results - Player attempts and scores
-- 3. daily_spell_streaks - Consecutive day streaks per user
-- 4. challenge_links - Referral links for viral sharing
-- 5. challenge_referrals - Tracks click → play → signup funnel
--
-- @see Daily Spell feature spec
-- @see db/schema.ts for Drizzle definitions

-- =============================================================================
-- DAILY SPELL PUZZLES
-- =============================================================================
-- One puzzle per day with exactly 5 words in fixed order.
-- Difficulty progression: Easy → Medium → Hard → Hard → Hardest

CREATE TABLE IF NOT EXISTS daily_spell_puzzles (
  id TEXT PRIMARY KEY NOT NULL,
  puzzle_date TEXT NOT NULL UNIQUE,
  word_ids TEXT NOT NULL,
  puzzle_number INTEGER NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for fast lookup by date (the primary access pattern)
CREATE INDEX IF NOT EXISTS idx_daily_spell_puzzles_date
  ON daily_spell_puzzles(puzzle_date);

-- =============================================================================
-- DAILY SPELL RESULTS
-- =============================================================================
-- Player attempts. Each user can only have one attempt per puzzle.

CREATE TABLE IF NOT EXISTS daily_spell_results (
  id TEXT PRIMARY KEY NOT NULL,
  puzzle_id TEXT NOT NULL REFERENCES daily_spell_puzzles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  is_authenticated INTEGER NOT NULL DEFAULT 0,
  score INTEGER NOT NULL,
  word_results TEXT NOT NULL,
  emoji_row TEXT NOT NULL,
  percentile INTEGER,
  completed_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Ensure one attempt per user per puzzle
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_spell_results_puzzle_user
  ON daily_spell_results(puzzle_id, user_id);

-- For fetching a user's result for a puzzle
CREATE INDEX IF NOT EXISTS idx_daily_spell_results_puzzle
  ON daily_spell_results(puzzle_id);

CREATE INDEX IF NOT EXISTS idx_daily_spell_results_user
  ON daily_spell_results(user_id);

-- For percentile calculation (count scores less than X)
CREATE INDEX IF NOT EXISTS idx_daily_spell_results_puzzle_score
  ON daily_spell_results(puzzle_id, score);

-- =============================================================================
-- DAILY SPELL STREAKS
-- =============================================================================
-- Tracks consecutive day streaks. One row per user.

CREATE TABLE IF NOT EXISTS daily_spell_streaks (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_played_date TEXT,
  total_games_played INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_daily_spell_streaks_user
  ON daily_spell_streaks(user_id);

-- =============================================================================
-- CHALLENGE LINKS
-- =============================================================================
-- Referral links for "Challenge a Friend" feature.
-- Each authenticated user has one reusable link.

CREATE TABLE IF NOT EXISTS challenge_links (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_challenge_links_code
  ON challenge_links(code);

-- =============================================================================
-- CHALLENGE REFERRALS
-- =============================================================================
-- Tracks the funnel: link click → daily played → user signed up

CREATE TABLE IF NOT EXISTS challenge_referrals (
  id TEXT PRIMARY KEY NOT NULL,
  link_id TEXT NOT NULL REFERENCES challenge_links(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  clicked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  played_at INTEGER,
  signed_up_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_challenge_referrals_link
  ON challenge_referrals(link_id);

CREATE INDEX IF NOT EXISTS idx_challenge_referrals_visitor
  ON challenge_referrals(visitor_id);

-- For counting "accepted invitations" (visitors who actually played)
CREATE INDEX IF NOT EXISTS idx_challenge_referrals_link_played
  ON challenge_referrals(link_id, played_at);
