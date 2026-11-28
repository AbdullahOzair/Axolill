import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).default("");
const safeUrl = z.url({ protocol: /^https$/ }).max(600).refine((value) => {
  const url = new URL(value);
  return !url.username && !url.password;
});
export const workflowStatuses = ["upcoming", "current", "completed", "blocked", "client_action"] as const;
export const projectStates = ["preparing", "active", "blocked", "handover", "completed"] as const;
export const projectModules = ["development", "marketing", "design", "automation"] as const;
export const moduleLabels = { development: "Development", marketing: "Marketing", design: "Design & branding", automation: "AI & automation" };
export const moduleSections: Record<(typeof projectModules)[number], string[]> = {
  development:["Development update","Design approval","Testing report","Deployment","Technical documentation","Handover"],
  marketing:["Content calendar","Content approval","Campaign report","Audience reach","Engagement","Website traffic","Leads generated","Monthly performance"],
  design:["Design concept","Design review","Brand assets","Final design"],
  automation:["Integration update","Workflow documentation","Testing and validation","Performance and monitoring","Deployment"],
};
export const folderNames = ["Project documents", "Brand assets", "Design files", "Development previews", "Client uploads", "Milestone deliverables", "Final deliverables", "Reports"];
export const entryKinds = ["message", "change", "support", "report", "handover", "feedback", "proof", "activity", "module"] as const;
export const projectEntryStates = ["open", "under_review", "in_progress", "awaiting_client", "approved", "declined", "resolved", "closed", "published", "pending", "verified", "rejected"] as const;
export const projectConfigSchema = z.object({
  status: z.enum(projectStates).default("preparing"),
  managerId: text(180),
  team: z.array(z.string().max(180)).max(24).default([]),
  stages: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    description: text(600),
    date: z.iso.date().or(z.literal("")).default(""),
    status: z.enum(workflowStatuses).default("upcoming"),
    weight: z.number().int().min(0).max(100).default(0),
  })).max(24).default([]),
  modules: z.array(z.enum(projectModules)).max(4).default([]),
  start: z.iso.date().or(z.literal("")).default(""),
  target: z.iso.date().or(z.literal("")).default(""),
  prerequisites: text(800),
  instructions: text(1800),
  supportThrough: z.iso.date().or(z.literal("")).default(""),
  supportCoverage: text(800),
  staging: safeUrl.or(z.literal("")).default(""),
}).refine((config) => !config.start || !config.target || config.start <= config.target, "The delivery date must follow the start date.")
  .refine((config) => config.stages.filter((stage) => stage.status === "current").length <= 1, "Select at most one current stage.");
export type ActiveProjectConfig = z.output<typeof projectConfigSchema>;

export const entryFields = z.object({
  kind: z.enum(entryKinds),
  title: text(160),
  body: text(5000),
  parentId: text(180),
  fileId: text(180),
  invoiceId: text(180),
  reference: text(120),
  reason: text(900),
  priority: z.enum(["normal", "high", "urgent"]).default("normal"),
  amount: z.string().trim().regex(/^\d{1,10}(?:\.\d{1,3})?$/).or(z.literal("")).default(""),
  date: z.iso.date().or(z.literal("")).default(""),
  target: z.iso.date().or(z.literal("")).default(""),
  period: z.enum(["weekly", "monthly", "one-off"]).default("one-off"),
  quoteId: text(180),
  extra: text(2400),
  scores: z.array(z.number().int().min(1).max(5)).length(4).optional(),
  module: z.enum(projectModules).optional(),
  category: text(120),
  url: safeUrl.or(z.literal("")).default(""),
  needsReview: z.boolean().default(false),
  publishConsent: z.boolean().default(false),
});
export type ActiveEntryInput = z.output<typeof entryFields>;
export const projectWords: Record<string, string> = {
  preparing: "Preparing to start", active: "In progress", blocked: "Blocked", handover: "Handover", completed: "Completed",
  upcoming: "Upcoming", current: "In progress", client_action: "Needs your input", awaiting_approval: "Ready for review",
  changes_requested: "Changes requested", pending: "Pending", under_review: "Under review", awaiting_client: "Waiting for you",
  open: "Open", in_progress: "In progress", approved: "Approved", declined: "Declined", resolved: "Resolved", closed: "Closed",
  verified: "Verified", rejected: "Rejected", published: "Published", sent: "Issued", paid: "Paid", overdue: "Overdue", draft: "Draft",
};
export function projectStageProgress(stages: ActiveProjectConfig["stages"], recorded: number) {
  const weight = stages.reduce((sum, stage) => sum + stage.weight, 0);
  return weight ? Math.round(stages.filter((stage) => stage.status === "completed").reduce((sum, stage) => sum + stage.weight, 0) * 100 / weight) : recorded;
}
export function minorAmount(value: string, digits: number) {
  if (!/^\d{1,10}(?:\.\d{1,3})?$/.test(value)) return null;
  const [units, fraction = ""] = value.split(".");
  if (fraction.length > digits) return null;
  const amount = Number(units) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

