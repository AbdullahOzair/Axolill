ALTER TABLE `meeting` ADD `calendarOwnerId` text REFERENCES user(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `meeting` ADD `requestedChangeAt` integer;--> statement-breakpoint
ALTER TABLE `meeting` ADD `durationMinutes` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `meeting` ADD `confirmationLock` text;--> statement-breakpoint
ALTER TABLE `meeting` ADD `confirmationLockedAt` integer;