import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, mutationJson, newId, notFound, parseBody, requireAdmin } from "@/lib/api";
import { quotationPreset, quotationSettings, quotationTemplate, service } from "@/lib/db/schema";
import { quoteHandler, validateQuoteBranding } from "@/lib/quotation-api";
import { quotePresetSchema, quoteSettingsSchema, quoteTemplateSchema } from "@/lib/quotations";
import { quotationDefaults, QuoteError } from "@/lib/quotation-store";

export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("settings"), data: quoteSettingsSchema }),
  z.object({ kind: z.literal("preset"), id: z.uuid().optional(), data: quotePresetSchema }),
  z.object({ kind: z.literal("template"), id: z.uuid().optional(), data: quoteTemplateSchema }),
  z.object({ kind: z.enum(["delete-preset","delete-template"]), id: z.uuid() }),
]);

export const POST = quoteHandler("quotation.config", async (request: Request) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, schema);
  if (body instanceof Response) return body;
  const database = db();
  if (body.kind === "settings") {
    await validateQuoteBranding(body.data);
    const previous = await quotationDefaults();
    const changedDigits = body.data.currencies.filter(item => {
      const old = previous.currencies.find(value => value.code === item.code);
      return old && old.digits !== item.digits;
    });
    if (changedDigits.length) {
      const presets = await database.select({ data: quotationPreset.data }).from(quotationPreset);
      if (presets.some(preset => changedDigits.some(item => item.code === preset.data.currency)))
        throw new QuoteError("Remove pricing presets for currencies whose precision is changing, then recreate them at the new precision.");
    }
    await database.insert(quotationSettings).values({ id: "company", data: body.data })
      .onConflictDoUpdate({ target: quotationSettings.id, set: { data: body.data } });
    return mutationJson(auth.user, "quotation.settings", { ok: true });
  }
  if (body.kind === "preset") {
    const [found, settings] = await Promise.all([database.select().from(service).where(eq(service.id, body.data.serviceId)).get(), quotationDefaults()]);
    if (!found || !settings.currencies.some(currency => currency.code === body.data.currency)) throw new QuoteError("Select an existing service and enabled currency.");
    const record = { serviceId: body.data.serviceId, data: body.data };
    const id = body.id ?? newId();
    if (body.id) {
      if (!(await database.update(quotationPreset).set(record).where(eq(quotationPreset.id, id)).returning()).length) return notFound("Preset not found.");
    } else await database.insert(quotationPreset).values({ id, ...record });
    return mutationJson(auth.user, "quotation.preset", { id });
  }
  if (body.kind === "template") {
    const id = body.id ?? newId();
    if (body.id) {
      if (!(await database.update(quotationTemplate).set({ data: body.data }).where(eq(quotationTemplate.id, id)).returning()).length) return notFound("Template not found.");
    } else await database.insert(quotationTemplate).values({ id, data: body.data });
    return mutationJson(auth.user, "quotation.template", { id });
  }
  const result = body.kind === "delete-preset" ? await database.delete(quotationPreset).where(eq(quotationPreset.id, body.id)).returning() :
    await database.delete(quotationTemplate).where(eq(quotationTemplate.id, body.id)).returning();
  if (!result.length) return notFound("Record not found.");
  return mutationJson(auth.user, "quotation." + body.kind, { ok: true });
});
