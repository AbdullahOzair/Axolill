import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, filesBucket, json } from "@/lib/api";
import { lead, quotationPreset, quotationTemplate, service, teamMember, user } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";
import { inquireDetail } from "@/lib/inquiry-admin";
import { loadInquirySettings } from "@/lib/inquiry-server";
import { newQuoteInput, newQuoteLine, type QuoteSettings } from "@/lib/quotations";
import { QuoteError, quotationDefaults } from "@/lib/quotation-store";

export function quoteHandler<Args extends unknown[]>(action: string, handle: (...args: Args) => Promise<Response>) {
  return withApiErrors(action, async (...args: Args) => {
    try { return await handle(...args); }
    catch (error) { if (error instanceof QuoteError) return json({ error: error.message }, error.status); throw error; }
  });
}

export async function quotationOptions(sourceId: string | null) {
  const database = db();
  const [settings, clients, team, services, presets, templates, source, enquirySettings] = await Promise.all([
    quotationDefaults(),
    database.select({ id: user.id, name: user.name, email: user.email, company: user.company, phone: user.phone })
      .from(user).where(eq(user.role, "client")).orderBy(asc(user.name)),
    database.select({ id: teamMember.id, name: teamMember.name }).from(teamMember).orderBy(asc(teamMember.name)),
    database.select({ id: service.id, title: service.title, summary: service.summary, items: service.items }).from(service).orderBy(asc(service.order)),
    database.select().from(quotationPreset),
    database.select().from(quotationTemplate),
    sourceId ? inquireDetail(sourceId) : null,
    loadInquirySettings(),
  ]);
  const input = newQuoteInput(settings);
  input.client.country = enquirySettings.domesticCountry;
  let sourceBudget: { amount: number; currency: string } | undefined;
  if (sourceId) {
    const fallback = await database.select().from(lead).where(eq(lead.id, sourceId)).get();
    if (!fallback) throw new QuoteError("The source inquiry or lead does not exist.", 404);
    const current = source?.inquiry;
    const linked = (current?.convertedClientId ?? fallback.clientId) ?
      clients.find(c => c.id === (current?.convertedClientId ?? fallback.clientId)) :
      clients.find(c => c.email.toLowerCase() === fallback.email.toLowerCase());
    input.inquiryId = fallback.id;
    input.assigneeId = current?.assigneeId ?? null;
    input.clientId = linked?.id ?? null;
    input.createClient = !linked;
    input.client = { ...input.client, name: linked?.name ?? fallback.name, email: linked?.email ?? fallback.email,
      company: linked?.company ?? fallback.company ?? "", phone: linked?.phone ?? current?.phone ?? "",
      country: current?.country ?? enquirySettings.domesticCountry,
      region: current?.country && current.country !== enquirySettings.domesticCountry ? "international" : "national" };
    input.title = current?.title || "";
    input.description = [fallback.message, current?.objectives, current?.situation].filter(Boolean).join("\n\n").slice(0, 2400);
    input.timeline = current?.timeline ?? "";
    if (source?.services.length) input.lines = source.services.slice(0, 36).map(entry => ({
      ...newQuoteLine(), serviceId: entry.serviceId, name: entry.label, category: entry.group,
    }));
    else if (fallback.service) input.lines = [{ ...newQuoteLine(), name: fallback.service.slice(0, 180) }];
    if (typeof current?.budget === "number" && current.currency) {
      sourceBudget = { amount: current.budget, currency: current.currency };
      if (settings.currencies.some(currency => currency.code === current.currency)) input.currency = current.currency;
    }
  }
  const projectId = source?.inquiry.convertedProjectId ?? null;
  return { settings, clients, team, services, presets, templates, input, sourceBudget, projectId };
}

export async function validateQuoteBranding(settings: QuoteSettings) {
  for (const key of [settings.logoKey, settings.signatureKey].filter(Boolean)) {
    const object = await filesBucket().head(key);
    if (!object || !["image/png", "image/jpeg"].includes(object.httpMetadata?.contentType ?? "") || object.size > 1024 * 1024)
      throw new QuoteError("Upload a PNG or JPEG of up to 1 MB for quotation branding.");
  }
}
