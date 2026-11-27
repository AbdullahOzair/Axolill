CREATE TABLE `quotation` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`year` integer NOT NULL,
	`sequence` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`previousId` text,
	`clientId` text,
	`leadId` text,
	`assigneeId` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`issue` text NOT NULL,
	`expiry` text NOT NULL,
	`currency` text NOT NULL,
	`digits` integer NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`input` text NOT NULL,
	`branding` text NOT NULL,
	`oneTime` integer NOT NULL,
	`monthly` integer NOT NULL,
	`oneTimeProfit` integer NOT NULL,
	`monthlyProfit` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`deleted` integer DEFAULT false NOT NULL,
	`lastActionId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`sentAt` integer,
	`acceptedAt` integer,
	FOREIGN KEY (`previousId`) REFERENCES `quotation`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`clientId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`assigneeId`) REFERENCES `team_member`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_number_revision_uq` ON `quotation` (`number`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_year_sequence_revision_uq` ON `quotation` (`year`,`sequence`,`revision`);--> statement-breakpoint
CREATE INDEX `quotation_status_issue_idx` ON `quotation` (`status`,`issue`);--> statement-breakpoint
CREATE INDEX `quotation_currency_issue_idx` ON `quotation` (`currency`,`issue`);--> statement-breakpoint
CREATE INDEX `quotation_lead_idx` ON `quotation` (`leadId`);--> statement-breakpoint
CREATE INDEX `quotation_client_idx` ON `quotation` (`clientId`);--> statement-breakpoint
CREATE TABLE `quotation_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`quotationId` text NOT NULL,
	`actorId` text,
	`kind` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`quotationId`) REFERENCES `quotation`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`actorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quotation_activity_quote_idx` ON `quotation_activity` (`quotationId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `quotation_invoice` (
	`id` text PRIMARY KEY NOT NULL,
	`quoteNumber` text NOT NULL,
	`quotationId` text NOT NULL,
	`invoiceId` text,
	`snapshot` text NOT NULL,
	FOREIGN KEY (`quotationId`) REFERENCES `quotation`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invoiceId`) REFERENCES `invoice`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_invoice_quoteNumber_unique` ON `quotation_invoice` (`quoteNumber`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_invoice_quotationId_unique` ON `quotation_invoice` (`quotationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_invoice_invoiceId_unique` ON `quotation_invoice` (`invoiceId`);--> statement-breakpoint
CREATE TABLE `quotation_payment` (
	`id` text PRIMARY KEY NOT NULL,
	`conversionId` text NOT NULL,
	`receipt` text NOT NULL,
	`amount` integer NOT NULL,
	`receivedOn` text NOT NULL,
	`createdBy` text,
	FOREIGN KEY (`conversionId`) REFERENCES `quotation_invoice`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_payment_receipt_uq` ON `quotation_payment` (`conversionId`,`receipt`);--> statement-breakpoint
CREATE TABLE `quotation_preset` (
	`id` text PRIMARY KEY NOT NULL,
	`serviceId` text NOT NULL,
	`data` text NOT NULL,
	FOREIGN KEY (`serviceId`) REFERENCES `service`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quotation_preset_service_idx` ON `quotation_preset` (`serviceId`);--> statement-breakpoint
CREATE TABLE `quotation_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotation_share` (
	`id` text PRIMARY KEY NOT NULL,
	`quotationId` text NOT NULL,
	`tokenHash` text NOT NULL,
	`codeHash` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`revokedAt` integer,
	`viewedAt` integer,
	`usedAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`quotationId`) REFERENCES `quotation`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quotation_share_tokenHash_unique` ON `quotation_share` (`tokenHash`);--> statement-breakpoint
CREATE INDEX `quotation_share_quote_idx` ON `quotation_share` (`quotationId`);--> statement-breakpoint
CREATE TABLE `quotation_template` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL
);
