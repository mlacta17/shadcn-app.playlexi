-- Add tutorial completion tracking to users table.
-- Safe in SQLite: ALTER TABLE ADD COLUMN with DEFAULT works.
ALTER TABLE users ADD COLUMN has_completed_tutorial integer NOT NULL DEFAULT 0;
