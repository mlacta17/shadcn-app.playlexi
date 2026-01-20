-- Better Auth Tables
-- These tables are required by Better Auth for authentication
-- See: https://www.better-auth.com/docs/concepts/database

-- Auth User: Core identity from OAuth providers
CREATE TABLE `auth_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_user_email_unique` ON `auth_user` (`email`);
--> statement-breakpoint
CREATE INDEX `idx_auth_user_email` ON `auth_user` (`email`);

--> statement-breakpoint

-- Auth Session: Active login sessions
CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_session_token_unique` ON `auth_session` (`token`);
--> statement-breakpoint
CREATE INDEX `idx_auth_session_user_id` ON `auth_session` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_auth_session_token` ON `auth_session` (`token`);

--> statement-breakpoint

-- Auth Account: OAuth provider connections (Google, etc.)
CREATE TABLE `auth_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`id_token` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_auth_account_user_id` ON `auth_account` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_auth_account_provider` ON `auth_account` (`provider_id`, `account_id`);

--> statement-breakpoint

-- Auth Verification: Email/phone verification tokens
CREATE TABLE `auth_verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_auth_verification_identifier` ON `auth_verification` (`identifier`);
