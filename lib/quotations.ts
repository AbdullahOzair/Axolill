import { z } from "zod";

export const QUOTE_STATUSES = ["draft", "pending_approval", "approved", "sent", "viewed", "revision_requested", "accepted", "declined", "expired", "cancelled", "invoiced"] as const;
export const QUOTE_LABELS: Record<(typeof QUOTE_STATUSES)[number], string> = {
  draft: "Draft", pending_approval: "Pending internal approval", approved: "Approved for sending", sent: "Sent",
  viewed: "Viewed", revision_requested: "Revision requested", accepted: "Accepted", declined: "Declined",
  expired: "Expired", cancelled: "Cancelled", invoiced: "Converted to invoice",
};
export type QuoteStatus = keyof typeof QUOTE_LABELS;

export const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
export const quotePercent = z.number().int().min(0).max(10_000);
const money = z.number().int().min(0).max(99_999_999_999);
const title = z.string().trim().min(1).max(180);
const text = (max: number) => z.string().trim().max(max);
const optionalId = z.string().min(1).max(160).nullable();
export const quoteCostKeys = ["development", "design", "marketing", "contractors", "hosting", "software", "other"] as const;
export const quoteUnits = ["Project", "Hour", "Day", "Month", "Page", "Design", "Item", "Custom"] as const;

const quoteLineFields = z.object({
  serviceId: optionalId, name: title, category: text(100), description: text(900),
  quantity: z.number().int().min(1).max(1_000_000), unit: z.enum(quoteUnits), customUnit: text(36),
  unitPrice: money, discount: quotePercent, optional: z.boolean(), recurring: z.boolean(), taxable: z.boolean(), cost: money,
});
export const quoteLineSchema = quoteLineFields.refine(line => line.unit !== "Custom" || line.customUnit.length > 0, { message: "Enter a custom unit." });

const milestoneSchema = z.object({
  name: title, description: text(400), share: quotePercent, due: z.iso.date().or(z.literal("")),
});

export const quoteSettingsSchema = z.object({
  currencies: z.array(z.object({ code: currencyCode, digits: z.number().int().min(0).max(3) })).min(1).max(20)
    .refine(items => new Set(items.map(item => item.code)).size === items.length),
  currency: currencyCode, prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{0,23}$/),
  sequenceDigits: z.number().int().min(3).max(8), validityDays: z.number().int().min(1).max(365),
  advance: quotePercent, tax: quotePercent, taxExempt: z.boolean(), margin: quotePercent,
  reminderDays: z.number().int().min(1).max(60), terms: text(4000), instructions: text(2000),
  company: title, address: text(300), email: z.email().max(254), phone: text(60),
  logoKey: text(160).refine(key => !key || /^cms\/[\w.-]+$/.test(key)),
  signatureKey: text(160).refine(key => !key || /^cms\/[\w.-]+$/.test(key)),
  signature: text(100), footer: text(400), registration: text(100), taxId: text(100),
  verifiedIdentifiers: z.boolean(), layout: z.enum(["standard", "compact"]),
}).refine(settings => settings.currencies.some(item => item.code === settings.currency), { message: "Enable the default currency." });
export type QuoteSettings = z.infer<typeof quoteSettingsSchema>;
export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  currencies: ["PKR", "USD", "GBP", "EUR"].map(code => ({ code, digits: 2 })),
  currency: "PKR", prefix: "AXN-QT", sequenceDigits: 4, validityDays: 30, advance: 3000, tax: 0, taxExempt: false,
  margin: 2000, reminderDays: 7, terms: "", instructions: "", company: "Axonill",
  address: "Midway Centrum, 6th Road, Rawalpindi, Pakistan", email: "info.axonill@gmail.com",
  phone: "", logoKey: "", signatureKey: "", signature: "", footer: "", registration: "", taxId: "",
  verifiedIdentifiers: false, layout: "standard",
};

export const quoteInputSchema = z.object({
  clientId: optionalId, createClient: z.boolean(), inquiryId: optionalId, assigneeId: optionalId,
  client: z.object({ name: title, company: text(180), email: z.email().max(254).toLowerCase(), phone: text(60),
    country: text(80).min(1), address: text(500), region: z.enum(["national", "international"]) }),
  title, description: text(2400), timeline: text(180), scope: text(4000), deliverables: text(4000),
  issue: z.iso.date(), expiry: z.iso.date(), currency: currencyCode,
  lines: z.array(quoteLineSchema).min(1).max(36),
  discountType: z.enum(["fixed", "percentage"]), discount: money, monthlyDiscount: money,
  tax: quotePercent, taxExempt: z.boolean(), advance: quotePercent,
  paymentPlan: z.enum(["upfront", "advance", "three", "custom", "monthly"]),
  milestones: z.array(milestoneSchema).max(12), instructions: text(2000), terms: text(4000),
  costs: z.record(z.enum(quoteCostKeys), money), privateNotes: text(2000),
}).superRefine((input, context) => {
  function issue(path: string, message: string) { context.addIssue({ code: "custom", path: [path], message }); }
  if (input.expiry < input.issue) issue("expiry", "Validity must end on or after the issue date.");
  if (input.discountType === "percentage" && (input.discount > 10_000 || input.monthlyDiscount > 10_000)) issue("discount", "Percentage discounts cannot exceed 100%.");
  if (input.paymentPlan === "custom" && input.milestones.reduce((sum, item) => sum + item.share, 0) !== 10_000) issue("milestones", "Milestone percentages must add up to 100%.");
  if (input.paymentPlan === "monthly" && !input.lines.some(line => line.recurring && !line.optional)) issue("paymentPlan", "A monthly plan requires an included recurring service.");
  if (input.lines.every(line => line.optional)) issue("lines", "Include at least one line in the quotation.");
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;
export type QuoteLine = z.infer<typeof quoteLineSchema>;

export const quotePresetSchema = quoteLineFields.omit({ recurring: true, serviceId: true }).extend({
  serviceId: z.string().min(1).max(160), currency: currencyCode, region: z.enum(["national", "international"]),
  recurring: z.boolean(), timeline: text(180),
}).refine(line => line.unit !== "Custom" || line.customUnit.length > 0, { message: "Enter a custom unit." });
export const quoteTemplateSchema = z.object({
  name: title, category: text(100), description: text(2400), scope: text(4000), deliverables: text(4000),
  timeline: text(180), terms: text(4000), instructions: text(2000),
});

function rounded(value: number, multiplier: number, denominator: number) {
  const divisor = BigInt(denominator);
  return Number((BigInt(value) * BigInt(multiplier) + divisor / BigInt(2)) / divisor);
}

export function quoteLineAmount(line: QuoteLine) {
  const unitTotal = rounded(line.unitPrice, line.quantity, 1000);
  return unitTotal - rounded(unitTotal, line.discount, 10_000);
}

export function calculateQuote(input: QuoteInput) {
  function group(recurring: boolean) {
    const lines = input.lines.filter(line => line.recurring === recurring && !line.optional);
    const subtotal = lines.reduce((sum, line) => sum + quoteLineAmount(line), 0);
    const taxable = lines.reduce((sum, line) => sum + (line.taxable ? quoteLineAmount(line) : 0), 0);
    const requested = recurring ? input.monthlyDiscount : input.discount;
    const discount = input.discountType === "percentage" ? rounded(subtotal, requested, 10_000) : requested;
    if (discount > subtotal) throw new Error(recurring ? "Monthly discount exceeds the monthly subtotal." : "Discount exceeds the one-time subtotal.");
    const taxableDiscount = subtotal ? rounded(discount, taxable, subtotal) : 0;
    const net = subtotal - discount;
    const tax = input.taxExempt ? 0 : rounded(taxable - taxableDiscount, input.tax, 10_000);
    const costs = lines.reduce((sum, line) => sum + line.cost, 0) + (recurring ? 0 : Object.values(input.costs).reduce((sum, cost) => sum + cost, 0));
    const total = net + tax;
    if (total > 999_999_999_999) throw new Error("A quotation total cannot exceed 999,999,999,999 minor units.");
    const profit = net - costs;
    return { subtotal, discount, net, tax, total, costs, profit, margin: net ? profit / net : null };
  }
  const oneTime = group(false);
  const monthly = group(true);
  const advanceShare = input.paymentPlan === "upfront" ? 10_000 : input.advance;
  const defaultMilestone = (name: string, share: number) => ({ name, share, due: "", description: "" });
  const deliveryShare = Math.floor((10_000 - advanceShare) / 2);
  const schedule = input.paymentPlan === "custom" ? input.milestones :
    input.paymentPlan === "three" ? [defaultMilestone("Advance", advanceShare), defaultMilestone("Delivery milestone", deliveryShare), defaultMilestone("Final payment", 10_000 - advanceShare - deliveryShare)] :
    input.paymentPlan === "upfront" ? [defaultMilestone("Full upfront payment", 10_000)] :
    [defaultMilestone("Advance", advanceShare), defaultMilestone("Final payment", 10_000 - advanceShare)];
  let cumulative = 0;
  let allocated = 0;
  const milestones = schedule.map(item => {
    cumulative += item.share;
    const next = rounded(oneTime.total, cumulative, 10_000);
    const amount = next - allocated;
    allocated = next;
    return { ...item, amount };
  });
  return { oneTime, monthly, milestones };
}

export function formatQuoteMoney(amount: number, code: string, digits: number) {
  return new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "code",
    minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount / 10 ** digits);
}

export function quoteDateToday() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
}

export function newQuoteLine(): QuoteLine {
  return { serviceId: null, name: "", category: "", description: "", quantity: 1000, unit: "Project", customUnit: "",
    unitPrice: 0, discount: 0, optional: false, recurring: false, taxable: true, cost: 0 };
}

export function newQuoteInput(settings: QuoteSettings): QuoteInput {
  const issue = quoteDateToday();
  const expiry = new Date(Date.parse(issue) + settings.validityDays * 86_400_000).toISOString().slice(0, 10);
  return {
    clientId: null, createClient: true, inquiryId: null, assigneeId: null,
    client: { name: "", company: "", email: "", phone: "", country: "PK", address: "", region: "national" },
    title: "", description: "", timeline: "", scope: "", deliverables: "", issue, expiry, currency: settings.currency,
    lines: [newQuoteLine()], discountType: "fixed", discount: 0, monthlyDiscount: 0, tax: settings.tax,
    taxExempt: settings.taxExempt, advance: settings.advance, paymentPlan: "advance", milestones: [],
    instructions: settings.instructions, terms: settings.terms,
    costs: { development: 0, design: 0, marketing: 0, contractors: 0, hosting: 0, software: 0, other: 0 }, privateNotes: "",
  };
}
