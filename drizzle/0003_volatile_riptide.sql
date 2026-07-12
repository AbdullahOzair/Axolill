CREATE TABLE `lead_attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`leadId` text NOT NULL,
	`name` text NOT NULL,
	`r2Key` text NOT NULL,
	`sizeBytes` integer NOT NULL,
	`contentType` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lead_attachment_leadId_idx` ON `lead_attachment` (`leadId`);--> statement-breakpoint
ALTER TABLE `lead` ADD `clientId` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `lead` ADD `packageName` text;--> statement-breakpoint
ALTER TABLE `lead` ADD `wantsCall` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `lead_clientId_idx` ON `lead` (`clientId`);