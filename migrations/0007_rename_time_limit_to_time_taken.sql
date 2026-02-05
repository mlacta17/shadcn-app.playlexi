-- Migration: Rename time_limit to time_taken in game_rounds
--
-- The column was originally named `time_limit` but was actually storing
-- the time taken by the player to answer (timeTaken), not the maximum
-- allowed time for the round. This rename fixes the semantic mismatch.

-- SQLite doesn't support direct column rename in all versions, but D1 uses
-- a modern SQLite that supports ALTER TABLE RENAME COLUMN (3.25.0+)
ALTER TABLE game_rounds RENAME COLUMN time_limit TO time_taken;
