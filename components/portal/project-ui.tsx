"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/use-api";
import { projectWords } from "@/lib/active-project";
import type { activeProjectData } from "@/lib/active-project-store";
import { Field } from "./request-wizard";

type Wire<T> = T extends Date ? string : T extends object ? { [K in keyof T]: Wire<T[K]> } : T;
export type ActiveData = Wire<Awaited<ReturnType<typeof activeProjectData>>>;
export type Entry = ActiveData["events"][number];
export type ProjectFile = ActiveData["files"][number];
export const projectEndpoint=(id:string)=>"/api/projects/"+id+"/workspace";
export const portalPath=(id:string,tab="overview")=>"/portal/project/"+id+"/"+tab;
export const filePath=(id:string,file:string)=>"/api/projects/"+id+"/files/"+file;
export const status=(value:string)=>projectWords[value]??value;
export const day=(value:string|number,time=false)=>new Intl.DateTimeFormat(undefined,{dateStyle:"medium",
  ...(time?{timeStyle:"short"}:{timeZone:"UTC"})}).format(new Date(typeof value==="number"?value*1000:value));
export function postProject<T={saved:boolean}>(id:string,value:object) {
  return fetchJson<T>(projectEndpoint(id),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
}
export function WorkPanel({title,children,link,id}:{title:string;children:ReactNode;link?:{label:string;href:string};id?:string}) {
  return <section className="axp-card axp-project-panel" id={id}><div className="axp-row"><h2>{title}</h2>{link&&<Link href={link.href}>{link.label}</Link>}</div>{children}</section>;
}
export const Empty=({children}:{children:ReactNode})=><p className="axp-note axp-empty">{children}</p>;
export const Badge=({value}:{value:string})=><span className="axp-badge" data-status={value}>{status(value)}</span>;

export async function uploadProjectFile(id:string,file:File,options:Record<string,string>={}) {
  const form=new FormData();form.append("file",file);
  for(const [key,value] of Object.entries(options)) if(value) form.append(key,value);
  return fetchJson<{file:ProjectFile}>("/api/projects/"+id+"/files",{method:"POST",body:form});
}

export function Attachment({required=false}:{required?:boolean}) {
  return <Field label={required?"Attach a PDF or image":"Attach a PDF or image (optional)"}>
    <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" required={required}/>
  </Field>;
}
export async function sendEntry(data:ActiveData,kind:string,values:FormData,override:Record<string,unknown>={}) {
  const file=values.get("file");
  const fields=Object.fromEntries([...values].filter(([,value])=>typeof value==="string"));
  const fileId=file instanceof File&&file.size?(await uploadProjectFile(data.project.id,file)).file.id:undefined;
  await postProject(data.project.id,{action:"entry",input:{kind,...fields,...(fileId?{fileId}:{}),...override}});
}
export function EntryForm({children,label,submit}:{children:ReactNode;label:string;submit:(values:FormData)=>Promise<void>}) {
  const lock=useRef(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [saved,setSaved]=useState(false);
  async function act(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(lock.current)return;
    const form=event.currentTarget;
    lock.current=true;setBusy(true);setSaved(false);setError("");
    try{await submit(new FormData(form));setSaved(true);}
    catch(failure){setError(failure instanceof Error?failure.message:"Please try again.");}
    finally{lock.current=false;setBusy(false);}
  }
  return <form className="axp-stack axw-form" onSubmit={act}>{children}
    {error&&<p className="axp-feedback" role="alert">{error}</p>}{saved&&<p role="status">Saved.</p>}
    <Button type="submit" className="axp-fit" disabled={busy}>{busy?"Saving…":label}</Button>
  </form>;
}
export function FileRows({id,files}:{id:string;files:ProjectFile[]}) {
  return <ul className="axp-list">{files.map((file)=><li id={file.id} className="axp-row" key={file.id}>
    <div><strong>{file.name}</strong><p className="axp-note">{file.folder} · {day(file.createdAt)}
      {file.fileSize!==null?" · "+Math.max(1,Math.round(file.fileSize/1024))+" KB":""}
      {file.fileType&&file.fileType!=="application/octet-stream"?" · "+file.fileType.split("/")[1].toUpperCase():""}</p>
      {file.previousVersionId&&<a className="axp-note" href={filePath(id,file.previousVersionId)}>Previous version</a>}</div>
    <div className="axp-actions">
      {["application/pdf","image/jpeg","image/png","image/webp"].includes(file.fileType??"")&&<a target="_blank" rel="noreferrer" href={filePath(id,file.id)+"?preview=1"}>Preview<span className="sr-only"> {file.name}</span></a>}
      <a href={filePath(id,file.id)}>Download<span className="sr-only"> {file.name}</span></a>
    </div>
  </li>)}</ul>;
}
export function EntryAttachment({data,entry}:{data:ActiveData;entry:Entry}) {
  const file=data.files.find((item)=>item.id===entry.data.fileId);
  return file?<a href={filePath(data.project.id,file.id)}>{file.name}</a>:null;
}
