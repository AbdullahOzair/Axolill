"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchJson, useLoader } from "@/lib/use-api";
import { moduleLabels, moduleSections, projectConfigSchema, projectModules, projectStates, projectWords, workflowStatuses } from "@/lib/active-project";
import { Field } from "@/components/portal/request-wizard";
import { Badge, Empty, EntryAttachment, EntryForm, WorkPanel, day, postProject, projectEndpoint, sendEntry, uploadProjectFile, type ActiveData, type Entry } from "@/components/portal/project-ui";
import "@/components/portal/workspace.css";
import "@/components/portal/active-project.css";

export function AdminProjectWorkspace({id}:{id:string}) {
  const state=useLoader(()=>fetchJson<ActiveData>(projectEndpoint(id)));
  const [tab,setTab]=useState("plan");
  if(state.loading&&!state.data)return <p role="status">Loading client workspace…</p>;
  if(!state.data||state.error)return <section><p role="alert">{state.error||"Workspace unavailable."}</p><Button onClick={state.reload}>Retry</Button></section>;
  const data=state.data;
  return <div className="axp-shell axp-stack !m-0 !p-0">
    <nav aria-label="Manage client workspace" className="axp-actions">{[["plan","Plan & team"],["files","File sharing"],["messages","Messages"],["requests","Changes & support"],
      ["payments", "Payment proofs" + (data.events.some((item)=>item.kind==="proof"&&item.state==="pending") ? " ("+data.events.filter((item)=>item.kind==="proof"&&item.state==="pending").length+")" : "")],["reports","Reports & handover"],["service","Service updates"],["reviews","Client feedback"]].map(([key,label])=><Button key={key} size="sm"
        variant={tab===key?"default":"outline"} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</Button>)}</nav>
    {tab==="plan"&&data.notifications.some((item)=>!item.read)&&<WorkPanel title="New client updates">
      <ul className="axp-list">{data.notifications.filter((item)=>!item.read).slice(0,5).map((item)=><li className="axp-row" key={item.key}>
        <div><strong>{item.title}</strong><p className="axp-note">{day(item.time,true)}</p></div>
        <Button type="button" size="sm" variant="outline" onClick={()=>setTab(item.url)}>Open</Button>
      </li>)}</ul>
      <EntryForm label="Mark all as read" submit={async()=>{await postProject(id,{action:"read"});state.reload();}}>{null}</EntryForm>
    </WorkPanel>}
    {tab==="plan"&&<Plan key={data.settingsVersion} data={data} reload={state.reload}/>}
    {tab==="files"&&<WorkPanel title="Share a project file">
      <EntryForm label="Upload file" submit={async(values)=>{
        const file=values.get("file");
        if(!(file instanceof File)||!file.size)throw new Error("Select a file to upload.");
        await uploadProjectFile(id,file,{folder:String(values.get("folder")||""),visibility:String(values.get("visibility")||""),
          milestoneId:String(values.get("milestoneId")||""),previousVersionId:String(values.get("previousVersionId")||"")});
        state.reload();
      }}>
        <div className="axp-fields"><Field label="Folder (or enter a custom folder)"><input name="folder" list="project-folders" maxLength={100}/></Field>
          <datalist id="project-folders">{["Project documents","Brand assets","Design files","Development previews","Milestone deliverables","Final deliverables","Reports"]
            .map((item)=><option key={item} value={item}/>)}</datalist>
          <Field label="Visibility"><select name="visibility"><option value="client">Client and Axonill team</option><option value="internal">Axonill only</option></select></Field>
          <Field label="Milestone (optional)"><select name="milestoneId"><option value="">General project file</option>{data.milestones.map((item)=><option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>
          <Field label="Previous version (optional)"><select name="previousVersionId"><option value="">New file</option>{data.files.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>
          <Field label="File"><input type="file" name="file" required/></Field></div>
      </EntryForm>
      <ul className="axp-list">{data.files.slice(0,20).map((item)=><li key={item.id}>{item.name} · {item.clientVisible?"Client-visible":"Internal"}</li>)}</ul>
    </WorkPanel>}
    {tab==="messages"&&<><AdminThread data={data} reload={state.reload}/>{data.link?.requestId&&<p>Pre-project conversation remains in <Link href="/admin/conversions" className="underline">Leads & Conversions</Link>.</p>}</>}
    {tab==="requests"&&(data.events.some((item)=>["change","support"].includes(item.kind))?[...data.events].reverse().filter((item)=>["change","support"].includes(item.kind)).map((item)=>
      <ManageEntry key={item.id+":"+item.version} data={data} entry={item} reload={state.reload}/>):<WorkPanel title="Requests"><Empty>No changes or support requests yet.</Empty></WorkPanel>)}
    {tab==="payments"&&(data.events.some((item)=>item.kind==="proof")?[...data.events].reverse().filter((item)=>item.kind==="proof").map((item)=>
      <ManageEntry key={item.id+":"+item.version} data={data} entry={item} reload={state.reload}/>):<WorkPanel title="Payment proofs"><Empty>No payment proofs submitted.</Empty></WorkPanel>)}
    {tab==="reports"&&<>
      <WorkPanel title="Publish a progress report"><Publish data={data} kind="report" reload={state.reload}/></WorkPanel>
      <WorkPanel title="Publish handover details"><Publish data={data} kind="handover" reload={state.reload}/></WorkPanel>
      <WorkPanel title="Published documents">{data.events.some((item)=>["report","handover"].includes(item.kind))?<ul className="axp-list">{[...data.events].reverse()
        .filter((item)=>["report","handover"].includes(item.kind)).map((item)=><li key={item.id}><strong>{item.data.title}</strong><p className="axp-note">{day(item.createdAt)}</p></li>)}</ul>:
        <Empty>No published documents yet.</Empty>}</WorkPanel>
    </>}
    {tab==="service"&&<PublishService data={data} reload={state.reload}/>}
    {tab==="reviews"&&<WorkPanel title="Milestone reviews and project feedback">
      {data.events.some((item)=>["milestone_review","feedback"].includes(item.kind))?<ul className="axp-list">{[...data.events].reverse()
        .filter((item)=>["milestone_review","feedback"].includes(item.kind)).map((item)=><li key={item.id}>
          <strong>{item.kind==="milestone_review"?(data.milestones.find((record)=>record.id===item.data.reference)?.title||"Milestone")+" · version "+item.data.milestoneVersion:"Project feedback"}</strong>
          <p className="axp-note">{day(item.createdAt,true)} · {projectWords[item.state]??item.state}</p><p>{item.data.body}</p>
          {item.data.scores&&<p>Overall / communication / delivery / timeliness: {item.data.scores.join(" / ")}</p>}
          {item.kind==="feedback"&&<p>{item.data.publishConsent?"Client granted publication permission.":"Private feedback."}</p>}
        </li>)}</ul>:<Empty>Reviews and feedback will appear here.</Empty>}
    </WorkPanel>}
  </div>;
}

function Plan({data,reload}:{data:ActiveData;reload:()=>void}) {
  const [stages,setStages]=useState(data.config.stages);
  const [modules,setModules]=useState(data.config.modules);
  const [team,setTeam]=useState(data.config.team);
  const [state,setState]=useState(data.config.status);
  function setStage(index:number,field:string,value:string|number) {
    setStages((items)=>items.map((item,i)=>i===index?{...item,[field]:value}:item));
  }
  return <WorkPanel title="Client-facing delivery plan">
    <p className="axp-note">Progress is calculated from completed stage weights. Leave all weights at zero to use the progress recorded in the project overview.</p>
    <EntryForm label="Save project plan" submit={async(values)=>{
      const config=projectConfigSchema.parse({...Object.fromEntries(values),status:state,stages,team,modules});
      if(state==="completed"&&!window.confirm("Mark this project complete and open client feedback?"))throw new Error("Completion cancelled.");
      await postProject(data.project.id,{action:"settings",config,version:data.settingsVersion,note:values.get("note")||""});reload();
    }}>
      <div className="axp-fields"><Field label="Project status"><select value={state} onChange={(event)=>setState(event.target.value as typeof state)}>
        {projectStates.map((item)=><option key={item} value={item}>{projectWords[item]}</option>)}</select></Field>
        <Field label="Project manager"><select name="managerId" defaultValue={data.config.managerId}><option value="">Unassigned</option>{data.teamOptions.map((member)=><option value={member.id} key={member.id}>{member.name}</option>)}</select></Field>
        <Field label="Planned kickoff"><input type="date" name="start" defaultValue={data.project.startDate.slice(0,10)}/></Field>
        <Field label="Expected delivery"><input type="date" name="target" defaultValue={data.project.targetDate.slice(0,10)}/></Field>
        <Field label="Support coverage through"><input type="date" name="supportThrough" defaultValue={data.config.supportThrough}/></Field>
        <Field label="Project preview URL (HTTPS)"><input type="url" name="staging" defaultValue={data.config.staging}/></Field></div>
      <Field label="Schedule or status update for the client"><textarea name="note" rows={2} maxLength={1200}/></Field>
      <Field label="What needs to happen before work can begin?"><textarea name="prerequisites" rows={2} maxLength={800} defaultValue={data.config.prerequisites}/></Field>
      <Field label="Payment instructions"><textarea name="instructions" rows={2} maxLength={1800} defaultValue={data.config.instructions}/></Field>
      <Field label="Included support and billable work"><textarea name="supportCoverage" rows={2} maxLength={800} defaultValue={data.config.supportCoverage}/></Field>
      <fieldset className="axp-checks"><legend>Service modules</legend>{projectModules.map((item)=><label key={item}><input type="checkbox" checked={modules.includes(item)}
        onChange={(event)=>setModules((previous)=>event.target.checked?[...previous,item]:previous.filter((value)=>value!==item))}/>{moduleLabels[item]}</label>)}</fieldset>
      {data.teamOptions.length>0&&<fieldset className="axp-checks"><legend>Project team</legend>{data.teamOptions.map((item)=><label key={item.id}><input type="checkbox"
        checked={team.includes(item.id)} onChange={(event)=>setTeam((previous)=>event.target.checked?[...previous,item.id]:previous.filter((value)=>value!==item.id))}/>{item.name}</label>)}</fieldset>}
      {stages.map((item,index)=><fieldset key={index} className="axp-card"><legend>Stage {index+1}</legend>
        <div className="axp-fields"><Field label="Stage name"><input required maxLength={120} value={item.name} onChange={(event)=>setStage(index,"name",event.target.value)}/></Field>
          <Field label="Stage status"><select value={item.status} onChange={(event)=>setStage(index,"status",event.target.value)}>{workflowStatuses.map((value)=><option key={value} value={value}>{projectWords[value]}</option>)}</select></Field>
          <Field label="Target date"><input type="date" value={item.date} onChange={(event)=>setStage(index,"date",event.target.value)}/></Field>
          <Field label="Progress weight"><input type="number" min={0} max={100} value={item.weight} onChange={(event)=>setStage(index,"weight",Number(event.target.value))}/></Field></div>
        <Field label="Description"><textarea value={item.description} maxLength={600} rows={2} onChange={(event)=>setStage(index,"description",event.target.value)}/></Field>
        <div className="axp-actions">{index>0&&<Button type="button" variant="outline" size="sm" onClick={()=>setStages((items)=>{
          const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];return next;
        })}>Move up</Button>}<Button type="button" variant="ghost" size="sm" onClick={()=>setStages((items)=>items.filter((_,i)=>i!==index))}>Remove stage</Button></div>
      </fieldset>)}
      {stages.length<24&&<Button type="button" variant="outline" className="axp-fit" onClick={()=>setStages((items)=>[...items,{name:"",description:"",date:"",weight:0,status:"upcoming"}])}>Add delivery stage</Button>}
    </EntryForm>
  </WorkPanel>;
}

function AdminThread({data,reload,parent}:{data:ActiveData;reload:()=>void;parent?:Entry}) {
  const messages=data.events.filter((item)=>item.kind==="message"&&item.data.parentId===(parent?.id??""));
  return <WorkPanel title={parent?"Conversation":"Project messages"}>
    {messages.length?<ul className="axp-list">{messages.map((item)=><li key={item.id}>
      <strong>{item.own?"You":"Project participant"}</strong> · {day(item.createdAt,true)}<p className="axp-prewrap">{item.data.body}</p><EntryAttachment data={data} entry={item}/>
    </li>)}</ul>:<Empty>No messages yet.</Empty>}
    {(!parent||!["closed","resolved","declined"].includes(parent.state))&&<EntryForm label="Send message" submit={async(values)=>{
      await sendEntry(data,"message",values,{parentId:parent?.id??""});reload();
    }}>
      <Field label="Client-visible message"><textarea name="body" rows={3} maxLength={5000} required/></Field>
      <Field label="Attachment (optional)"><input type="file" name="file"/></Field>
    </EntryForm>}
  </WorkPanel>;
}
function ManageEntry({data,entry,reload}:{data:ActiveData;entry:Entry;reload:()=>void}) {
  const proof=entry.kind==="proof", change=entry.kind==="change";
  const states=proof?["verified","rejected"]:change?["under_review","declined","awaiting_client","approved","closed"]:
    ["under_review","in_progress","awaiting_client","resolved","closed"];
  const bill=data.invoices.find((item)=>item.id===entry.data.invoiceId);
  return <WorkPanel title={proof?"Proof for "+(bill?.number??"invoice"):entry.data.title}>
    <div className="axp-row"><span className="axp-note">{day(entry.createdAt,true)}</span><Badge value={entry.state}/></div>
    <p className="axp-prewrap">{entry.data.body}</p>{entry.data.reason&&<p>{entry.data.reason}</p>}
    {!proof&&<p className="axp-note">Priority: {entry.data.priority}</p>}
    {proof&&<p>{entry.data.amount} {bill?.currency} · {entry.data.reference} · {entry.data.date}</p>}
    <EntryAttachment data={data} entry={entry}/>
    {entry.data.extra&&<p>{entry.data.extra}</p>}
    {(!proof||entry.state==="pending")&&<EntryForm label={proof?"Record verification decision":"Update request"} submit={async(values)=>{
      const selected=values.get("state");
      if(selected==="verified"&&!window.confirm("Record this payment as verified?"))throw new Error("Verification cancelled.");
      const fields=Object.fromEntries(values);
      await postProject(data.project.id,{action:"decision",id:entry.id,version:entry.version,...fields,receivedOn:fields.receivedOn||undefined});reload();
    }}>
      <Field label="Status"><select name="state" required defaultValue={states.includes(entry.state)?entry.state:""}><option value="">Choose a decision</option>
        {states.map((item)=><option value={item} key={item}>{projectWords[item]}</option>)}</select></Field>
      {proof&&<div className="axp-fields"><Field label="Verified receipt reference"><input name="receipt" maxLength={120}/></Field>
        <Field label="Date received"><input name="receivedOn" type="date" defaultValue={entry.data.date}/></Field></div>}
      {!proof&&<div className="axp-fields">
        {change&&<><Field label="Estimated added cost with currency"><input name="amount" maxLength={30} defaultValue={entry.data.amount}/></Field>
        <Field label="Estimated delivery date"><input name="target" type="date" defaultValue={entry.data.target}/></Field></>}
        <Field label={change?"Related quotation":"Quotation for billable support"}><select name="quoteId" defaultValue={entry.data.quoteId}><option value="">Choose existing quotation</option>
          {data.quoteOptions.map((item)=><option value={item.id} key={item.id}>{item.number} · revision {item.revision} · {item.status}</option>)}</select></Field>
        {data.link?.leadId?<Link className="underline" href={"/admin/quotations/new?source="+data.link.leadId}>{change?"Create change quotation":"Create support quotation"}</Link>:
          <Link className="underline" href="/admin/quotations/new">Create a quotation for this client</Link>}
      </div>}
      <Field label="Update for the client"><textarea name="note" maxLength={1200} rows={2} defaultValue={entry.data.extra}/></Field>
    </EntryForm>}
    {!proof&&<details className="axw-disclosure"><summary>Open conversation</summary><AdminThread data={data} reload={reload} parent={entry}/></details>}
  </WorkPanel>;
}
function Publish({data,kind,reload}:{data:ActiveData;kind:"report"|"handover";reload:()=>void}) {
  return <EntryForm label={kind==="report"?"Publish report":"Publish handover"} submit={async(values)=>{await sendEntry(data,kind,values);reload();}}>
    <Field label="Title"><input name="title" required maxLength={160}/></Field>
    {kind==="report"&&<div className="axp-fields">
      <Field label="Report frequency"><select name="period"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="one-off">One-off</option></select></Field>
      <Field label="Period start"><input name="date" type="date"/></Field><Field label="Period end"><input name="target" type="date"/></Field>
    </div>}
    <Field label={kind==="report"?"Work completed, in progress, and coming next":"Deliverables, deployment, ownership, and training"}><textarea name="body" rows={4} maxLength={5000} required/></Field>
    <Field label={kind==="report"?"Blockers, client input, and timeline changes":"Licensing, support, and maintenance options"}><textarea name="extra" rows={3} maxLength={2400}/></Field>
    {kind==="handover"&&<p className="axp-note">Use your existing secure credential transfer method for passwords and keys.</p>}
    <Field label="Attachment (optional)"><input name="file" type="file"/></Field>
  </EntryForm>;
}

function PublishService({data,reload}:{data:ActiveData;reload:()=>void}) {
  const [module,setModule]=useState(data.config.modules[0] ?? "development");
  if(!data.config.modules.length)return <WorkPanel title="Service updates"><Empty>Enable a service module under Plan & team.</Empty></WorkPanel>;
  return <>
    <WorkPanel title="Publish a service update"><EntryForm label="Publish update" submit={async(values)=>{
      await sendEntry(data,"module",values,{module,needsReview:values.get("review")==="yes"});reload();
    }}>
      <div className="axp-fields">
        <Field label="Service module"><select value={module} onChange={(event)=>setModule(event.target.value as typeof module)}>
          {data.config.modules.map((item)=><option key={item} value={item}>{moduleLabels[item]}</option>)}</select></Field>
        <Field label="Update category"><select key={module} name="category" required>{moduleSections[module].map((item)=><option key={item}>{item}</option>)}</select></Field>
        <Field label="Title"><input name="title" maxLength={160} required/></Field>
        <Field label="Target or reported date (optional)"><input name="date" type="date"/></Field>
      </div>
      <Field label="Client-visible update and verified results"><textarea name="body" rows={4} maxLength={5000} required/></Field>
      <Field label="Published resource URL (optional)"><input name="url" type="url" maxLength={600}/></Field>
      <Field label="Attachment (optional)"><input type="file" name="file"/></Field>
      <label className="axp-check"><input type="checkbox" name="review" value="yes"/>Ask the client to approve this item</label>
    </EntryForm></WorkPanel>
    <WorkPanel title="Published service updates"><ul className="axp-list">{[...data.events].reverse().filter((item)=>item.kind==="module").map((item)=>
      <li key={item.id} className="axp-row"><span>{item.data.title} · {item.data.category}</span><Badge value={item.state}/></li>)}</ul></WorkPanel>
  </>;
}
