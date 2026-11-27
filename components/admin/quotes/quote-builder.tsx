"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { useLoader } from "@/lib/use-api";
import type { quotationOptions } from "@/lib/quotation-api";
import type { quotationDetail } from "@/lib/quotation-store";
import { calculateQuote, formatQuoteMoney, newQuoteLine, quoteCostKeys, quoteInputSchema, quoteLineAmount, quoteUnits,
  type QuoteInput, type QuoteLine } from "@/lib/quotations";
import { adminQuotePath, Decimal, errorText, Field, QuoteErrorMessage, quoteApi, requestQuote, Section } from "./shared";

type Options = Awaited<ReturnType<typeof quotationOptions>>;
type Detail = Awaited<ReturnType<typeof quotationDetail>>;
const paymentPlans = { upfront: "Full upfront", advance: "Advance and final", three: "Three stages", custom: "Custom milestones", monthly: "Monthly recurring" } as const;

export function QuoteBuilder({ id, source }: { id?: string; source?: string }) {
  const loader = useLoader(() => Promise.all([
    requestQuote<Options>(quoteApi + "/options" + (source ? "?source=" + encodeURIComponent(source) : "")),
    id ? requestQuote<Detail>(quoteApi + "/" + id) : null,
  ]));
  const details = loader.data?.[1];
  const options = loader.data?.[0];
  const locked = details && (details.quote.storedStatus !== "draft" || details.quote.archived);
  return <AdminPage eyebrow="Quotations" title={id ? "Edit draft" : "Create quotation"}>
    {loader.loading && <p role="status">Loading quotation builder…</p>}
    {loader.error && <><QuoteErrorMessage value={loader.error} /><Button onClick={loader.reload}>Retry</Button></>}
    {locked && <Link href={adminQuotePath + "/" + id}>Open locked quotation</Link>}
    {options && !locked && <Editor key={id ?? source ?? "new"} options={options} existing={details?.quote} />}
  </AdminPage>;
}

function Editor({ options, existing }: { options: Options; existing?: Detail["quote"] }) {
  const router = useRouter();
  const defaults = () => existing ? { ...existing.input, createClient: false, clientId: existing.clientId, inquiryId: existing.leadId, assigneeId: existing.assigneeId } : options.input;
  const [input, set] = useState(defaults);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const key = "axonill.quote.draft." + (existing?.id ?? input.inquiryId ?? "new") + "." + (existing?.version ?? 0);
  const [recover, setRecover] = useState<QuoteInput | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) setRecover(JSON.parse(stored) as QuoteInput);
    } catch { /* Draft recovery may be unavailable in private browser modes. */ }
  }, [key]);

  function update(next: QuoteInput) {
    set(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* Saving remains available through the API. */ }
  }
  const patch = <K extends keyof QuoteInput,>(field: K, value: QuoteInput[K]) => update({ ...input, [field]: value });
  const client = <K extends keyof QuoteInput["client"],>(field: K, value: QuoteInput["client"][K]) => patch("client", { ...input.client, [field]: value });
  const line = (index: number, value: Partial<QuoteLine>) => patch("lines", input.lines.map((item, n) => index === n ? { ...item, ...value } : item));
  const digits = input.currency === existing?.currency ? existing.digits : options.settings.currencies.find(c => c.code === input.currency)?.digits ?? 2;
  const money = (value: number) => formatQuoteMoney(value,input.currency,digits);
  const summary = (() => { try { return { value: calculateQuote(input), error: "" }; } catch (e) { return { value: null, error: errorText(e) }; } })();

  function setCurrency(code: string) {
    if (code === input.currency) return;
    const nextDigits = code === existing?.currency ? existing.digits : options.settings.currencies.find(item => item.code === code)?.digits ?? 2;
    const amounts = [input.discountType === "fixed" ? input.discount : 0, input.discountType === "fixed" ? input.monthlyDiscount : 0,
      ...Object.values(input.costs), ...input.lines.flatMap(item => [item.unitPrice,item.cost])];
    const multiplier = 10 ** (nextDigits - digits);
    if (amounts.some(value => !Number.isSafeInteger(value * multiplier) || value * multiplier > 99_999_999_999)) {
      setError("Adjust the entered amounts to the precision of the new currency first.");
      return;
    }
    if (amounts.some(Boolean) && !window.confirm("Keep the entered prices with the new currency label? No exchange rate will be applied.")) return;
    update({ ...input, currency: code, discount: input.discountType === "fixed" ? input.discount*multiplier : input.discount,
      monthlyDiscount: input.discountType === "fixed" ? input.monthlyDiscount*multiplier : input.monthlyDiscount,
      costs: Object.fromEntries(quoteCostKeys.map(name=>[name,input.costs[name]*multiplier])) as QuoteInput["costs"],
      lines:input.lines.map(item=>({...item,unitPrice:item.unitPrice*multiplier,cost:item.cost*multiplier})) });
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = quoteInputSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue.path.join(" / ") + " · " + issue.message);
      return;
    }
    if (!summary.value) { setError(summary.error); return; }
    setBusy(true); setError("");
    try {
      const result = await requestQuote<{ quote: Detail["quote"] }>(
        existing ? quoteApi + "/" + existing.id : quoteApi,
        existing ? "PATCH" : "POST", existing ? { input:parsed.data,version:existing.version } : parsed.data);
      try { sessionStorage.removeItem(key); } catch { /* Already saved. */ }
      const preview = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "preview";
      router.replace(adminQuotePath + "/" + result.quote.id + (preview ? "?preview=1" : ""));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  const selectClient = (id: string) => {
    const match = options.clients.find(c=>c.id===id);
    update({ ...input, clientId:match?.id ?? null, createClient:!match,
      client: match ? {...input.client,name:match.name,email:match.email,company:match.company??"",phone:match.phone??""} : input.client });
  };
  const updateLineOrder = (from: number, to: number) => {
    if (to < 0 || to >= input.lines.length) return;
    const items = [...input.lines];
    items.splice(to,0,items.splice(from,1)[0]);
    patch("lines",items);
  };
  const availableCurrencies = new Set(options.settings.currencies.map(item=>item.code).concat(existing?.currency ?? []));
  return <form className="quote-builder" onSubmit={save}>
    <div className="quote-stack">
      {recover && <div className="quote-panel quote-actions"><p>Unsaved changes are available in this tab.</p>
        <Button type="button" onClick={()=>{update(recover);setRecover(null);}}>Recover changes</Button>
        <Button type="button" variant="outline" onClick={()=>{try { sessionStorage.removeItem(key); } catch {} setRecover(null);}}>Discard backup</Button></div>}
      <Section title="Client information">
        <Field label="Existing client"><select value={input.clientId ?? ""} onChange={e=>selectClient(e.target.value)}>
          <option value="">Use prospect details</option>{options.clients.map(c=><option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
        </select></Field>
        {!input.clientId && <label className="quote-checkbox"><input type="checkbox" checked={input.createClient} onChange={e=>patch("createClient",e.target.checked)} /> Create or link a client using this email</label>}
        <div className="quote-grid">
          {(["name","company","email","phone","country","address"] as const).map(field=><Field key={field} label={field === "address" ? "Billing address" : field[0].toUpperCase()+field.slice(1)}>
            <input required={["name","email","country"].includes(field)} readOnly={field==="email" && Boolean(input.clientId)} type={field==="email" ? "email" : "text"} value={input.client[field]} onChange={e=>client(field,e.target.value)} />
          </Field>)}
          <Field label="Client region"><select value={input.client.region} onChange={e=>client("region",e.target.value as QuoteInput["client"]["region"])}>
            <option value="national">National</option><option value="international">International</option></select></Field>
        </div>
      </Section>
      <Section title="Project information">
        {input.inquiryId && <p className="text-sm">Linked inquiry or contact lead{options.sourceBudget && " · Stated budget " + options.sourceBudget.currency + " " + String(options.sourceBudget.amount)}</p>}
        <div className="quote-grid">
          <Field label="Project title"><input value={input.title} onChange={e=>patch("title",e.target.value)} required maxLength={180} /></Field>
          <Field label="Delivery timeline"><input value={input.timeline} onChange={e=>patch("timeline",e.target.value)} maxLength={180} /></Field>
          <Field label="Issue date"><input type="date" required value={input.issue} onChange={e=>patch("issue",e.target.value)} /></Field>
          <Field label="Valid through"><input type="date" required min={input.issue} value={input.expiry} onChange={e=>patch("expiry",e.target.value)} /></Field>
          <Field label="Assigned team member"><select value={input.assigneeId??""} onChange={e=>patch("assigneeId",e.target.value||null)}><option value="">Unassigned</option>{options.team.map(member=><option value={member.id} key={member.id}>{member.name}</option>)}</select></Field>
          <Field label="Apply template"><select value="" onChange={e=>{
            const template = options.templates.find(item=>item.id===e.target.value)?.data;
            if (!template) return;
            const { description,scope,deliverables,timeline,terms,instructions } = template;
            update({...input,description,scope,deliverables,timeline,terms,instructions});
          }}><option value="">Choose a template</option>{options.templates.map(template=><option value={template.id} key={template.id}>{template.data.name}</option>)}</select></Field>
        </div>
        <Field label="Project description"><textarea value={input.description} maxLength={2400} onChange={e=>patch("description",e.target.value)} /></Field>
      </Section>
      <Section title="Services and charges">
        {input.lines.map((item,index)=><fieldset className="quote-line" key={index}>
          <legend>Line {index+1} · {money(quoteLineAmount(item))}{item.optional ? " · optional" : item.recurring ? " / month" : ""}</legend>
          <div className="quote-actions">
            <Button size="sm" type="button" variant="outline" disabled={index===0} onClick={()=>updateLineOrder(index,index-1)}>Move up</Button>
            <Button size="sm" type="button" variant="outline" disabled={index===input.lines.length-1} onClick={()=>updateLineOrder(index,index+1)}>Move down</Button>
            <Button size="sm" type="button" variant="outline" disabled={input.lines.length>=36} onClick={()=>patch("lines",[...input.lines.slice(0,index+1),{...item},...input.lines.slice(index+1)])}>Duplicate</Button>
            <Button size="sm" type="button" variant="ghost" disabled={input.lines.length===1} onClick={()=>patch("lines",input.lines.filter((_,i)=>i!==index))}>Remove</Button>
          </div>
          <div className="quote-grid">
            <Field label="Catalogue service"><select value={item.serviceId??""} onChange={e=>{
              const chosen = options.services.find(s=>s.id===e.target.value);
              line(index,chosen ? { serviceId:chosen.id,name:chosen.title,category:chosen.title,description:chosen.summary.slice(0,900) } : {serviceId:null});
            }}><option value="">Custom item</option>{options.services.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></Field>
            <Field label="Apply pricing preset"><select value="" onChange={e=>{
              const preset=options.presets.find(p=>p.id===e.target.value)?.data;
              if (!preset) return;
              const { timeline, currency, region, ...values } = preset;
              void currency; void region;
              update({ ...input, timeline: input.timeline || timeline, lines: input.lines.map((row,i)=>i===index ? {...row,...values} : row) });
            }}><option value="">Choose matching preset</option>{options.presets.filter(p=>p.data.currency===input.currency && p.data.region===input.client.region
              && options.settings.currencies.find(c=>c.code===p.data.currency)?.digits===digits)
              .map(p=><option key={p.id} value={p.id}>{p.data.name} · {p.data.recurring ? "monthly" : "one-time"}</option>)}</select></Field>
            <Field label="Line name"><input required maxLength={180} value={item.name} onChange={e=>line(index,{name:e.target.value})} /></Field>
            <Field label="Category"><input maxLength={100} value={item.category} onChange={e=>line(index,{category:e.target.value})} /></Field>
            <Field label="Quantity"><Decimal value={item.quantity} digits={3} max={1_000_000} onChange={quantity=>line(index,{quantity})} /></Field>
            <Field label="Unit"><select value={item.unit} onChange={e=>line(index,{unit:e.target.value as QuoteLine["unit"]})}>{quoteUnits.map(unit=><option key={unit}>{unit}</option>)}</select></Field>
            {item.unit==="Custom" && <Field label="Custom unit"><input value={item.customUnit} maxLength={36} onChange={e=>line(index,{customUnit:e.target.value})} /></Field>}
            <Field label="Unit price"><Decimal value={item.unitPrice} digits={digits} onChange={unitPrice=>line(index,{unitPrice})} /></Field>
            <Field label="Line discount (%)"><Decimal value={item.discount} max={10000} onChange={discount=>line(index,{discount})} /></Field>
            <Field label="Total internal cost for line"><Decimal value={item.cost} digits={digits} onChange={cost=>line(index,{cost})} /></Field>
          </div>
          <Field label="Line description"><textarea value={item.description} maxLength={900} onChange={e=>line(index,{description:e.target.value})} /></Field>
          <div className="quote-actions">{([["optional","Optional (excluded from totals)"],["recurring","Monthly recurring"],["taxable","Taxable"]] as const).map(([field,label])=>
            <label key={field} className="quote-checkbox"><input type="checkbox" checked={item[field]} onChange={e=>line(index,{[field]:e.target.checked})} /> {label}</label>)}</div>
        </fieldset>)}
        <Button type="button" variant="outline" disabled={input.lines.length>=36} onClick={()=>patch("lines",[...input.lines,newQuoteLine()])}>Add service or charge</Button>
      </Section>
      <Section title="Scope and terms">
        {(["scope","deliverables","terms","instructions"] as const).map(field=><Field key={field} label={{scope:"Scope",deliverables:"Deliverables",terms:"Terms and conditions",instructions:"Payment instructions"}[field]}>
          <textarea value={input[field]} maxLength={field==="instructions" ? 2000 : 4000} onChange={e=>patch(field,e.target.value)} />
        </Field>)}
      </Section>
      <Section title="Payment schedule">
        <Field label="Payment arrangement"><select value={input.paymentPlan} onChange={e=>patch("paymentPlan",e.target.value as QuoteInput["paymentPlan"])}>
          {Object.entries(paymentPlans).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></Field>
        {["advance","three","monthly"].includes(input.paymentPlan) && <Field label={"Advance " + input.advance/100 + "%"}>
          <input type="range" min={0} max={10000} step={100} value={input.advance} onChange={e=>patch("advance",Number(e.target.value))} />
        </Field>}
        {input.paymentPlan==="custom" && <>
          <p>Scheduled total · {input.milestones.reduce((total,item)=>total+item.share,0)/100}% of one-time charges</p>
          {input.milestones.map((item,index)=>{
            const change = (value: Partial<typeof item>) => patch("milestones",input.milestones.map((entry,i)=>i===index?{...entry,...value}:entry));
            return <fieldset key={index} className="quote-line"><legend>Milestone {index+1}</legend>
              <div className="quote-grid"><Field label="Name"><input value={item.name} onChange={e=>change({name:e.target.value})} /></Field>
                <Field label="Percentage"><Decimal value={item.share} max={10000} onChange={share=>change({share})} /></Field>
                <Field label="Due date"><input type="date" value={item.due} onChange={e=>change({due:e.target.value})} /></Field>
                <Field label="Description"><input value={item.description} onChange={e=>change({description:e.target.value})} /></Field></div>
              <Button variant="ghost" type="button" onClick={()=>patch("milestones",input.milestones.filter((_,i)=>i!==index))}>Remove milestone</Button>
            </fieldset>;
          })}
          <Button type="button" variant="outline" disabled={input.milestones.length>=12} onClick={()=>patch("milestones",[...input.milestones,{name:"",share:0,due:"",description:""}])}>Add milestone</Button>
        </>}
      </Section>
      <Section title="Internal expenses">
        <div className="quote-grid">{quoteCostKeys.map(field=><Field key={field} label={field[0].toUpperCase()+field.slice(1)}>
          <Decimal value={input.costs[field]} digits={digits} onChange={value=>patch("costs",{...input.costs,[field]:value})} />
        </Field>)}</div>
        <Field label="Private notes"><textarea maxLength={2000} value={input.privateNotes} onChange={e=>patch("privateNotes",e.target.value)} /></Field>
      </Section>
    </div>
    <aside className="quote-summary quote-stack">
      <Section title="Financial summary">
        <Field label="Currency"><select value={input.currency} onChange={e=>setCurrency(e.target.value)}>{[...availableCurrencies].map(code=><option key={code}>{code}</option>)}</select></Field>
        <Field label="Discount type"><select value={input.discountType} onChange={e=>update({...input,discountType:e.target.value as QuoteInput["discountType"],discount:0,monthlyDiscount:0})}>
          <option value="fixed">Fixed amount</option><option value="percentage">Percentage</option></select></Field>
        <div className="quote-grid">{(["discount","monthlyDiscount"] as const).map(field=><Field key={field} label={(field==="discount" ? "One-time" : "Monthly") + (input.discountType==="percentage" ? " discount (%)" : " discount")}>
          <Decimal key={input.discountType+input.currency} value={input[field]} digits={input.discountType==="percentage" ? 2 : digits} max={input.discountType==="percentage" ? 10000 : undefined} onChange={value=>patch(field,value)} />
        </Field>)}</div>
        <label className="quote-checkbox"><input type="checkbox" checked={input.taxExempt} onChange={e=>patch("taxExempt",e.target.checked)} /> Tax exempt</label>
        {!input.taxExempt && <Field label="Tax (%)"><Decimal value={input.tax} max={10000} onChange={value=>patch("tax",value)} /></Field>}
        <QuoteErrorMessage value={summary.error} />
        {summary.value && ([["One-time",summary.value.oneTime],["Monthly",summary.value.monthly]] as const).map(([label,total])=><dl className="quote-total" key={label}>
          <div><dt>{label} subtotal</dt><dd>{money(total.subtotal)}</dd></div>
          <div><dt>Discount</dt><dd>{money(total.discount)}</dd></div>
          <div><dt>Tax</dt><dd>{money(total.tax)}</dd></div>
          <div><dt>{label} total</dt><dd>{money(total.total)}</dd></div>
        </dl>)}
      </Section>
      {summary.value && <Section title="Payment breakdown">
        <div className="quote-bar" aria-hidden="true">{summary.value.milestones.map((item,index)=><span key={index} style={{flexBasis:item.share/100+"%"}} />)}</div>
        <ul className="text-sm">{summary.value.milestones.map((item,index)=><li key={index}>{item.name || "Milestone"} · {item.share/100}% · {money(item.amount)}</li>)}</ul>
        {summary.value.monthly.total>0 && <p>{money(summary.value.monthly.total)} per month</p>}
      </Section>}
      {summary.value && <Section title="Internal profitability">
        {([["One-time",summary.value.oneTime],["Monthly",summary.value.monthly]] as const).map(([label,total])=><div className="text-sm" key={label}>
          <p className="font-semibold">{label}</p>
          <p>Estimated cost {money(total.costs)}</p><p>Net revenue {money(total.net)}</p>
          <p>Gross profit {money(total.profit)}{total.margin!==null && " · "+(total.margin*100).toFixed(1)+"%"}</p>
          {total.margin!==null && total.margin*10000 < options.settings.margin && <p className="text-destructive">Below preferred margin ({options.settings.margin/100}%).</p>}
        </div>)}
      </Section>}
      <Section title="Save quotation">
        <QuoteErrorMessage value={error} />
        <div className="quote-actions"><Button disabled={busy} type="submit">{busy ? "Saving…" : "Save draft"}</Button>
          <Button disabled={busy} type="submit" value="preview" variant="outline">Save and preview</Button></div>
      </Section>
    </aside>
  </form>;
}
