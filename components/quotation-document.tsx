import Image from "next/image";
import type { PublicQuote } from "@/lib/quotation-public";
import { formatQuoteMoney, QUOTE_LABELS, quoteLineAmount } from "@/lib/quotations";

export function QuotationDocument({ quote }: { quote: PublicQuote }) {
  const amount = (value: number) => formatQuoteMoney(value,quote.currency,quote.digits);
  return <article className="quote-document" aria-label="Quotation">
    <header className="quote-document-header">
      <div><Image src={quote.branding.logoKey ? "/api/media/" + quote.branding.logoKey : "/brand/mark.png"} alt="" width={40} height={40} unoptimized />
        <strong>{quote.branding.company}</strong></div>
      <span>{quote.number} · Revision {quote.revision}</span>
    </header>
    <p className="quote-document-meta">{QUOTE_LABELS[quote.status]} · Issued {quote.issue} · Valid through {quote.expiry}</p>
    <h1>{quote.title}</h1>
    {quote.description && <p>{quote.description}</p>}
    <div className="quote-document-info">
      <section><h2>Prepared for</h2><p>{quote.client.name}<br />{quote.client.company && <>{quote.client.company}<br /></>}
        {quote.client.email}{quote.client.phone && <><br />{quote.client.phone}</>}{quote.client.address && <><br />{quote.client.address}</>}<br />{quote.client.country}</p></section>
      {quote.timeline && <section><h2>Estimated delivery</h2><p>{quote.timeline}</p></section>}
    </div>
    {quote.scope && <section><h2>Scope</h2><p>{quote.scope}</p></section>}
    {quote.deliverables && <section><h2>Deliverables</h2><p>{quote.deliverables}</p></section>}
    <section><h2>Services</h2>
      <div className="quote-scroll"><table><thead><tr><th>Service</th><th>Quantity / unit</th><th>Unit price</th><th>Line amount</th></tr></thead>
        <tbody>{quote.lines.map((line,index)=><tr key={index}>
          <td><strong>{line.name}</strong>{line.optional && <small>Optional · excluded from totals</small>}{line.recurring && <small>Monthly</small>}
            {line.description && <small>{line.description}</small>}{line.discount>0 && <small>Line discount {line.discount/100}%</small>}</td>
          <td>{line.quantity/1000} / {line.unit==="Custom" ? line.customUnit : line.unit}</td><td>{amount(line.unitPrice)}</td>
          <td>{amount(quoteLineAmount({...line,serviceId:null,category:"",cost:0,taxable:false}))}</td>
        </tr>)}</tbody></table></div>
    </section>
    <div className="quote-document-info">
      {([["One-time charges",quote.oneTime],["Monthly recurring",quote.monthly]] as const).map(([label,total],index)=>index===0 || quote.lines.some(line=>line.recurring&&!line.optional) ? <section key={label}>
        <h2>{label}</h2><dl className="quote-total">
          <div><dt>Subtotal</dt><dd>{amount(total.subtotal)}</dd></div><div><dt>Discount</dt><dd>{amount(total.discount)}</dd></div>
          <div><dt>Tax</dt><dd>{amount(total.tax)}</dd></div><div><dt>Total</dt><dd>{amount(total.total)}</dd></div>
        </dl>
      </section> : null)}
    </div>
    {(quote.oneTime.total > 0 || quote.monthly.total > 0) && <section><h2>Payment schedule</h2>
      {quote.oneTime.total > 0 && <ul>{quote.milestones.filter(item=>item.share>0).map((item,index)=>
        <li key={index}>{item.name} · {item.share/100}% · {amount(item.amount)}{item.due && " · Due "+item.due}{item.description && <small>{item.description}</small>}</li>)}</ul>}
      {quote.monthly.total>0 && <p>{amount(quote.monthly.total)} per month</p>}
    </section>}
    {quote.instructions && <section><h2>Payment instructions</h2><p>{quote.instructions}</p></section>}
    {quote.terms && <section><h2>Terms and conditions</h2><p>{quote.terms}</p></section>}
    <section><h2>Business contact</h2>
      <p>{[quote.branding.address,quote.branding.email,quote.branding.phone].filter(Boolean).join("\n")}</p>
      {quote.branding.registration && <p>Registration {quote.branding.registration}</p>}
      {quote.branding.taxId && <p>Tax ID {quote.branding.taxId}</p>}
      {quote.branding.footer && <p>{quote.branding.footer}</p>}
    </section>
  </article>;
}
