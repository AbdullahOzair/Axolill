"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { QuoteStatus } from "@/lib/quotations";

export function PrintQuotation() {
  return <Button variant="outline" onClick={()=>window.print()}>Print document</Button>;
}

export function QuotationClientResponse({ token, endpoint, status, onResponse }: {token?:string;endpoint?:string;status:QuoteStatus;onResponse?:()=>void}) {
  const router = useRouter();
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [saved,setSaved] = useState(false);
  const url = endpoint ?? "/api/quotations/share/" + token;
  useEffect(()=>{
    if (token && status==="sent") void fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"view"})}).catch(()=>{});
  },[url,status,token]);

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saved) return;
    const data=new FormData(event.currentTarget);
    const choice=(event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    const action=choice==="decline" ? "decline" : choice==="revise" ? "revise" : "accept";
    if (action==="accept" && !window.confirm("Accept this quotation and the terms of this revision?")) return;
    setBusy(true);setError("");
    try {
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action,code:data.get("code"),comment:data.get("comment")})});
      const result=await response.json() as {error?:string};
      if (!response.ok) throw new Error(result.error??"Your response could not be recorded.");
      setSaved(true);if (onResponse) onResponse(); else router.refresh();
    } catch(e){setError(e instanceof Error?e.message:"Try again.");} finally {setBusy(false);}
  }
  if (saved) return <p role="status" className="quote-panel">Your response has been recorded.</p>;
  if (!["sent","viewed"].includes(status)) return null;
  return <form className="quote-panel quote-no-print" onSubmit={submit}>
    <h2>Respond to this quotation</h2>
    <label className="quote-field"><span>Recipient verification code</span>
      <input name="code" required autoComplete="one-time-code" minLength={32} maxLength={32} pattern="[A-Fa-f0-9]{32}" spellCheck={false} autoCapitalize="none" /></label>
    <p className="text-sm">Use the separate code provided by your Axonill contact.</p>
    <label className="quote-field"><span>Comment (optional)</span><textarea name="comment" maxLength={1200}/></label>
    {error && <p className="quote-error" role="alert">{error}</p>}
    <div className="quote-actions">
      <Button type="submit" value="accept" disabled={busy}>Accept quotation</Button>
      <Button type="submit" value="revise" variant="outline" disabled={busy}>Request changes</Button>
      <Button type="submit" value="decline" variant="outline" disabled={busy}>Decline</Button>
    </div>
  </form>;
}
