"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { ImageUpload } from "@/components/admin/cms/image-upload";
import { Button } from "@/components/ui/button";
import { useLoader } from "@/lib/use-api";
import type { quotationOptions } from "@/lib/quotation-api";
import { newQuoteLine, quoteUnits } from "@/lib/quotations";
import { adminQuotePath, Decimal, errorText, Field, quoteApi, QuoteErrorMessage, requestQuote, Section } from "./shared";

type Options=Awaited<ReturnType<typeof quotationOptions>>;
type Mode="catalogue"|"templates"|"settings";
const titles={catalogue:"Service catalogue",templates:"Quotation templates",settings:"Quotation settings"};

export function QuoteConfig({ mode }: { mode:Mode }) {
  const loader=useLoader(()=>requestQuote<Options>(quoteApi+"/options"));
  return <AdminPage eyebrow="Quotations" title={titles[mode]} action={<Link className="quote-link" href={adminQuotePath+"/overview"}>Overview</Link>}>
    {loader.loading && <p role="status">Loading…</p>}
    {loader.error && <><QuoteErrorMessage value={loader.error}/><Button onClick={loader.reload}>Retry</Button></>}
    {loader.data && <ConfigForm mode={mode} options={loader.data} reload={loader.reload}/>}
  </AdminPage>;
}

function ConfigForm({mode,options,reload}:{mode:Mode;options:Options;reload:()=>void}) {
  const emptyPreset={...newQuoteLine(),serviceId:"",currency:options.settings.currency,region:"national" as const,timeline:""};
  const emptyTemplate={name:"",category:"",description:"",scope:"",deliverables:"",timeline:"",terms:"",instructions:""};
  const [settings,setSettings]=useState(options.settings);
  const [preset,setPreset]=useState<Options["presets"][number]["data"]>(emptyPreset);
  const [template,setTemplate]=useState(emptyTemplate);
  const [id,setId]=useState<string>();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState<Record<string,boolean>>({});
  const disabled=busy||Object.values(uploading).some(Boolean);

  async function persist(body:unknown,success="Saved.") {
    if(disabled)return false;
    setError("");setMessage("");setBusy(true);
    try{await requestQuote(quoteApi+"/config","POST",body);setMessage(success);reload();return true;}
    catch(e){setError(errorText(e));return false;}finally{setBusy(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(mode==="settings") void persist({kind:"settings",data:settings});
    else void persist(mode==="catalogue"?{kind:"preset",id,data:preset}:{kind:"template",id,data:template}).then(ok=>{
      if(ok){setId(undefined);setPreset(emptyPreset);setTemplate(emptyTemplate);}
    });
  }
  function reset() {setId(undefined);setPreset(emptyPreset);setTemplate(emptyTemplate);setError("");}
  function deleteRecord() {
    if(!id||!window.confirm("Delete this saved record? Existing quotations keep their saved details."))return;
    void persist({kind:mode==="catalogue"?"delete-preset":"delete-template",id},"Deleted.").then(ok=>{if(ok)reset();});
  }
  function row(items:ReactNode) {return <div className="quote-grid">{items}</div>;}
  const ps=<K extends keyof typeof preset,>(key:K,value:(typeof preset)[K])=>setPreset(previous=>({...previous,[key]:value}));
  const cfg=<K extends keyof typeof settings,>(key:K,value:(typeof settings)[K])=>setSettings(previous=>({...previous,[key]:value}));
  const digits=options.settings.currencies.find(c=>c.code===preset.currency)?.digits??2;
  const list=mode==="catalogue"?options.presets:options.templates;

  return <form className="quote-stack" onSubmit={submit}>
    <QuoteErrorMessage value={error}/>{message&&<p role="status">{message}</p>}
    {mode!=="settings" && <Section title={mode==="catalogue"?"Private pricing presets":"Saved templates"}>
      {mode==="catalogue" && <p className="text-sm">Presets use the existing service catalogue and apply only in the admin builder. <Link className="underline" href="/admin/content/services">Manage website services</Link></p>}
      <Field label="Select a saved record"><select value={id??""} onChange={event=>{
        const key=event.target.value;if(!key){reset();return;}setId(key);
        if(mode==="catalogue"){const item=options.presets.find(p=>p.id===key);if(item)setPreset(item.data);}
        else{const item=options.templates.find(p=>p.id===key);if(item)setTemplate(item.data);}
      }}><option value="">Create new</option>{list.map(item=><option key={item.id} value={item.id}>{item.data.name}</option>)}</select></Field>
      {!list.length && <p className="text-sm text-muted-foreground">No saved records yet.</p>}
    </Section>}
    {mode==="catalogue" && <Section title={id?"Edit pricing preset":"New pricing preset"}>
      {row(<>
        <Field label="Existing service"><select required value={preset.serviceId} onChange={event=>{
          const service=options.services.find(item=>item.id===event.target.value);
          setPreset(previous=>({...previous,serviceId:event.target.value,name:service?.title??"",category:service?.title??"",description:service?.summary.slice(0,900)??""}));
        }}><option value="">Select service</option>{options.services.map(service=><option key={service.id} value={service.id}>{service.title}</option>)}</select></Field>
        <Field label="Preset name"><input required value={preset.name} onChange={e=>ps("name",e.target.value)} /></Field>
        <Field label="Category"><input value={preset.category} onChange={e=>ps("category",e.target.value)} /></Field>
        <Field label="Currency"><select value={preset.currency} onChange={e=>{
          if ((preset.unitPrice||preset.cost)&&!window.confirm("Clear the monetary amounts before changing currency?"))return;
          setPreset({...preset,currency:e.target.value,unitPrice:0,cost:0});
        }}>{options.settings.currencies.map(item=><option key={item.code}>{item.code}</option>)}</select></Field>
        <Field label="Client region"><select value={preset.region} onChange={e=>ps("region",e.target.value as typeof preset.region)}><option value="national">National</option><option value="international">International</option></select></Field>
        <Field label="Delivery timeline"><input value={preset.timeline} onChange={e=>ps("timeline",e.target.value)} /></Field>
        <Field label="Quantity"><Decimal value={preset.quantity} digits={3} max={1_000_000} onChange={value=>ps("quantity",value)}/></Field>
        <Field label="Unit"><select value={preset.unit} onChange={e=>ps("unit",e.target.value as typeof preset.unit)}>{quoteUnits.map(unit=><option key={unit}>{unit}</option>)}</select></Field>
        {preset.unit==="Custom" && <Field label="Custom unit"><input required value={preset.customUnit} onChange={e=>ps("customUnit",e.target.value)} /></Field>}
        <Field label="Unit price"><Decimal value={preset.unitPrice} digits={digits} onChange={value=>ps("unitPrice",value)} /></Field>
        <Field label="Line cost estimate"><Decimal value={preset.cost} digits={digits} onChange={value=>ps("cost",value)} /></Field>
        <Field label="Discount (%)"><Decimal value={preset.discount} max={10000} onChange={value=>ps("discount",value)} /></Field>
      </>)}
      <Field label="Default description"><textarea maxLength={900} value={preset.description} onChange={e=>ps("description",e.target.value)}/></Field>
      <div className="quote-actions">{([["recurring","Monthly recurring"],["optional","Optional"],["taxable","Taxable"]] as const).map(([key,label])=>
        <label className="quote-checkbox" key={key}><input type="checkbox" checked={preset[key]} onChange={e=>ps(key,e.target.checked)}/> {label}</label>)}</div>
    </Section>}
    {mode==="templates" && <Section title={id?"Edit template":"New template"}>
      {row(<>{(["name","category","timeline"] as const).map(key=><Field key={key} label={key[0].toUpperCase()+key.slice(1)}>
        <input required={key==="name"} value={template[key]} onChange={e=>setTemplate({...template,[key]:e.target.value})}/></Field>)}</>)}
      {(["description","scope","deliverables","terms","instructions"] as const).map(key=><Field key={key} label={key[0].toUpperCase()+key.slice(1)}>
        <textarea value={template[key]} onChange={e=>setTemplate({...template,[key]:e.target.value})}/></Field>)}
    </Section>}
    {mode==="settings" && <>
      <Section title="Commercial defaults">
        {row(<>
          <Field label="Default currency"><select value={settings.currency} onChange={e=>cfg("currency",e.target.value)}>{settings.currencies.map(item=><option key={item.code}>{item.code}</option>)}</select></Field>
          <Field label="Number prefix"><input required maxLength={24} value={settings.prefix} onChange={e=>cfg("prefix",e.target.value)} /></Field>
          {([["sequenceDigits","Sequence digits",3,8],["validityDays","Validity (days)",1,365],["reminderDays","Follow-up window (days)",1,60]] as const).map(([name,label,min,max])=><Field label={label} key={name}>
            <input type="number" min={min} max={max} required value={settings[name]} onChange={e=>cfg(name,Number(e.target.value))}/></Field>)}
          {([["advance","Default advance (%)"],["tax","Default tax (%)"],["margin","Preferred profit margin (%)"]] as const).map(([name,label])=><Field label={label} key={name}>
            <Decimal value={settings[name]} max={10000} onChange={value=>cfg(name,value)}/></Field>)}
        </>)}
        <label className="quote-checkbox"><input type="checkbox" checked={settings.taxExempt} onChange={e=>cfg("taxExempt",e.target.checked)}/> Default to tax-exempt</label>
        <Field label="Default payment instructions"><textarea maxLength={2000} value={settings.instructions} onChange={e=>cfg("instructions",e.target.value)} /></Field>
        <Field label="Default terms and conditions"><textarea maxLength={4000} value={settings.terms} onChange={e=>cfg("terms",e.target.value)} /></Field>
      </Section>
      <Section title="Enabled currencies">
        {settings.currencies.map((item,index)=><div className="quote-actions" key={index}>
          <Field label="Currency code"><input size={8} maxLength={3} value={item.code} onChange={e=>{
            const code=e.target.value.toUpperCase();setSettings({...settings,currency:settings.currency===item.code?code:settings.currency,
              currencies:settings.currencies.map((entry,i)=>i===index?{...entry,code}:entry)});
          }}/></Field>
          <Field label="Minor-unit digits"><select value={item.digits} onChange={e=>cfg("currencies",settings.currencies.map((entry,i)=>i===index?{...entry,digits:Number(e.target.value)}:entry))}>
            {[0,1,2,3].map(value=><option key={value}>{value}</option>)}</select></Field>
          <Button type="button" variant="ghost" disabled={item.code===settings.currency} onClick={()=>cfg("currencies",settings.currencies.filter((_,i)=>i!==index))}>Remove</Button>
        </div>)}
        <Button type="button" variant="outline" disabled={settings.currencies.length>=20} onClick={()=>cfg("currencies",[...settings.currencies,{code:"",digits:2}])}>Add currency</Button>
      </Section>
      <Section title="PDF and business information">
        {row(<>
          {(["company","address","email","phone","signature","registration","taxId"] as const).map(key=><Field key={key} label={{
            company:"Company name",address:"Business address",email:"Business email",phone:"Business phone",signature:"Authorized signer",
            registration:"Registration identifier",taxId:"Tax identifier",
          }[key]}><input type={key==="email"?"email":"text"} value={settings[key]} onChange={e=>cfg(key,e.target.value)}/></Field>)}
          <Field label="PDF layout"><select value={settings.layout} onChange={e=>cfg("layout",e.target.value as typeof settings.layout)}><option value="standard">Standard A4</option><option value="compact">Compact A4</option></select></Field>
        </>)}
        <label className="quote-checkbox"><input type="checkbox" checked={settings.verifiedIdentifiers} onChange={e=>cfg("verifiedIdentifiers",e.target.checked)}/> Publish verified registration and tax identifiers</label>
        <Field label="PDF footer"><textarea value={settings.footer} maxLength={400} onChange={e=>cfg("footer",e.target.value)}/></Field>
        <div className="quote-grid">{([["logoKey","Company logo"],["signatureKey","Authorized signature"]] as const).map(([field,label])=><div key={field}>
          <p className="text-sm font-medium">{label} · PNG or JPEG, up to 1 MB</p>
          <ImageUpload label={label} value={settings[field]||null} onChange={key=>cfg(field,key??"")}
            onUploadingChange={isUploading=>setUploading(old=>({...old,[field]:isUploading}))}/>
        </div>)}</div>
      </Section>
    </>}
    <div className="quote-actions"><Button type="submit" disabled={disabled}>{busy?"Saving…":"Save"}</Button>
      {id&&mode!=="settings"&&<Button type="button" variant="destructive" onClick={deleteRecord} disabled={disabled}>Delete saved record</Button>}</div>
  </form>;
}
