CREATE TABLE `admin_auth` (
	`id` integer PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`owner_id` text,
	`updated_at` integer NOT NULL,
	CONSTRAINT "auth_singleton" CHECK("admin_auth"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `content` (
	`id` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`data` text NOT NULL,
	CONSTRAINT "content_singleton" CHECK("content"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `icons` (
	`member_id` text PRIMARY KEY NOT NULL,
	`mime` text NOT NULL,
	`bytes` blob NOT NULL
);
--> statement-breakpoint
CREATE TABLE `login_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_limits_expiry` ON `login_limits` (`reset_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`auth_fingerprint` text
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);