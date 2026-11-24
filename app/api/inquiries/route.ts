import { eq } from "drizzle-orm";

import { badRequest, db, json, parseBody } from "@/lib/api";
import { inquiry, inquiryActivity, inquiryEvent, inquiryService, lead } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";
import { GROUP_LABELS, type InquiryServiceChoice } from "@/lib/inquiries";
import { allowPublicInquiry, loadInquiryServices } from "@/lib/inquiry-server";
import { inquirySubmission } from "@/lib/inquiry-validation";

export const dynamic = "force-dynamic";

export const POST = withApiErrors("POST /api/inquiries", async function POST(request: Request) {
  const limited = await allowPublicInquiry(request, "inquiry");
  if (limited) return limited;

  const body = await parseBody(request, inquirySubmission);
  if (body instanceof Response) return body;
  const { requestId, sessionId, websiteAddress, ...input } = body;
  if (websiteAddress) return badRequest("Could not submit this inquiry.");

  // The client key makes retries safe. The content hash blocks duplicates with a fresh key.
  const normalized = input.type === "PROJECT"
    ? { ...input, groups: [...new Set(input.groups)].sort(), serviceKeys: [...new Set(input.serviceKeys)].sort() }
    : input;
  const bytes = new TextEncoder().encode(JSON.stringify(normalized));
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0")).join("");

  const database = db();
  const lookup = () => database.select({ reference: inquiry.reference, fingerprint: inquiry.fingerprint })
    .from(inquiry).where(eq(inquiry.id, requestId)).get();
  const duplicateKey = () => json({ error: "This inquiry is already recorded or the submission token is in use." }, 409);
  const existing = await lookup();
  if (existing) return existing.fingerprint === fingerprint ? json({ reference: existing.reference }) : duplicateKey();

  let selections: InquiryServiceChoice[] = [];
  if (normalized.type === "PROJECT") {
    const catalogue = await loadInquiryServices();
    const keys = new Set(normalized.serviceKeys);
    const groups = new Set(normalized.groups);
    selections = catalogue.filter((choice) => keys.has(choice.key) && groups.has(choice.group));
    if (selections.length !== keys.size || (!selections.length && catalogue.some((choice) => groups.has(choice.group)))) {
      return badRequest("Select published services or refresh your selection if the catalogue changed.");
    }
  }

  const viewedEvent = sessionId
    ? await database.select({ id: inquiryEvent.id, referral: inquiryEvent.referral, campaign: inquiryEvent.campaign })
      .from(inquiryEvent).where(eq(inquiryEvent.id, sessionId + ":viewed")).get()
    : undefined;
  const trackedSession = viewedEvent ? sessionId : undefined;
  const categories = normalized.type === "PROJECT" ? normalized.groups : [normalized.category];
  const source = viewedEvent?.campaign?.source ?? viewedEvent?.referral ?? "Work With Us";
  const reference = "AX-" + crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const budget = "budget" in normalized ? normalized.budget ?? null : null;
  const currency = "currency" in normalized ? normalized.currency ?? null : null;
  const selectedService = selections.map(({ label }) => label).join(", ") ||
    (normalized.type === "PROJECT" ? normalized.groups.map((group) => GROUP_LABELS[group]).join(", ") : normalized.category);

  try {
    await database.batch([
      database.insert(lead).values({
        id: requestId, name: normalized.name, email: normalized.email, company: normalized.company ?? null,
        service: selectedService, budgetRange: budget === null ? null : String(budget) + (currency ? " " + currency : ""),
        message: normalized.description, source, wantsCall: normalized.type === "GUIDANCE" && normalized.consultation !== "Email",
      }),
      database.insert(inquiry).values({
        id: requestId, reference, fingerprint, type: normalized.type, country: normalized.country,
        phone: normalized.phone ?? null, categories, objectives: normalized.objectives, budget, currency,
        title: normalized.type === "PROJECT" ? normalized.title : null,
        website: normalized.type === "PROJECT" ? normalized.website ?? null : null,
        timeline: "timeline" in normalized ? normalized.timeline ?? null : null,
        situation: normalized.type === "GUIDANCE" ? normalized.situation : null,
        consultation: normalized.type === "GUIDANCE" ? normalized.consultation : null,
        sessionId: trackedSession ?? null,
      }),
      database.insert(inquiryActivity).values({
        id: crypto.randomUUID(), inquiryId: requestId, kind: "submitted",
        newStage: "new", description: "Inquiry submitted through Work With Us.",
      }),
      ...selections.map(({ serviceId, label, group }) => database.insert(inquiryService).values({
        id: crypto.randomUUID(), inquiryId: requestId, serviceId, label, group,
      })),
      ...(trackedSession ? [database.insert(inquiryEvent).values({
        id: requestId + ":submitted", sessionId: trackedSession, event: "submitted", type: normalized.type,
        inquiryId: requestId, step: 3,
      })] : []),
    ]);
  } catch (error) {
    const saved = await lookup();
    if (saved) return saved.fingerprint === fingerprint ? json({ reference: saved.reference }) : duplicateKey();
    const duplicate = await database.select({ id: inquiry.id }).from(inquiry)
      .where(eq(inquiry.fingerprint, fingerprint)).get();
    if (duplicate) return duplicateKey();
    throw error;
  }
  return json({ reference }, 201);
});
