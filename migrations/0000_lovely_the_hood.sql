CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_blocks_blocker_id` ON `blocks` (`blocker_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `blocks_blocker_id_blocked_id_unique` ON `blocks` (`blocker_id`,`blocked_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`message_type` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_sender_receiver` ON `chat_messages` (`sender_id`,`receiver_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_receiver_read` ON `chat_messages` (`receiver_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `friend_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_friend_requests_receiver_status` ON `friend_requests` (`receiver_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `friend_requests_sender_id_receiver_id_unique` ON `friend_requests` (`sender_id`,`receiver_id`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`friend_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friend_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_friendships_user_id` ON `friendships` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_friendships_friend_id` ON `friendships` (`friend_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_user_id_friend_id_unique` ON `friendships` (`user_id`,`friend_id`);--> statement-breakpoint
CREATE TABLE `game_players` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`user_id` text NOT NULL,
	`hearts` integer DEFAULT 3 NOT NULL,
	`is_eliminated` integer DEFAULT false NOT NULL,
	`placement` integer,
	`rounds_completed` integer DEFAULT 0 NOT NULL,
	`correct_answers` integer DEFAULT 0 NOT NULL,
	`wrong_answers` integer DEFAULT 0 NOT NULL,
	`xp_earned` integer,
	`joined_at` integer DEFAULT (unixepoch()) NOT NULL,
	`eliminated_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_game_players_game_id` ON `game_players` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_game_players_user_id` ON `game_players` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_game_id_user_id_unique` ON `game_players` (`game_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `game_rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`word_id` text NOT NULL,
	`active_player_id` text,
	`started_at` integer,
	`ended_at` integer,
	`time_limit` integer NOT NULL,
	`answer` text,
	`is_correct` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_game_rounds_game_id` ON `game_rounds` (`game_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `game_rounds_game_id_round_number_unique` ON `game_rounds` (`game_id`,`round_number`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`room_code` text,
	`mode` text NOT NULL,
	`input_method` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`host_id` text,
	`max_players` integer DEFAULT 6 NOT NULL,
	`min_players` integer DEFAULT 4 NOT NULL,
	`average_rank` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`started_at` integer,
	`ended_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_room_code_unique` ON `games` (`room_code`);--> statement-breakpoint
CREATE INDEX `idx_games_status_type` ON `games` (`status`,`type`);--> statement-breakpoint
CREATE INDEX `idx_games_room_code` ON `games` (`room_code`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_read` ON `notifications` (`user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`reported_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reported_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reports_status` ON `reports` (`status`);--> statement-breakpoint
CREATE TABLE `user_ranks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`track` text NOT NULL,
	`tier` text DEFAULT 'new_bee' NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`crown_points` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_user_ranks_track_xp` ON `user_ranks` (`track`,`xp`);--> statement-breakpoint
CREATE INDEX `idx_user_ranks_track_crown_points` ON `user_ranks` (`track`,`crown_points`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_ranks_user_id_track_unique` ON `user_ranks` (`user_id`,`track`);--> statement-breakpoint
CREATE TABLE `user_skill_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`track` text NOT NULL,
	`rating` real DEFAULT 1500 NOT NULL,
	`rating_deviation` real DEFAULT 350 NOT NULL,
	`volatility` real DEFAULT 0.06 NOT NULL,
	`derived_tier` integer DEFAULT 4 NOT NULL,
	`games_played` integer DEFAULT 0 NOT NULL,
	`last_played_at` integer,
	`season_highest_rating` real DEFAULT 1500,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_skill_ratings_track_rating` ON `user_skill_ratings` (`track`,`rating`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_skill_ratings_user_id_track_unique` ON `user_skill_ratings` (`user_id`,`track`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`bio` text,
	`avatar_id` integer DEFAULT 1 NOT NULL,
	`age` integer NOT NULL,
	`auth_provider` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_online` integer DEFAULT (unixepoch()) NOT NULL,
	`theme` text DEFAULT 'light' NOT NULL,
	`email_social` integer DEFAULT true NOT NULL,
	`email_security` integer DEFAULT true NOT NULL,
	`email_marketing` integer DEFAULT false NOT NULL,
	`deletion_requested_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_username` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `words` (
	`id` text PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`difficulty_tier` integer NOT NULL,
	`definition` text NOT NULL,
	`example_sentence` text NOT NULL,
	`audio_url` text NOT NULL,
	`part_of_speech` text NOT NULL,
	`syllables` integer,
	`etymology` text,
	`times_served` integer DEFAULT 0 NOT NULL,
	`correct_rate` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `words_word_unique` ON `words` (`word`);--> statement-breakpoint
CREATE INDEX `idx_words_difficulty_tier` ON `words` (`difficulty_tier`);--> statement-breakpoint
CREATE INDEX `idx_words_word` ON `words` (`word`);