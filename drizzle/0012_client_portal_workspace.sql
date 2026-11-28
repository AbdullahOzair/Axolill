CREATE TABLE `portal_attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`requestId` text NOT NULL,
	`eventId` text,
	`name` text NOT NULL,
	`objectKey` text NOT NULL,
	`size` integer NOT NULL,
	`contentType` text NOT NULL,
	FOREIGN KEY (`requestId`) REFERENCES `portal_request`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`eventId`) REFERENCES `portal_request_event`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_attachment_objectKey_unique` ON `portal_attachment` (`objectKey`);--> statement-breakpoint
CREATE INDEX `portal_attachment_request_idx` ON `portal_attachment` (`requestId`);--> statement-breakpoint
CREATE TABLE `portal_notification_read` (
	`userId` text NOT NULL,
	`key` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_notification_read_user_key_uq` ON `portal_notification_read` (`userId`,`key`);--> statement-breakpoint
CREATE TABLE `portal_request` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerId` text NOT NULL,
	`leadId` text,
	`reference` text NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`input` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`submittedAt` integer,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`leadId`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `portal_request_leadId_unique` ON `portal_request` (`leadId`);--> statement-breakpoint
CREATE UNIQUE INDEX `portal_request_reference_unique` ON `portal_request` (`reference`);--> statement-breakpoint
CREATE INDEX `portal_request_owner_idx` ON `portal_request` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE TABLE `portal_request_event` (
	`id` text PRIMARY KEY NOT NULL,
	`requestId` text NOT NULL,
	`actorId` text,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`readAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`requestId`) REFERENCES `portal_request`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `portal_request_event_request_idx` ON `portal_request_event` (`requestId`,`createdAt`);--> statement-breakpoint
INSERT INTO portal_request (id, ownerId, leadId, reference, state, input, submittedAt, updatedAt)
SELECT l.id, l.clientId, l.id, 'AXN-REQ-LEGACY-' || upper(replace(l.id, '-', '')),
  CASE WHEN l.status IN ('won','lost') THEN 'closed' WHEN l.status IN ('contacted','qualified') THEN 'under_review' ELSE 'submitted' END,
  json_object('type','PROJECT','title',CASE WHEN instr(coalesce(l.message,''),char(10))>9 THEN substr(l.message,10,instr(l.message,char(10))-10)
    ELSE 'Project request' END,'description',coalesce(l.message,''),'objectives','','audience','','features','','website','','area','',
    'services',json('[]'),'unsure',json('true'),'currency','USD','budgetRange','','budget',NULL,'timeline','','date','',
    'communication','','consultation',json(CASE WHEN l.wantsCall THEN 'true' ELSE 'false' END)),
  l.createdAt,l.updatedAt
FROM lead l INNER JOIN user u ON u.id=l.clientId
WHERE l.source='portal_intake' AND u.role='client' AND NOT EXISTS (SELECT 1 FROM inquiry i WHERE i.id=l.id);
--> statement-breakpoint
INSERT INTO portal_attachment (id,requestId,name,objectKey,size,contentType)
SELECT a.id,p.id,a.name,a.r2Key,a.sizeBytes,a.contentType FROM lead_attachment a INNER JOIN portal_request p ON p.leadId=a.leadId;
