-- Migration: Add TTS Audio Columns
--
-- Adds columns to store pre-generated OpenAI TTS audio URLs for:
-- - Word introductions ("Your word is {word}")
-- - Example sentences
-- - Definitions
--
-- ## Why Pre-Generated TTS? (ADR-015)
--
-- 1. Cost efficiency - $41 one-time vs $75+/month for real-time TTS
-- 2. Zero latency - Audio served from R2 edge, no API calls during gameplay
-- 3. Consistent quality - Same voice for all users, no device variations
-- 4. Scalable - Works for 1 user or 1M users at same cost
--
-- ## Audio Types
--
-- | Column | Content | Example |
-- |--------|---------|---------|
-- | intro_audio_url | "Your word is {word}" | "Your word is castle" |
-- | sentence_audio_url | Example sentence | "The castle stood on the hill" |
-- | definition_audio_url | Word definition | "A large fortified building..." |
--
-- ## Voice Selection
--
-- OpenAI offers 6 voices: alloy, echo, fable, onyx, nova, shimmer
-- Default is "nova" - clear, friendly, good for educational content
--
-- ## Graceful Degradation
--
-- If TTS URLs are null (not yet generated), the app falls back to
-- browser Speech Synthesis API. This ensures no breaking changes.
--
-- @see ADR-015 (OpenAI TTS for Realistic Voice Output)
-- @see lib/tts/openai-tts.ts
-- @see scripts/generate-tts.ts

-- Step 1: Add intro_audio_url column
-- Stores R2 URL for "Your word is {word}" audio
ALTER TABLE `words` ADD COLUMN `intro_audio_url` TEXT;

--> statement-breakpoint

-- Step 2: Add sentence_audio_url column
-- Stores R2 URL for example sentence audio
ALTER TABLE `words` ADD COLUMN `sentence_audio_url` TEXT;

--> statement-breakpoint

-- Step 3: Add definition_audio_url column
-- Stores R2 URL for word definition audio
ALTER TABLE `words` ADD COLUMN `definition_audio_url` TEXT;

--> statement-breakpoint

-- Step 4: Add tts_generated_at column
-- Timestamp when TTS was generated (for cache invalidation)
ALTER TABLE `words` ADD COLUMN `tts_generated_at` INTEGER;

--> statement-breakpoint

-- Step 5: Add tts_voice column
-- Voice used for generation (default: nova)
-- Allows future voice changes without regenerating all audio
ALTER TABLE `words` ADD COLUMN `tts_voice` TEXT DEFAULT 'nova';
