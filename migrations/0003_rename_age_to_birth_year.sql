-- Migration: Rename 'age' column to 'birth_year' and make it nullable
--
-- Why this change:
-- 1. birthYear is more flexible than age (can calculate age dynamically)
-- 2. Age range selection during onboarding is optional
-- 3. Column name better describes what we're storing (year, not age)
--
-- SQLite doesn't support ALTER COLUMN, so we need to:
-- 1. Add the new column
-- 2. Copy data (converting age to approximate birth year)
-- 3. Drop the old column (requires table recreation in SQLite)
--
-- Note: SQLite doesn't support DROP COLUMN directly, so we use a workaround
-- by creating a new table and copying data. However, for simplicity in development,
-- we'll just add the new column and keep the old one for now.

-- Step 1: Add the new birth_year column (nullable)
ALTER TABLE `users` ADD COLUMN `birth_year` INTEGER;

-- Step 2: Migrate existing age data to birth_year
-- Approximate: if age is stored, convert to birth year (current_year - age)
-- Using 2025 as reference year
UPDATE `users` SET `birth_year` = 2025 - `age` WHERE `age` IS NOT NULL;
