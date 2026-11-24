CREATE TABLE `creative_orbit_image` (
	`id` text PRIMARY KEY NOT NULL,
	`imageKey` text NOT NULL,
	`title` text,
	`alt` text NOT NULL,
	`displayOrder` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `creative_orbit_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`duration` integer DEFAULT 100 NOT NULL,
	`direction` text DEFAULT 'clockwise' NOT NULL
);
