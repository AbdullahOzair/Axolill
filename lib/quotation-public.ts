import { calculateQuote, type QuoteInput, type QuoteSettings, type QuoteStatus } from "@/lib/quotations";

export function publicQuotation(quote: { number: string; revision: number; status: QuoteStatus; digits: number; input: QuoteInput; branding: QuoteSettings }) {
  const { input, branding } = quote;
  const totals = calculateQuote(input);
  const publicTotal = ({ subtotal, discount, net, tax, total }: typeof totals.oneTime) => ({ subtotal, discount, net, tax, total });
  return {
    number: quote.number, revision: quote.revision, status: quote.status, digits: quote.digits,
    currency: input.currency, issue: input.issue, expiry: input.expiry, title: input.title, description: input.description,
    timeline: input.timeline, scope: input.scope, deliverables: input.deliverables, instructions: input.instructions, terms: input.terms,
    client: { name: input.client.name, company: input.client.company, address: input.client.address, country: input.client.country, email: input.client.email, phone: input.client.phone },
    branding: {
      company: branding.company, address: branding.address, email: branding.email, phone: branding.phone,
      logoKey: branding.logoKey, signatureKey: branding.signatureKey, signature: branding.signature, footer: branding.footer, layout: branding.layout,
      registration: branding.verifiedIdentifiers ? branding.registration : "",
      taxId: branding.verifiedIdentifiers ? branding.taxId : "",
    },
    lines: input.lines.map(({ name, description, quantity, unit, customUnit, unitPrice, discount, optional, recurring }) =>
      ({ name, description, quantity, unit, customUnit, unitPrice, discount, optional, recurring })),
    oneTime: publicTotal(totals.oneTime), monthly: publicTotal(totals.monthly), milestones: totals.milestones,
  };
}
export type PublicQuote = ReturnType<typeof publicQuotation>;
