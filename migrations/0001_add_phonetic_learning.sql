-- Migration: Add Phonetic Learning Tables
-- Phase 4: Adaptive Phonetic Learning System
--
-- This migration adds tables for:
-- 1. recognition_logs - Logs every voice recognition event for learning
-- 2. user_phonetic_mappings - Learned phonetic mappings per user

-- =============================================================================
-- Recognition Logs Table
-- =============================================================================
-- Stores voice recognition events for pattern detection.
-- Note: user_id does NOT have a foreign key constraint because:
-- - Logs can use anonymous device IDs before auth is integrated
-- - Logs are ephemeral (30-day retention policy)
-- - The learning engine only creates mappings for authenticated users

CREATE TABLE IF NOT EXISTS `recognition_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`word_to_spell` text NOT NULL,
	`google_transcript` text NOT NULL,
	`extracted_letters` text NOT NULL,
	`was_correct` integer NOT NULL,
	`rejection_reason` text,
	`input_method` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_recognition_logs_user_id` ON `recognition_logs` (`user_id`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_recognition_logs_user_created` ON `recognition_logs` (`user_id`,`created_at`);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_recognition_logs_created_at` ON `recognition_logs` (`created_at`);

-- =============================================================================
-- User Phonetic Mappings Table
-- =============================================================================
-- Stores learned phonetic mappings per user.
-- HAS foreign key to users table - mappings are only for authenticated users.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_phonetic_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`heard` text NOT NULL,
	`intended` text NOT NULL,
	`source` text DEFAULT 'auto_learned' NOT NULL,
	`confidence` real DEFAULT 1 NOT NULL,
	`occurrence_count` integer DEFAULT 1 NOT NULL,
	`times_applied` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_phonetic_mappings_user_id` ON `user_phonetic_mappings` (`user_id`);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_phonetic_mappings_user_id_heard_unique` ON `user_phonetic_mappings` (`user_id`,`heard`);
