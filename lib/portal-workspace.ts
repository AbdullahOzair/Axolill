import { z } from "zod";

export const journeys = [
  { id: "IDEA", title: "I have an idea", description: "Tell us what you want to build and who it could help." },
  { id: "PROJECT", title: "I have a project", description: "Share your requirements, budget, and timeline." },
  { id: "GUIDANCE", title: "I need guidance", description: "Get help deciding what to do next." },
] as const;

export const currencies = ["PKR", "USD", "GBP", "EUR"] as const;
export const timelines = ["As soon as possible", "Within two weeks", "Within one month", "Within three months", "Custom date", "Flexible timeline"] as const;
export const defaultBudgetRanges: Record<(typeof currencies)[number], string[]> = {
  PKR: ["Under 50,000", "50,000–150,000", "150,000–500,000", "500,000+"],
  USD: ["Under 500", "500–2,000", "2,000–5,000", "5,000+"],
  GBP: ["Under 500", "500–1,500", "1,500–4,000", "4,000+"],
  EUR: ["Under 500", "500–2,000", "2,000–5,000", "5,000+"],
};

const text = (max: number) => z.string().trim().max(max).default("");
export const requestInput = z.object({
  type: z.enum(["IDEA", "PROJECT", "GUIDANCE"]),
  title: text(160), description: text(5000), objectives: text(2000), audience: text(500),
  features: text(2000), website: text(500), area: text(160),
  services: z.array(z.string().max(500)).max(30).default([]),
  unsure: z.boolean().default(false),
  currency: z.enum(currencies).default("PKR"),
  budgetRange: text(100),
  budget: z.number().min(0).max(1_000_000_000).nullable().default(null),
  timeline: text(80), date: text(10), communication: text(80),
  consultation: z.boolean().default(false),
});
export type WorkspaceInput = z.output<typeof requestInput>;
export const workspaceStatuses = {
  draft: "Draft", submitted: "Submitted", under_review: "Under review",
  needs_info: "Additional information required", meeting: "Consultation scheduled",
  preparing: "Preparing quotation", quote_ready: "Quotation ready", revision: "Revision requested",
  accepted: "Quotation accepted", awaiting: "Awaiting project confirmation",
  created: "Project created", closed: "Closed", cancelled: "Cancelled",
} as const;
export type WorkspaceStatus = keyof typeof workspaceStatuses;
export const statusActions: Record<WorkspaceStatus, string> = {
  draft: "Finish and submit your request.", submitted: "Axonill will review your brief.",
  under_review: "Axonill is reviewing your request.", needs_info: "Reply in Messages with the information requested.",
  meeting: "Review your meeting details.", preparing: "Axonill is working on your quotation.",
  quote_ready: "Review and respond to the quotation.", revision: "Axonill will review the requested changes.",
  accepted: "Axonill will confirm the project separately.", awaiting: "Wait for Axonill to confirm your project.",
  created: "Open your project workspace.", closed: "Start a new request if you need more help.",
  cancelled: "Start a new request whenever you are ready.",
};
export const staffRequestStatuses = ["under_review", "needs_info", "preparing", "awaiting", "closed"] as const;

export function getWorkspaceStatus(state: string, stage: string | null, project: string | null, quote: string | null, hasMeeting: boolean): WorkspaceStatus {
  if (state === "draft" || state === "cancelled") return state;
  if (project) return "created";
  if (state === "closed" || stage === "lost") return "closed";
  if (state === "needs_info" || state === "awaiting") return state;
  if (quote === "accepted" || quote === "invoiced") return "accepted";
  if (quote === "revision_requested") return "revision";
  if (quote === "sent" || quote === "viewed") return "quote_ready";
  if (state === "preparing" || stage === "proposal" || stage === "negotiation") return "preparing";
  if (hasMeeting) return "meeting";
  return state === "under_review" || (stage && stage !== "new") ? "under_review" : "submitted";
}

export function validateBrief(input: WorkspaceInput) {
  if (!input.description) return "Tell us what you need help with.";
  if (input.type !== "GUIDANCE" && !input.title) return "Enter a project, business, or idea name.";
  if (input.type === "IDEA" && !input.objectives) return "Tell us what problem your idea will solve.";
  if (input.type === "GUIDANCE" && (!input.area || !input.communication)) return "Choose an area and how you would like us to contact you.";
  if (input.type === "PROJECT" && !input.services.length && !input.unsure) return "Choose a service or select Not sure yet.";
  if (input.type === "PROJECT" && !input.objectives) return "Tell us what you want the project to achieve.";
  if (input.type === "PROJECT" && !timelines.some((item) => item === input.timeline)) return "Choose your preferred timeline.";
  if (input.timeline === "Custom date" && (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)) ||
    new Date(input.date).toISOString().slice(0, 10) !== input.date || input.date < new Date().toISOString().slice(0, 10))) return "Choose a valid future target date.";
  if (input.website) {
    try {
      const url = new URL(input.website);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "Use a website URL beginning with https:// or http://.";
    } catch {
      return "Enter a complete reference website URL.";
    }
  }
  return null;
}
