import { eq } from "drizzle-orm";
import { z } from "zod";

import {
  badRequest,
  db,
  filesBucket,
  json,
  newId,
  parseMultipart,
  requireClient,
} from "@/lib/api";
import { lead, leadAttachment, meeting, user } from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES, safeFileName, uploadFileToR2 } from "@/lib/r2-upload";
import { securityEvent, withApiErrors } from "@/lib/http-security";
import { limitEndpoint } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MAX_ATTACHMENTS = 8;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

const intakeFields = z.object({
  projectName: z.string().trim().min(1).max(200),
  projectType: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(5000),
  features: z.array(z.string().trim().min(1).max(200)).max(50),
  budgetRange: z.string().trim().min(1).max(40),
  timeline: z.string().trim().min(1).max(80),
  packageName: z.string().trim().max(80).optional(),
  wantsCall: z.boolean(),
});

function parseBoolean(raw: FormDataEntryValue | null): boolean | undefined {
  if (raw === null) return undefined;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return undefined;
}

function parseFeatures(raw: FormDataEntryValue | null): string[] | undefined {
  if (raw === null) return undefined;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) return undefined;
      if (parsed.some((feature) => typeof feature !== "string")) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  return trimmed
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formString(form: FormData, key: string) {
  const raw = form.get(key);
  return typeof raw === "string" ? raw : "";
}

function collectFiles(form: FormData): File[] {
  const fromFiles = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (fromFiles.length > 0) return fromFiles;

  const fromFile = form.get("file");
  if (fromFile instanceof File && fromFile.size > 0) return [fromFile];

  return [];
}

function buildLeadMessage(fields: z.infer<typeof intakeFields>) {
  const lines = [
    `Project: ${fields.projectName}`,
    `Type: ${fields.projectType}`,
    "",
    fields.description,
  ];

  if (fields.features.length > 0) {
    lines.push("", "Features:", ...fields.features.map((f) => `- ${f}`));
  }

  lines.push("", `Budget: ${fields.budgetRange}`, `Timeline: ${fields.timeline}`);
  return lines.join("\n");
}

/** Default preferred slot: tomorrow at the next half hour. */
function defaultScheduledAt() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30, 0, 0);
  return d;
}

/**
 * POST — authenticated client project intake.
 *
 * multipart/form-data fields:
 *   projectName, projectType, description, features (JSON array or newline list),
 *   budgetRange, timeline, packageName, wantsCall, files (0+)
 */
export const POST = withApiErrors("POST /api/portal/intake", async function POST(request: Request) {
  const auth = await requireClient(request);
  if (auth instanceof Response) return auth;
  const limited = await limitEndpoint(request, "intake", auth.user.id);
  if (limited) return limited;

  const form = await parseMultipart(request, MAX_TOTAL_BYTES + 128 * 1024);
  if (form instanceof Response) return form;

  const parsed = intakeFields.safeParse({
    projectName: formString(form, "projectName"),
    projectType: formString(form, "projectType"),
    description: formString(form, "description"),
    features: parseFeatures(form.get("features")),
    budgetRange: formString(form, "budgetRange"),
    timeline: formString(form, "timeline"),
    packageName: formString(form, "packageName") || undefined,
    wantsCall: parseBoolean(form.get("wantsCall")) ?? false,
  });

  if (!parsed.success) {
    return badRequest("Validation failed", parsed.error.issues);
  }

  const fields = parsed.data;
  const files = collectFiles(form);
  if (
    files.length > MAX_ATTACHMENTS ||
    files.some((file) => file.size > MAX_UPLOAD_BYTES) ||
    files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES
  ) {
    return badRequest("Use at most 8 attachments, 25 MiB each and 30 MiB total");
  }

  const [profile] = await db()
    .select({ company: user.company })
    .from(user)
    .where(eq(user.id, auth.user.id))
    .limit(1);

  const leadId = newId();

  try {
    await db()
      .insert(lead)
      .values({
        id: leadId,
        clientId: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        company: profile?.company ?? null,
        service: fields.projectType,
        packageName: fields.packageName ?? null,
        budgetRange: fields.budgetRange,
        message: buildLeadMessage(fields),
        wantsCall: fields.wantsCall,
        status: "new",
        source: "portal_intake",
      });
  } catch {
    securityEvent("intake_write_failed");
    return badRequest("Could not save your intake");
  }

  const uploadedKeys: string[] = [];

  for (const file of files) {
    const attachmentId = newId();
    const key = `leads/${leadId}/${attachmentId}-${safeFileName(file.name)}`;

    const uploaded = await uploadFileToR2(file, key, {
      leadId,
      uploadedBy: auth.user.id,
    });
    if (uploaded instanceof Response) {
      await rollbackIntake(leadId, uploadedKeys);
      return uploaded;
    }

    try {
      await db()
        .insert(leadAttachment)
        .values({
          id: attachmentId,
          leadId,
          name: file.name,
          r2Key: key,
          sizeBytes: uploaded.sizeBytes,
          contentType: uploaded.contentType,
        });
      uploadedKeys.push(key);
    } catch {
      securityEvent("intake_attachment_record_failed");
      await rollbackIntake(leadId, [...uploadedKeys, key]);
      return badRequest("Could not record an attachment");
    }
  }

  if (fields.wantsCall) {
    try {
      await db()
        .insert(meeting)
        .values({
          id: newId(),
          leadId,
          clientId: auth.user.id,
          projectId: null,
          title: `Intro call — ${fields.projectName}`,
          attendeeName: auth.user.name,
          attendeeEmail: auth.user.email,
          scheduledAt: defaultScheduledAt(),
          meetingUrl: null,
          status: "requested",
          googleEventId: null,
          provider: "google_meet",
        });
    } catch {
      securityEvent("intake_meeting_write_failed");
      await rollbackIntake(leadId, uploadedKeys);
      return badRequest("Could not request an intro call");
    }
  }

  return json({ leadId }, 201);
});

async function rollbackIntake(leadId: string, r2Keys: string[]) {
  const outcomes = await Promise.allSettled(r2Keys.map((key) => filesBucket().delete(key)));
  if (outcomes.some((outcome) => outcome.status === "rejected")) {
    securityEvent("intake_attachment_cleanup_failed");
  }
  try {
    await db().delete(lead).where(eq(lead.id, leadId));
  } catch {
    securityEvent("intake_lead_cleanup_failed");
  }
}
