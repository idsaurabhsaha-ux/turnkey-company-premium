CREATE TABLE `lead_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lead_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`payload_hash` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_receipts_key_hash_unique` ON `lead_receipts` (`key_hash`);