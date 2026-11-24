CREATE TABLE `inquiry` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`fingerprint` text NOT NULL,
	`type` text NOT NULL,
	`country` text NOT NULL,
	`phone` text,
	`title` text,
	`objectives` text,
	`situation` text,
	`categories` text NOT NULL,
	`budget` real,
	`currency` text,
	`timeline` text,
	`website` text,
	`consultation` text,
	`sessionId` text,
	`stage` text DEFAULT 'new' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`assigneeId` text,
	`followUpAt` integer,
	`convertedClientId` text,
	`convertedProjectId` text,
	`convertedAt` integer,
	`lostReason` text,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigneeId`) REFERENCES `team_member`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`convertedClientId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`convertedProjectId`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inquiry_reference_unique` ON `inquiry` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `inquiry_fingerprint_unique` ON `inquiry` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `inquiry_stage_followup_idx` ON `inquiry` (`stage`,`followUpAt`);--> statement-breakpoint
CREATE INDEX `inquiry_session_idx` ON `inquiry` (`sessionId`);--> statement-breakpoint
CREATE TABLE `inquiry_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`inquiryId` text NOT NULL,
	`kind` text NOT NULL,
	`previousStage` text,
	`newStage` text,
	`description` text NOT NULL,
	`adminId` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`inquiryId`) REFERENCES `inquiry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adminId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inquiry_activity_lead_idx` ON `inquiry_activity` (`inquiryId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `inquiry_event` (
	`id` text PRIMARY KEY NOT NULL,
	`sessionId` text NOT NULL,
	`event` text NOT NULL,
	`type` text,
	`step` integer,
	`inquiryId` text,
	`referral` text,
	`campaign` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`inquiryId`) REFERENCES `inquiry`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inquiry_event_date_idx` ON `inquiry_event` (`event`,`createdAt`);--> statement-breakpoint
CREATE INDEX `inquiry_event_session_idx` ON `inquiry_event` (`sessionId`);--> statement-breakpoint
CREATE TABLE `inquiry_note` (
	`id` text PRIMARY KEY NOT NULL,
	`inquiryId` text NOT NULL,
	`adminId` text,
	`content` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`inquiryId`) REFERENCES `inquiry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`adminId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inquiry_note_lead_idx` ON `inquiry_note` (`inquiryId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `inquiry_service` (
	`id` text PRIMARY KEY NOT NULL,
	`inquiryId` text NOT NULL,
	`serviceId` text,
	`label` text NOT NULL,
	`group` text NOT NULL,
	FOREIGN KEY (`inquiryId`) REFERENCES `inquiry`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `inquiry_service_inquiry_idx` ON `inquiry_service` (`inquiryId`);--> statement-breakpoint
CREATE TABLE `inquiry_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`domesticCountry` text DEFAULT 'PK' NOT NULL,
	`serviceGroups` text DEFAULT '{}' NOT NULL
);
