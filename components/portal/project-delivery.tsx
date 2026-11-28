"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatQuoteMoney } from "@/lib/quotations";
import { folderNames } from "@/lib/active-project";
import { Field } from "./request-wizard";
import { Badge, Empty, EntryForm, FileRows, WorkPanel, Attachment, day, portalPath, projectEndpoint, postProject, sendEntry, status, uploadProjectFile, type ActiveData } from "./project-ui";

export function Milestones({data,reload}:{data:ActiveData;reload:()=>void}) {
  if(!data.milestones.length)return <WorkPanel title="No milestones yet"><Empty>Milestones will appear here when Axonill adds them.</Empty></WorkPanel>;
  return <>{data.milestones.map((item)=>{
    const files=data.files.filter((file)=>file.milestoneId===item.id);
    const current=files.filter((file)=>!files.some((other)=>other.previousVersionId===file.id));
    const history=data.events.filter((event)=>event.kind==="milestone_review"&&event.data.reference===item.id);
    return <WorkPanel title={item.title} key={item.id} id={item.id}>
      <div className="axp-row"><p className="axp-note">Target {day(item.dueDate)} · Version {item.reviewVersion}</p><Badge value={item.status}/></div>
      <p className="axp-prewrap">{item.description}</p>
      {current.length>0&&<FileRows files={current} id={data.project.id}/>}
      {files.length>current.length&&<details className="axw-disclosure"><summary>Previous file versions</summary><FileRows files={files.filter((file)=>!current.includes(file))} id={data.project.id}/></details>}
      {item.status==="awaiting_approval"&&<EntryForm label="Submit decision" submit={async(values)=>{
        const target=values.get("decision")==="changes"?"changes_requested":"approved";
        if(target==="approved"&&!window.confirm("Approve version "+item.reviewVersion+" of "+item.title+"?"))throw new Error("Approval cancelled.");
        await postProject(data.project.id,{action:"review",id:item.id,version:item.reviewVersion,status:target,feedback:values.get("feedback")});reload();
      }}>
        <Field label="Your decision"><select name="decision" required><option value="">Choose a decision</option><option value="approve">Approve this version</option><option value="changes">Request changes</option></select></Field>
        <Field label="Feedback (required when requesting changes)"><textarea name="feedback" rows={3} maxLength={2000}/></Field>
      </EntryForm>}
      {history.length>0&&<details className="axw-disclosure"><summary>Review history ({history.length})</summary><ul className="axp-list">
        {[...history].reverse().map((entry)=><li key={entry.id}><strong>{status(entry.state)} · Version {entry.data.milestoneVersion}</strong><p className="axp-note">{day(entry.createdAt,true)}</p>
          <p>{entry.data.body}</p>{entry.data.files?.length?<FileRows files={data.files.filter((file)=>entry.data.files?.includes(file.id))} id={data.project.id}/>:null}</li>)}</ul></details>}
    </WorkPanel>;
  })}</>;
}
export function Files({data,reload}:{data:ActiveData;reload:()=>void}) {
  const [query,search]=useState("");
  const [folder,filter]=useState("");
  const options=[...new Set([...folderNames,...data.files.map((item)=>item.folder)])];
  const files=data.files.filter((item)=>(!folder||item.folder===folder)&&item.name.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <WorkPanel title="Shared files"><div className="axp-fields">
      <Field label="Find a file"><input type="search" value={query} onChange={(event)=>search(event.target.value)} placeholder="Search by file name"/></Field>
      <Field label="Folder"><select value={folder} onChange={(event)=>filter(event.target.value)}><option value="">All folders</option>{options.map((item)=><option key={item}>{item}</option>)}</select></Field></div>
      {files.length?<FileRows files={files} id={data.project.id}/>:<Empty>{data.files.length?"No files match these filters.":"There are no files in this project yet."}</Empty>}
    </WorkPanel>
    <WorkPanel title="Upload a reference file"><EntryForm label="Upload file" submit={async(values)=>{
      const file=values.get("file");if(file instanceof File&&file.size)await uploadProjectFile(data.project.id,file);reload();
    }}><Attachment required/><p className="axp-note">PDF or image up to 25 MB. Your file will be shared with Axonill on this project.</p></EntryForm></WorkPanel>
  </>;
}
export function FinancialSummary({data}:{data:ActiveData}) {
  return <WorkPanel title="Project finances" link={{label:"Invoices & payments",href:portalPath(data.project.id,"invoices")}}>
    {data.financial.length?data.financial.map((item)=>{
      const fmt=(n:number)=>formatQuoteMoney(n,item.currency,item.digits);
      return <section className="axp-stack" key={item.currency+item.digits}>
        <div className="axp-row"><strong>{item.currency}</strong>{item.invoiced>0&&<span className="axp-note">{fmt(item.verified)} verified of {fmt(item.invoiced)} invoiced</span>}</div>
        {item.invoiced>0&&<progress className="axw-progress" value={Math.min(item.verified,item.invoiced)} max={item.invoiced} aria-label="Verified payments as a share of invoices"/>}
        <dl className="axp-summary">{[["Original agreed value",item.hasAgreement?fmt(item.original):"No linked agreement"],["Approved additional charges",fmt(item.extras)],
          ["Contracted one-time total",item.hasAgreement?fmt(item.contracted):"—"],["Issued invoices",fmt(item.invoiced)],["Verified payments",fmt(item.verified)],
          ["Outstanding invoice balance",fmt(item.outstanding)],["Remaining unbilled",item.hasAgreement?fmt(item.unbilled):"—"],["Recurring charges",fmt(item.monthly)+" / month"]]
          .map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>;
    }):<Empty>Your agreed project value and invoices will appear once they’re linked.</Empty>}
  </WorkPanel>;
}
export function Financial({data,reload}:{data:ActiveData;reload:()=>void}) {
  const [selected,setSelected]=useState("");
  const billSelected=data.invoices.find((bill)=>bill.id===selected);
  const id=data.project.id;
  const doc=(type:string,entry:string)=>projectEndpoint(id)+"?document="+type+"&entry="+entry;
  return <>
    <FinancialSummary data={data}/>
    {data.agreements.some((item)=>item.schedule.length>0)&&<WorkPanel title="Agreed payment schedule">
      {data.agreements.filter((item)=>item.schedule.length>0).map((item)=><div key={item.id}><Link href={"/portal/quotations/"+item.id}>{item.number}</Link>
        <ul className="axp-list">{item.schedule.map((step,index)=><li className="axp-row" key={index}><span>{step.name}{step.due&&" · "+day(step.due)}</span>
          <strong>{formatQuoteMoney(step.amount,item.currency,item.digits)}</strong></li>)}</ul></div>)}
    </WorkPanel>}
    <WorkPanel title="Invoices">
      {data.config.instructions&&<details className="axw-disclosure"><summary>Payment instructions</summary><p className="axp-prewrap">{data.config.instructions}</p></details>}
      {data.invoices.length?<ul className="axp-list">{data.invoices.map((bill)=><li key={bill.id} id={bill.id}>
        <div className="axp-row"><div><strong>Invoice {bill.number}</strong><p className="axp-note">Due {day(bill.dueDate)}{bill.recurring&&" ? Recurring invoice"}</p></div><Badge value={bill.displayStatus}/></div>
        <p>{formatQuoteMoney(bill.minor,bill.currency,bill.digits)} · {formatQuoteMoney(bill.balance,bill.currency,bill.digits)} outstanding</p>
        <div className="axp-actions"><a target="_blank" rel="noreferrer" href={doc("invoice",bill.id)+"&view=1"}>View invoice</a><a href={doc("invoice",bill.id)}>Download PDF</a>
          {bill.balance>0&&<Button variant="outline" size="sm" onClick={()=>{setSelected(bill.id);requestAnimationFrame(()=>window.document.getElementById("axw-proof")?.scrollIntoView({block:"nearest"}));}}>Submit payment proof</Button>}</div>
        {bill.payments.length>0&&<ul className="axp-list">{bill.payments.map((payment)=><li className="axp-row" key={payment.id}><span>{day(payment.receivedOn)} · {formatQuoteMoney(payment.amount,bill.currency,bill.digits)}</span>
          <a href={doc("receipt",payment.id)}>Download receipt</a></li>)}</ul>}
        {data.events.filter((entry)=>entry.kind==="proof"&&entry.data.invoiceId===bill.id).map((entry)=><div className="axp-row" id={entry.id} key={entry.id}>
          <p className="axp-note">Proof {entry.data.reference}{entry.data.extra&&" · "+entry.data.extra}</p><Badge value={entry.state}/></div>)}
      </li>)}</ul>:<Empty>Issued invoices will appear here.</Empty>}
    </WorkPanel>
    {billSelected&&<WorkPanel title={"Payment proof for "+billSelected.number} id="axw-proof"><EntryForm label="Send payment proof" submit={async(values)=>{
      await sendEntry(data,"proof",values,{invoiceId:billSelected.id,body:"Proof of payment"});setSelected("");reload();
    }}>
      <div className="axp-fields"><Field label={"Amount paid ("+billSelected.currency+")"}><input name="amount" inputMode="decimal" required/></Field>
        <Field label="Payment reference"><input name="reference" maxLength={120} required/></Field><Field label="Date paid"><input name="date" type="date" required/></Field><Attachment required/></div>
      <Button variant="ghost" type="button" className="axp-fit" onClick={()=>setSelected("")}>Cancel</Button>
    </EntryForm></WorkPanel>}
  </>;
}
