CREATE TABLE `poketra_documents` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`object_key` text,
	`last_mutation` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `poketra_files` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`object_key` text NOT NULL,
	`digest` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`operation_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `poketra_requests` (
	`owner_id` text NOT NULL,
	`mutation_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`revision` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `mutation_id`)
);
--> statement-breakpoint
CREATE TABLE `poketra_snapshots` (
	`owner_id` text NOT NULL,
	`revision` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `revision`)
);
