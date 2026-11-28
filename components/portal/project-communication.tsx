"use client";
import Link from "next/link";
import { moduleLabels } from "@/lib/active-project";
import { Field } from "./request-wizard";
import { Attachment, Badge, Empty, EntryAttachment, EntryForm, FileRows, WorkPanel, day, portalPath, projectEndpoint, postProject, sendEntry, type ActiveData, type Entry } from "./project-ui";

export function Conversation({data,reload,parent}:{data:ActiveData;reload:()=>void;parent?:Entry}) {
  const entries=data.events.filter((entry)=>entry.kind==="message"&&entry.data.parentId===(parent?.id??""));
  return <>
    {!parent&&data.link?.requestId&&<WorkPanel title="Before the project" link={{label:"Open original conversation",href:"/portal/messages/"+data.link.requestId}}>
      {data.requestMessages.length?<ul className="axp-list">{data.requestMessages.slice(-3).map((item)=><li key={item.id}><strong>{item.kind==="client_message"?"You":"Axonill"}</strong>
        <p className="axp-prewrap">{item.body}</p><p className="axp-note">{day(item.createdAt,true)}</p></li>)}</ul>:<Empty>Original request details and attachments remain available.</Empty>}
    </WorkPanel>}
    <WorkPanel title={parent?"Conversation":"Project messages"}>
      {entries.length?<ul className="axp-list">{entries.map((entry)=><li key={entry.id} id={entry.id}><div className="axp-row"><strong>{entry.own?"You":"Axonill"}</strong>
        <span className="axp-note">{day(entry.createdAt,true)}</span></div><p className="axp-prewrap">{entry.data.body}</p><EntryAttachment data={data} entry={entry}/></li>)}</ul>:
        <Empty>Use this conversation to ask a question or share an update.</Empty>}
      {(!parent||!["resolved","closed","declined"].includes(parent.state))&&<EntryForm label="Send message" submit={async(values)=>{
        await sendEntry(data,"message",values,{parentId:parent?.id??""});reload();
      }}><Field label="Your message"><textarea name="body" rows={3} maxLength={5000} required/></Field><Attachment/></EntryForm>}
    </WorkPanel>
  </>;
}

export function ClientRequests({kind,data,reload}:{kind:"change"|"support";data:ActiveData;reload:()=>void}) {
  const support=kind==="support";
  const entries=[...data.events].reverse().filter((item)=>item.kind===kind);
  return <>
    {support&&<WorkPanel title="Support coverage"><p>{data.config.supportCoverage||"Ask Axonill what support is included in your agreement."}</p>
      {data.config.supportThrough&&<p className="axp-note">Coverage through {day(data.config.supportThrough)}</p>}</WorkPanel>}
    <WorkPanel title={support?"Get help with this project":"Request a scope change"}>
      <EntryForm label={support?"Open support ticket":"Submit change request"} submit={async(values)=>{await sendEntry(data,kind,values);reload();}}>
        <Field label={support?"Issue or question":"Change request title"}><input name="title" maxLength={160} required/></Field>
        <Field label={support?"What happened, and what would help?":"What would you like to change?"}><textarea name="body" rows={4} maxLength={5000} required/></Field>
        {!support&&<Field label="Why do you need this change?"><textarea name="reason" rows={2} maxLength={900}/></Field>}
        <Field label="Priority"><select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></Field><Attachment/>
      </EntryForm>
    </WorkPanel>
    {entries.length?entries.map((entry)=><WorkPanel title={entry.data.title} key={entry.id} id={entry.id}>
      <div className="axp-row"><p className="axp-note">Opened {day(entry.createdAt)}</p><Badge value={entry.state}/></div>
      <p className="axp-prewrap">{entry.data.body}</p>{entry.data.extra&&<p className="axp-prewrap">{entry.data.extra}</p>}
      {entry.data.amount&&<p>Estimated additional cost: {entry.data.amount}</p>}
      {entry.data.target&&<p>{entry.state==="approved"?"Agreed target":"Estimated target"}: {day(entry.data.target)}</p>}
      {data.quotes.some((quote)=>quote.id===entry.data.quoteId)&&<Link href={"/portal/quotations/"+entry.data.quoteId}>Open related quotation</Link>}
      <EntryAttachment data={data} entry={entry}/>
      <details className="axw-disclosure"><summary>View conversation</summary><Conversation data={data} reload={reload} parent={entry}/></details>
    </WorkPanel>):<WorkPanel title={support?"Support tickets":"Change requests"}><Empty>Your submitted items will appear here.</Empty></WorkPanel>}
  </>;
}
export function Reports({data}:{data:ActiveData}) {
  const reports=[...data.events].reverse().filter((entry)=>entry.kind==="report");
  return reports.length?<>{reports.map((entry)=><WorkPanel key={entry.id} title={entry.data.title} id={entry.id}>
    <p className="axp-note">{entry.data.period}{entry.data.date&&" · "+day(entry.data.date)}{entry.data.target&&" – "+day(entry.data.target)}</p>
    <p className="axp-prewrap">{entry.data.body}</p>{entry.data.extra&&<p className="axp-prewrap">{entry.data.extra}</p>}<EntryAttachment data={data} entry={entry}/>
    <a href={projectEndpoint(data.project.id)+"?document=report&entry="+entry.id}>Download report PDF</a>
  </WorkPanel>)}</>:<WorkPanel title="Project reports"><Empty>Published progress or performance reports will appear here.</Empty></WorkPanel>;
}
export function Handover({data,reload}:{data:ActiveData;reload:()=>void}) {
  const handover=[...data.events].reverse().find((entry)=>entry.kind==="handover");
  const finalFiles=data.files.filter((file)=>file.folder==="Final deliverables");
  return <>
    <WorkPanel title="Project handover">
      {handover?<><p className="axp-prewrap">{handover.data.body}</p><p className="axp-prewrap">{handover.data.extra}</p><EntryAttachment data={data} entry={handover}/></>:
        <Empty>Axonill will publish delivery, training, and ownership details here when ready.</Empty>}
      {finalFiles.length>0&&<FileRows files={finalFiles} id={data.project.id}/>}
      <Link href={portalPath(data.project.id,"files")}>View all project files</Link>
      {data.invoices.length>0&&<p>Final payments: {data.invoices.some((item)=>item.balance>0)?"Outstanding invoices":"No outstanding invoices"}</p>}
      {data.config.supportThrough&&<p>Support through {day(data.config.supportThrough)}</p>}
      <Link href={portalPath(data.project.id,"support")}>Open support</Link>
    </WorkPanel>
    {data.config.status==="completed"&&<WorkPanel title="Share private feedback">
      <p className="axp-note">Your feedback goes to Axonill. Publishing permission is optional.</p>
      <EntryForm label="Send feedback" submit={async(values)=>{
        const scores=["satisfaction","communication","delivery","timeliness"].map((key)=>Number(values.get(key)));
        await sendEntry(data,"feedback",values,{scores,publishConsent:values.get("permission")==="yes"});reload();
      }}>
        <div className="axp-fields">{[["satisfaction","Overall satisfaction"],["communication","Communication"],["delivery","Delivery quality"],["timeliness","Timeliness"]]
          .map(([key,label])=><Field key={key} label={label}><select name={key} required><option value="">Select a rating</option>
            {[5,4,3,2,1].map((score)=><option value={score} key={score}>{score} of 5</option>)}</select></Field>)}</div>
        <Field label="Feedback and suggestions"><textarea name="body" rows={3} maxLength={5000} required/></Field>
        <label className="axp-check"><input name="permission" type="checkbox" value="yes"/>I give Axonill permission to publish this feedback as a testimonial.</label>
      </EntryForm>
    </WorkPanel>}
  </>;
}

export function ServiceModules({data,reload}:{data:ActiveData;reload:()=>void}) {
  return data.config.modules.length? <>{data.config.modules.map((module)=>{
    const records=[...data.events].reverse().filter((item)=>item.kind==="module"&&item.data.module===module);
    return <WorkPanel title={moduleLabels[module]} key={module}>
      {records.length?records.map((item)=><article key={item.id} id={item.id} className="axw-disclosure axp-stack">
        <div className="axp-row"><strong>{item.data.title}</strong><Badge value={item.state}/></div>
        <p className="axp-note">{item.data.category}{item.data.date&&" · "+day(item.data.date)}</p>
        <p className="axp-prewrap">{item.data.body}</p><EntryAttachment data={data} entry={item}/>
        {item.data.url&&<a href={item.data.url} target="_blank" rel="noreferrer">Open published resource</a>}
        {item.state==="pending"&&<EntryForm label="Submit review" submit={async(values)=>{
          const choice=values.get("choice");
          if(choice==="approved"&&!window.confirm("Approve this update?"))throw new Error("Review cancelled.");
          await postProject(data.project.id,{action:"module_review",id:item.id,version:item.version,choice,feedback:values.get("feedback")});reload();
        }}><Field label="Decision"><select name="choice" required><option value="">Choose a decision</option><option value="approved">Approve</option>
          <option value="changes_requested">Request changes</option></select></Field>
          <Field label="Feedback"><textarea name="feedback" rows={2} maxLength={2000}/></Field></EntryForm>}
      </article>):<Empty>No verified updates have been published for this service yet.</Empty>}
    </WorkPanel>;
  })}</>:<WorkPanel title="Service updates"><Empty>No service modules are enabled for this project.</Empty></WorkPanel>;
}
