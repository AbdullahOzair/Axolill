"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { QuotationDocument } from "@/components/quotation-document";
import { useLoader } from "@/lib/use-api";
import type { quotationDetail } from "@/lib/quotation-store";
import { publicQuotation } from "@/lib/quotation-public";
import { calculateQuote, formatQuoteMoney, quoteDateToday, QUOTE_LABELS } from "@/lib/quotations";
import { adminQuotePath, Decimal, errorText, Field, quoteApi, QuoteErrorMessage, requestQuote, Section, stamp } from "./shared";

type Detail = Awaited<ReturnType<typeof quotationDetail>>;
type Share = { url: string; code: string; expires: number };

export function QuoteDetail({ id, preview }: { id:string; preview:boolean }) {
  const loader=useLoader(()=>requestQuote<Detail>(quoteApi+"/"+id));
  return <AdminPage eyebrow="Quotations" title={loader.data ? loader.data.quote.number : "Quotation"}
    description={loader.data ? "Revision "+loader.data.quote.revision+" · "+QUOTE_LABELS[loader.data.quote.status] : undefined}
    action={<Link className="quote-link quote-no-print" href={adminQuotePath+"/all"}>All quotations</Link>}>
    {loader.loading && <p role="status">Loading quotation…</p>}
    {loader.error && <><QuoteErrorMessage value={loader.error}/><Button onClick={loader.reload}>Retry</Button></>}
    {loader.data && <DetailActions key={loader.data.quote.id} data={loader.data} refresh={loader.reload} preview={preview}/>}
  </AdminPage>;
}

function DetailActions({ data, refresh, preview }: { data:Detail; refresh:()=>void; preview:boolean }) {
  const {quote,history,revisions,conversion,receipts,links}=data;
  const browser=useRouter();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [share,setShare]=useState<Share|null>(null);
  const [note,setNote]=useState("");
  const [payment,setPayment]=useState(0);
  const [showDoc,setShowDoc]=useState(preview);
  const pdf=quoteApi+"/"+quote.id+"/pdf";
  const amount=(value:number)=>formatQuoteMoney(value,quote.currency,quote.digits);
  const latest=revisions[0]?.id===quote.id;
  const actionable=latest && !quote.archived;
  const totals=calculateQuote(quote.input);
  const projects = useLoader(async ()=>{
    if (quote.status!=="accepted" || !quote.clientId) return [];
    const result=await requestQuote<{ projects:{id:string;name:string;clientId:string}[] }>("/api/projects");
    return result.projects.filter(item=>item.clientId===quote.clientId);
  });
  const enabled = !busy;
  const delivered=["sent","viewed"].includes(quote.status);
  const eligibleShare=actionable && ["approved","sent","viewed"].includes(quote.status);
  const receives=receipts.reduce((sum,item)=>sum+item.amount,0);
  const billed=quote.oneTime||quote.monthly;

  async function perform(action:string,extra:Record<string,unknown>={}) {
    if (busy) return;
    setBusy(true);setError("");setMessage("");
    try {
      const result=await requestQuote<{quote?:{id:string};url?:string;code?:string;expires?:number;number?:string}>(
        quoteApi+"/"+quote.id,"POST",{action,version:quote.version,...extra});
      if (result.url && result.code && result.expires) setShare({url:result.url,code:result.code,expires:result.expires});
      else if (result.quote && result.quote.id!==quote.id) { browser.push(adminQuotePath+"/"+result.quote.id+"/edit"); return; }
      else if(action==="delete") { browser.replace(adminQuotePath+"/all"); return; }
      else {setNote("");setMessage(result.number ? "Created invoice "+result.number : "Quotation updated.");}
      refresh();
    } catch(e){setError(errorText(e));} finally {setBusy(false);}
  }
  const confirmAction=(kind:string,prompt:string)=>{if(window.confirm(prompt)) void perform(kind);};
  const saveInvoice=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    void perform("invoice",{projectId:String(form.get("project")??""),due:String(form.get("due")??"")});
  };
  async function copy(value:string,message:string) {
    try {await navigator.clipboard.writeText(value);setMessage(message);}
    catch {setError("Clipboard access is unavailable. Select and copy the text manually.");}
  }
  const styledBreakdown = [quote.number+" / Revision "+quote.revision,quote.input.title,"One-time total: "+amount(quote.oneTime),
    ...(quote.monthly?[ "Monthly total: "+amount(quote.monthly) ]:[]),
    ...totals.milestones.filter(item=>item.share>0 && quote.oneTime>0).map(item=>item.name+": "+amount(item.amount)+(item.due?" due "+item.due:""))].join("\n");
  const emailBody = "Hello "+quote.input.client.name+",\n\nPlease review quotation "+quote.number+" revision "+quote.revision+":\n"+(share?.url??"")+"\n\nYou will receive your verification code separately.\n\n"+quote.branding.company;
  const emailDraft = share ? "mailto:"+encodeURIComponent(quote.input.client.email)+"?subject="+encodeURIComponent("Quotation "+quote.number)+"&body="+encodeURIComponent(emailBody) : null;

  return <div className="quote-stack">
    <div className="quote-stack quote-no-print">
      <QuoteErrorMessage value={error}/>{message && <p role="status">{message}</p>}
      <div className="quote-kpis">
        <div><span>Client</span><strong>{quote.input.client.name}</strong><small>{quote.input.client.company || quote.input.client.email}</small></div>
        <div><span>One-time quote</span><strong>{amount(quote.oneTime)}</strong><small>Includes applicable tax</small></div>
        <div><span>Monthly quote</span><strong>{amount(quote.monthly)}</strong><small>Recurring charges</small></div>
        <div><span>Validity</span><strong>{quote.expiry}</strong><small>Issued {quote.issue}</small></div>
      </div>
      <Section title={quote.input.title}>
        <div className="quote-actions">
          {actionable && quote.storedStatus==="draft" && <Link className="quote-link" href={adminQuotePath+"/"+quote.id+"/edit"}>Edit draft</Link>}
          <Button variant="outline" onClick={()=>setShowDoc(!showDoc)}>{showDoc?"Hide document":"View document"}</Button>
          <a className="quote-link" href={pdf+"?view=1"} target="_blank" rel="noreferrer">Preview PDF</a>
          <a className="quote-link" href={pdf}>Download PDF</a>
          <Button variant="outline" onClick={()=>{setShowDoc(true);requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));}}>Print</Button>
          <Button variant="outline" onClick={()=>void copy(styledBreakdown,"Breakdown copied.")}>Copy breakdown</Button>
          <Button variant="outline" disabled={!enabled} onClick={()=>void perform("duplicate")}>Duplicate</Button>
          {actionable && !["draft","invoiced"].includes(quote.storedStatus) && <Button variant="outline" disabled={!enabled}
            onClick={()=>confirmAction("revision","Create a new draft revision? Existing links will be superseded while the new revision is active.")}>Create revision</Button>}
        </div>
        {quote.leadId && <Link className="text-sm underline" href="/admin/conversions">Original inquiry or lead is linked to this quotation</Link>}
      </Section>

      {actionable && <Section title="Review and delivery">
        <div className="quote-actions">
          {quote.status==="draft" && <Button disabled={!enabled} onClick={()=>void perform("submit",{note:""})}>Submit for approval</Button>}
          {quote.status==="pending_approval" && <Button disabled={!enabled} onClick={()=>void perform("approve",{note:""})}>Approve for sending</Button>}
          {["pending_approval","approved"].includes(quote.status) && <Button variant="outline" disabled={!enabled} onClick={()=>void perform("return",{note:""})}>Return to draft</Button>}
          {eligibleShare && !share && <Button variant="outline" disabled={!enabled} onClick={()=>void perform("share",{days:30})}>Create secure link</Button>}
          {["draft","pending_approval","approved","sent","viewed","revision_requested","expired"].includes(quote.status) &&
            <Button variant="ghost" disabled={!enabled} onClick={()=>{if(window.confirm("Cancel this quotation? Outstanding links will stop working.")) void perform("cancel",{note:""});}}>Cancel quotation</Button>}
        </div>
        {share && <div className="quote-secret">
          <p className="font-semibold">Secure link and verification code</p>
          <p className="text-sm">Copy the code now. Give it to the verified recipient through a separate channel. This link expires {stamp(share.expires)}.</p>
          <Field label="Quotation link"><input readOnly value={share.url}/></Field>
          <Field label="Recipient verification code"><input readOnly value={share.code}/></Field>
          <div className="quote-actions"><Button variant="outline" onClick={()=>void copy(share.url,"Quotation link copied.")}>Copy link</Button>
            <Button variant="outline" onClick={()=>void copy(share.code,"Verification code copied.")}>Copy code</Button>
            {emailDraft && <a className="quote-link" href={emailDraft}>Open email draft</a>}</div>
          {quote.status==="approved" && <p className="text-sm">Record confirmed delivery below to activate this link for the recipient.</p>}
        </div>}
        {quote.status==="approved" && <>
          <Field label="Delivery confirmation"><textarea placeholder="Record when and how you verified sending, or log a delivery failure." value={note} onChange={e=>setNote(e.target.value)} maxLength={1200}/></Field>
          <div className="quote-actions"><Button disabled={!enabled || !note.trim()} onClick={()=>void perform("sent",{note})}>Record confirmed delivery</Button>
            <Button variant="outline" disabled={!enabled || !note.trim()} onClick={()=>void perform("delivery_failure",{note})}>Record delivery failure</Button></div>
        </>}
        {delivered && <>
          <Field label="Verified client response"><textarea placeholder="Record who responded, when, and how you verified it." value={note} onChange={e=>setNote(e.target.value)} maxLength={1200}/></Field>
          <div className="quote-actions">{([["accept","Record acceptance"],["revise","Record change request"],["decline","Record decline"]] as const).map(([action,label])=>
            <Button key={action} variant="outline" disabled={!enabled || !note.trim()} onClick={()=>{if(window.confirm(label+" for this revision?")) void perform(action,{note});}}>{label}</Button>)}</div>
        </>}
      </Section>}

      {links.length>0 && <Section title="Secure links">
        {links.map(link=><div className="quote-split" key={link.id}><p className="text-sm">Expires {stamp(link.expiresAt)} · {link.revokedAt?"Revoked":link.usedAt?"Responded":link.viewedAt?"Viewed":"Unused"}</p>
          {!link.revokedAt && <Button variant="outline" size="sm" disabled={!enabled} onClick={()=>{if(window.confirm("Revoke this quotation link?")) void perform("revoke",{shareId:link.id});}}>Revoke link</Button>}</div>)}
      </Section>}

      {actionable && quote.status==="accepted" && <Section title="Invoice conversion">
        {quote.clientId ? <form className="quote-stack" onSubmit={saveInvoice}>
          <p className="text-sm">A draft invoice will be created for {amount(billed)}. {quote.oneTime && quote.monthly ? "Monthly recurring charges remain in the quotation schedule." : quote.monthly ? "This covers the first month." : ""}</p>
          {projects.error && <QuoteErrorMessage value={projects.error}/>}
          <div className="quote-grid"><Field label="Client project"><select name="project"><option value="">Create a project from the quotation</option>
            {projects.data?.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
            <Field label="Invoice due date"><input name="due" type="date" defaultValue={quoteDateToday()} required /></Field></div>
          <div><Button type="submit" disabled={!enabled || projects.loading}>Create draft invoice</Button></div>
        </form> : <p>This quotation is issued to a prospect. Link a client account in a new draft revision before invoicing.</p>}
      </Section>}
      {conversion && <Section title="Invoice and actual payments">
        <p className="text-sm">{conversion.number??"Linked invoice unavailable"} · {conversion.status??"Archived record"}</p>
        <p>Recorded payments {amount(receives)} of {amount(billed)}</p>
        {receipts.map(item=><p className="text-sm" key={item.id}>{item.receivedOn} · {item.receipt} · {amount(item.amount)}</p>)}
        {conversion.invoiceId && receives<billed && <form className="quote-stack" onSubmit={event=>{
          event.preventDefault();const values=new FormData(event.currentTarget);
          void perform("payment",{amount:payment,receipt:String(values.get("receipt")),receivedOn:String(values.get("date"))});
        }}>
          <div className="quote-grid"><Field label="Payment received"><Decimal value={payment} digits={quote.digits} max={billed-receives} onChange={setPayment}/></Field>
            <Field label="Receipt reference"><input required name="receipt" maxLength={100}/></Field>
            <Field label="Date received"><input required type="date" name="date" max={quoteDateToday()} defaultValue={quoteDateToday()}/></Field></div>
          <div><Button type="submit" disabled={!enabled || !payment}>Record payment received</Button></div>
        </form>}
      </Section>}

      <Section title="Internal profitability">
        {([["One-time",totals.oneTime],["Monthly",totals.monthly]] as const).map(([label,total])=><p className="text-sm" key={label}>{label} · Cost {amount(total.costs)} · Net {amount(total.net)} · Profit {amount(total.profit)}
          {total.margin!==null && " ("+(total.margin*100).toFixed(1)+"%)"}</p>)}
        {quote.input.privateNotes && <p className="whitespace-pre-wrap text-sm">{quote.input.privateNotes}</p>}
      </Section>
      <div className="quote-grid">
        <Section title="Revisions"><ul className="quote-history">{revisions.map(item=><li key={item.id}>
          <Link className="underline" href={adminQuotePath+"/"+item.id}>Revision {item.revision}</Link> · {QUOTE_LABELS[item.status]}
        </li>)}</ul></Section>
        <Section title="Activity"><ul className="quote-history">{history.map(item=><li key={item.id}>
          <strong>{item.kind.replaceAll("_"," ")}</strong> · {stamp(item.createdAt)}{item.actor && " · "+item.actor}
          {item.details && <p>{item.details}</p>}
        </li>)}</ul></Section>
      </div>
      <div className="quote-actions">
        {quote.archived ? <Button variant="outline" disabled={!enabled} onClick={()=>void perform("restore")}>Restore from archive</Button> :
          <Button variant="outline" disabled={!enabled} onClick={()=>confirmAction("archive","Archive this quotation and deactivate its links?")}>Archive quotation</Button>}
        {quote.storedStatus==="draft" && !quote.sentAt && <Button variant="destructive" disabled={!enabled} onClick={()=>confirmAction("delete","Delete this unsent draft? The number and audit history will be retained.")}>Delete draft</Button>}
      </div>
    </div>
    {showDoc && <QuotationDocument quote={publicQuotation(quote)}/>}
  </div>;
}
