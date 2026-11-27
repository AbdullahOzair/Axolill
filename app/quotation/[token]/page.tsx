import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuotationDocument } from "@/components/quotation-document";
import { PrintQuotation, QuotationClientResponse } from "@/components/quotation-client-response";
import { publicQuotation } from "@/lib/quotation-public";
import { lookupQuotationShare } from "@/lib/quotation-share";
import "@/components/admin/quotes/quotes.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title:"Private quotation | Axonill", robots:{ index:false,follow:false,nocache:true },
  referrer:"no-referrer",
};

export default async function Page({ params }:{params:Promise<{token:string}>}) {
  const { token } = await params;
  const record = await lookupQuotationShare(token);
  if (!record) notFound();
  const quote = publicQuotation(record.quote);
  const pdf = "/api/quotations/share/" + token + "/pdf";
  return <main className="quote-public quote-stack">
    <div className="quote-actions quote-no-print"><a className="quote-link" href={pdf+"?view=1"} target="_blank" rel="noreferrer">Preview PDF</a>
      <a className="quote-link" href={pdf}>Download PDF</a><PrintQuotation /></div>
    <QuotationDocument quote={quote} />
    <QuotationClientResponse key={token} token={token} status={quote.status} />
  </main>;
}
