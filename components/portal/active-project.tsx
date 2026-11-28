"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, CalendarDays, CheckCircle2, ClipboardCheck, FileText, FolderOpen, LayoutDashboard, LifeBuoy, Menu, MessageSquare, Receipt, Settings, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchJson, useLoader } from "@/lib/use-api";
import { moduleLabels, projectWords } from "@/lib/active-project";
import { formatQuoteMoney, QUOTE_LABELS } from "@/lib/quotations";
import { Field } from "./request-wizard";
import { WorkspaceMeetings } from "./workspace-meetings";
import { WorkPanel, Empty, Badge, FileRows, day, portalPath, projectEndpoint, postProject, type ActiveData } from "./project-ui";
import { Financial, FinancialSummary, Milestones, Files } from "./project-delivery";
import { Conversation, ClientRequests, Reports, Handover, ServiceModules } from "./project-communication";
import "./workspace.css";
import "./active-project.css";

export const tabs = ["overview","timeline","milestones","files","quotations","invoices","meetings","messages","changes","reports","handover","support","service","notifications"];
const labels: Record<string,string> = { overview:"Overview",timeline:"Timeline",milestones:"Milestones & Approvals",files:"Files & Deliverables",quotations:"Quotations",
  invoices:"Invoices & Payments",meetings:"Meetings",messages:"Messages",changes:"Change requests",reports:"Reports",handover:"Handover",support:"Support",service:"Service updates",notifications:"Notifications" };

export function ActiveProject({ id, tab, name }: { id: string; tab: string; name: string }) {
  const router = useRouter();
  const result = useLoader(() => fetchJson<ActiveData>(projectEndpoint(id)));
  const [open,setOpen] = useState(false);
  const [error,setError] = useState("");
  const data = result.data;
  const unread = data?.notifications.filter((item) => !item.read) ?? [];
  const approvalCount = data?.milestones.filter((item) => item.status === "awaiting_approval").length ?? 0;
  const icons = [LayoutDashboard,CalendarDays,ClipboardCheck,FolderOpen,FileText,Receipt,CalendarDays,MessageSquare,ClipboardCheck,FileText,CheckCircle2,LifeBuoy,ClipboardCheck];
  async function mark(key?: string) {
    setError("");
    try { await postProject(id,{action:"read",key});
      result.setData((previous)=>({...previous,notifications:previous.notifications.map((item)=>!key||item.key===key?{...item,read:true}:item)}));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to mark as read."); }
  }
  return <div className="axp-shell axw-shell">
    <header className="axp-header">
      <div className="axp-header-main"><button className="axp-icon axp-menu" type="button" aria-controls="axw-nav" aria-expanded={open}
        aria-label={open?"Close project menu":"Open project menu"} onClick={()=>setOpen(!open)}>{open?<X size={19}/>:<Menu size={19}/>}</button>
        <Link className="axp-wordmark" href="/portal/projects">Project workspace</Link></div>
      <div className="axp-header-main"><Link className="axp-icon" href={portalPath(id,"notifications")} aria-label={"Notifications, "+unread.length+" unread"}>
        <Bell size={19}/>{unread.length>0&&<span>{unread.length}</span>}</Link><Link className="axw-profile" href="/portal/settings">{name}</Link></div>
    </header>
    <div className="axp-body">
      <nav id="axw-nav" className="axp-nav" aria-label="Project workspace" data-open={open}>
        <Link href="/portal/projects"><FolderOpen size={16}/>My Projects</Link><Link href="/portal/requests"><ClipboardCheck size={16}/>My Requests</Link>
        {tabs.slice(0,-1).map((item,index)=>{
          const Icon=icons[index]; const count=item==="milestones"?approvalCount:item==="messages"?unread.filter((entry)=>entry.title==="New project message").length:0;
          if(item==="service"&&!data?.config.modules.length)return null;
          return <Link href={portalPath(id,item)} key={item} aria-current={tab===item?"page":undefined} onClick={()=>setOpen(false)}>
            <Icon size={16} aria-hidden="true"/>{labels[item]}{count>0&&<span className="axp-count">{count}</span>}</Link>;
        })}
        <Link href="/portal/settings"><Settings size={16}/>Account Settings</Link><Link href="/portal/overview">Start a new request</Link>
      </nav>
      <main className="axp-main axp-stack">
        {result.loading&&!data&&<div className="axp-loading" role="status" aria-label="Loading project"><i/><i/><i/></div>}
        {result.error&&<WorkPanel title="Couldn’t open the project"><p role="alert">{result.error}</p><Button className="axp-fit" onClick={result.reload}>Try again</Button></WorkPanel>}
        {data&&!result.error&&<>
          <div className="axp-heading axp-row"><div><Link className="axw-back" href="/portal/projects">My Projects</Link>
            <h1>{tab==="overview"?data.project.name:labels[tab]}</h1><p>{tab==="overview"?data.project.service:data.project.name}</p></div>
            {data.projects.length>1&&<Field label="Switch project"><select value={id} onChange={(event)=>router.push(portalPath(event.target.value,tab))}>
              {data.projects.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></Field>}</div>
          {error&&<p className="axp-feedback" role="alert">{error}</p>}
          {tab==="overview"&&<Overview data={data}/>}
          {tab==="timeline"&&<Timeline data={data}/>}
          {tab==="milestones"&&<Milestones data={data} reload={result.reload}/>}
          {tab==="files"&&<Files data={data} reload={result.reload}/>}
          {tab==="quotations"&&<WorkPanel title="Project quotations">{data.quotes.length?<ul className="axp-list">{data.quotes.map((item)=><li className="axp-row" key={item.id}>
            <div><Link href={"/portal/quotations/"+item.id}>{item.title||item.number}</Link><p className="axp-note">{item.number} · Revision {item.revision}</p></div>
            <span className="axp-badge">{QUOTE_LABELS[item.status]}</span></li>)}</ul>:<Empty>Linked quotations will appear here.</Empty>}</WorkPanel>}
          {tab==="invoices"&&<Financial data={data} reload={result.reload}/>}
          {tab==="meetings"&&<WorkspaceMeetings meetings={data.appointments} requests={[]} refresh={result.reload} projectId={id}/>}
          {tab==="messages"&&<Conversation data={data} reload={result.reload}/>}
          {tab==="support"&&<ClientRequests kind="support" data={data} reload={result.reload}/>}
          {tab==="changes"&&<ClientRequests kind="change" data={data} reload={result.reload}/>}
          {tab==="reports"&&<Reports data={data}/>}
          {tab==="service"&&<ServiceModules data={data} reload={result.reload}/>}
          {tab==="handover"&&<Handover data={data} reload={result.reload}/>}
          {tab==="notifications"&&<WorkPanel title="Project updates">
            {unread.length>0&&<Button size="sm" variant="outline" className="axp-fit" onClick={()=>void mark()}>Mark all as read</Button>}
            <ul className="axp-list">{data.notifications.map((item)=><li className="axp-row" key={item.key}><div><Link href={item.url}>{item.title}</Link>
              <p className="axp-note">{day(item.time,true)}</p></div>{!item.read&&<button type="button" className="axp-inline-action" onClick={()=>void mark(item.key)}>Mark as read</button>}</li>)}</ul>
          </WorkPanel>}
        </>}
      </main>
    </div>
  </div>;
}

function Overview({data}:{data:ActiveData}) {
  const id=data.project.id;
  const reviews=data.milestones.filter((item)=>item.status==="awaiting_approval");
  const currentStage=data.config.stages.find((stage)=>["current","client_action","blocked"].includes(stage.status));
  const latestStage=data.config.stages.findLast((stage)=>stage.status==="completed");
  const stageName=data.config.status==="completed"?"Delivery complete":data.config.status==="preparing"?"Awaiting kickoff":
    currentStage?.name??latestStage?.name??data.project.stage.replace(/^./,(character)=>character.toUpperCase());
  const upcoming=data.appointments.filter((item)=>item.status==="scheduled"&&Date.parse(item.scheduledAt)>Date.now()).sort((a,b)=>Date.parse(a.scheduledAt)-Date.parse(b.scheduledAt));
  const actions=[
    ...reviews.map((m)=>({key:m.id, href:portalPath(id,"milestones")+"#"+m.id,title:"Review "+m.title,detail:"Milestone ready for approval"})),
    ...data.invoices.filter((i)=>i.balance>0).map((i)=>({key:i.id,href:portalPath(id,"invoices")+"#"+i.id,title:"Invoice "+i.number,detail:formatQuoteMoney(i.balance,i.currency,i.digits)+" outstanding"})),
    ...data.quotes.filter((q)=>["sent","viewed"].includes(q.status)&&!data.quotes.some((x)=>x.number===q.number&&x.revision>q.revision)).map((q)=>({key:q.id,href:"/portal/quotations/"+q.id,title:"Respond to "+q.number,detail:q.title})),
    ...data.events.filter((item)=>item.kind==="module"&&item.state==="pending").map((item)=>({key:item.id,href:portalPath(id,"service")+"#"+item.id,title:"Review "+item.data.title,detail:item.data.category})),
    ...data.events.filter((x)=>x.kind==="change"&&x.state==="awaiting_client").map((x)=>({key:x.id,href:portalPath(id,"changes")+"#"+x.id,title:"Review "+x.data.title,detail:"Scope change"})),
    ...(data.link?.requestState==="needs_info"&&data.link.requestId?[{key:"info",href:"/portal/requests/"+data.link.requestId,title:"Provide requested information",detail:"Original request"}]:[]),
    ...upcoming.slice(0,1).map((m)=>({key:m.id,href:portalPath(id,"meetings"),title:m.title,detail:day(m.scheduledAt,true)})),
  ];
  return <>
    <WorkPanel title="Action required">{actions.length?<ul className="axp-list axw-actions">{actions.map((item)=><li key={item.key}><Link href={item.href}>
      <span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowRight size={17} aria-hidden="true"/></Link></li>)}</ul>:
      <Empty>You’re caught up. We’ll show your next action here when it’s ready.</Empty>}</WorkPanel>
    <div className="axp-cols"><WorkPanel title="Project progress" link={{label:"View timeline",href:portalPath(id,"timeline")}}>
      <div className="axp-row"><Badge value={data.config.status}/><strong>{data.progress}%</strong></div>
      <progress className="axw-progress" value={data.progress} max={100} aria-label="Project completion"/>
      {data.config.prerequisites&&<p>{data.config.prerequisites}</p>}
      <dl className="axp-summary">{[["Reference",data.reference],["Delivery stage",stageName],
        ["Kickoff",day(data.project.startDate)],["Expected delivery",day(data.project.targetDate)],
        ["Milestones approved",data.milestones.filter((m)=>m.status==="approved").length+" of "+data.milestones.length],["Pending approvals",reviews.length]]
        .map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </WorkPanel><WorkPanel title="Your project team" link={{label:"Message the team",href:portalPath(id,"messages")}}>
      {data.team.length?data.team.map((person)=><div className="axw-person" key={person.id}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {person.photoUrl&&<img src={"/api/media/"+person.photoUrl.split("/").map(encodeURIComponent).join("/")} alt="" width={42} height={42}/>}
        <div><strong>{person.name}</strong><p className="axp-note">{person.id===data.config.managerId?"Project manager · ":""}{person.role}</p></div></div>):
        <Empty>Your Axonill project contact will appear here once assigned.</Empty>}
      {data.config.modules.length>0&&<div className="axw-tags">{data.config.modules.map((item)=><span key={item}>{moduleLabels[item]}</span>)}</div>}
      {data.config.staging&&data.config.modules.some((m)=>m==="development"||m==="automation")&&<a href={data.config.staging} target="_blank" rel="noreferrer">Open project preview</a>}
    </WorkPanel></div>
    <FinancialSummary data={data}/>
    <div className="axp-cols"><WorkPanel title="Latest files" link={{label:"All files",href:portalPath(id,"files")}}>{data.files.length?<FileRows files={data.files.slice(0,3)} id={id}/>:
      <Empty>No files have been shared yet.</Empty>}</WorkPanel>
      <WorkPanel title="Recent activity" link={{label:"All updates",href:portalPath(id,"notifications")}}><ul className="axp-list">{data.notifications.slice(0,5).map((item)=>
        <li key={item.key}><Link href={item.url}>{item.title}</Link><p className="axp-note">{day(item.time,true)}</p></li>)}</ul></WorkPanel></div>
  </>;
}
function Timeline({data}:{data:ActiveData}) {
  return <>
    <WorkPanel title="Delivery plan"><ol className="axw-timeline"><li><strong>Project kickoff</strong><p>{day(data.project.startDate)}</p></li>
      {data.config.stages.map((item,index)=><li key={index} data-status={item.status}><div className="axp-row"><strong>{item.name}</strong><Badge value={item.status}/></div>
        {item.date&&<p className="axp-note">{day(item.date)}</p>}{item.description&&<p>{item.description}</p>}</li>)}
      <li><strong>Expected delivery</strong><p>{day(data.project.targetDate)}</p></li></ol>
      {!data.config.stages.length&&<Empty>Axonill will add delivery stages as the plan is confirmed.</Empty>}</WorkPanel>
    <WorkPanel title="Milestone dates">{data.milestones.length?<ul className="axp-list">{data.milestones.map((m)=>{
      const review=[...data.events].reverse().find((item)=>item.kind==="milestone_review"&&item.data.reference===m.id&&item.state==="approved");
      return <li className="axp-row" key={m.id}><div><Link href={portalPath(data.project.id,"milestones")+"#"+m.id}>{m.title}</Link>
        <p className="axp-note">Target {day(m.dueDate)}{m.status==="approved"&&review&&" · Approved "+day(review.createdAt)}</p></div><Badge value={m.status}/></li>;
    })}</ul>:<Empty>Milestone dates will appear here once added.</Empty>}</WorkPanel>
    <WorkPanel title="Schedule and progress history">{data.events.some((entry)=>entry.kind==="activity")?<ul className="axp-list">{[...data.events].reverse().filter((entry)=>entry.kind==="activity").map((entry)=>
      <li id={entry.id} key={entry.id}><strong>{entry.data.title}</strong><p className="axp-note">{day(entry.createdAt,true)}</p><p className="axp-prewrap">{entry.data.body||projectWords[data.config.status]}</p></li>)}</ul>:
      <Empty>No schedule or progress changes have been recorded.</Empty>}</WorkPanel>
  </>;
}
