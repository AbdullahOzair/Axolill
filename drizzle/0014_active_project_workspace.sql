CREATE TABLE `project_workspace` (
	`projectId` text PRIMARY KEY NOT NULL,
	`config` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `project_workspace_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`actorId` text,
	`kind` text NOT NULL,
	`state` text NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `project_workspace_entry_idx` ON `project_workspace_entry` (`projectId`,`kind`,`createdAt`);--> statement-breakpoint
ALTER TABLE `milestone` ADD `reviewVersion` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `project_file` ADD `clientVisible` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `project_file` ADD `folder` text DEFAULT 'Project documents' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_file` ADD `fileType` text;--> statement-breakpoint
ALTER TABLE `project_file` ADD `fileSize` integer;--> statement-breakpoint
ALTER TABLE `project_file` ADD `previousVersionId` text REFERENCES project_file(id);
--> statement-breakpoint
CREATE TRIGGER project_review_file_insert AFTER INSERT ON project_file
WHEN NEW.milestoneId IS NOT NULL AND NEW.clientVisible=1
BEGIN
  UPDATE milestone SET reviewVersion=reviewVersion+1, updatedAt=unixepoch(),
    status=CASE WHEN status='approved' THEN 'awaiting_approval' ELSE status END
    WHERE id=NEW.milestoneId AND projectId=NEW.projectId;
END;
--> statement-breakpoint
CREATE TRIGGER project_review_file_delete AFTER DELETE ON project_file
WHEN OLD.milestoneId IS NOT NULL AND OLD.clientVisible=1
BEGIN
  UPDATE milestone SET reviewVersion=reviewVersion+1, updatedAt=unixepoch(),
    status=CASE WHEN status='approved' THEN 'awaiting_approval' ELSE status END
    WHERE id=OLD.milestoneId AND projectId=OLD.projectId;
END;
