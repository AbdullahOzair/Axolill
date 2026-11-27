"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { useLoader } from "@/lib/use-api";
import type { listQuotations, quotationAnalytics } from "@/lib/quotation-analytics";
import { formatQuoteMoney, QUOTE_LABELS, QUOTE_STATUSES, type QuoteStatus } from "@/lib/quotations";
import { adminQuotePath, Field, quoteApi, QuoteErrorMessage, requestQuote, Section, stamp } from "./shared";

type Analytics = Awaited<ReturnType<typeof quotationAnalytics>>;
type Entries = Awaited<ReturnType<typeof listQuotations>>;
type Metric = Record<string,string|number|null>;
const n=(row:Metric|undefined,name:string)=>Number(row?.[name]??0);
const s=(row:Metric|undefined,name:string)=>String(row?.[name]??"");
const responseRate=(accepted:number,sent:number)=>sent ? (accepted/sent*100).toFixed(1)+"%" : "—";

export function QuoteDashboard({ overview }: { overview:boolean }) {
  const [filters,setFilters]=useState("");
  const [page,setPage]=useState(1);
  const query=useLoader<Analytics | Entries>(()=> overview
    ? requestQuote<Analytics>(quoteApi+"/analytics?"+filters)
    : requestQuote<Entries>(quoteApi+"?"+filters+"&page="+page));
  const choices=useLoader(()=>requestQuote<Analytics>(quoteApi+"/analytics"));
  function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search=new URLSearchParams();
    for(const [key,value] of new FormData(event.currentTarget)) if(String(value).trim())search.set(key,String(value));
    setFilters(search.toString());setPage(1);query.reload();
  }
  function pageChange(next:number){setPage(next);query.reload();}
  const table=query.data && "quotes" in query.data ? query.data : null;
  const stats=query.data && "statuses" in query.data ? query.data : null;
  const currencies=choices.data?.currencies??[];
  return <AdminPage eyebrow="Quotations" title={overview?"Sales overview":"All quotations"}
    description={overview?"Quotation performance, payment records, and follow-ups.":"Find, review, and manage quotation revisions."}
    action={<Link className="quote-link quote-primary" href={adminQuotePath+"/new"}>Create quotation</Link>}>
    <div className="quote-stack">
      <form onSubmit={submit} className="quote-panel quote-filters">
        <Field label="Search"><input name="q" placeholder="Number, project, or client" maxLength={120}/></Field>
        <Field label="From"><input name="from" type="date"/></Field>
        <Field label="To"><input name="to" type="date"/></Field>
        <Field label="Currency"><select name="currency"><option value="">All currencies</option>{currencies.map(code=><option key={code}>{code}</option>)}</select></Field>
        <Field label="Service category"><select name="category"><option value="">All categories</option>{choices.data?.categories.map(category=><option key={String(category.label)}>{category.label}</option>)}</select></Field>
        <Field label="Region"><select name="region"><option value="">All regions</option><option value="national">National</option><option value="international">International</option></select></Field>
        <Field label="Status"><select name="status"><option value="">All statuses</option>{QUOTE_STATUSES.map(status=><option key={status} value={status}>{QUOTE_LABELS[status]}</option>)}</select></Field>
        <Field label="Records"><select name="archived"><option value="0">Active</option><option value="1">Archived</option></select></Field>
        <Button type="submit" disabled={query.loading}>Apply filters</Button>
      </form>
      {query.loading && <p role="status">Loading quotations…</p>}
      {query.error && <><QuoteErrorMessage value={query.error}/><Button onClick={query.reload}>Retry</Button></>}
      {table && <Section title={table.total+" matching quotations"}>
        {table.quotes.length===0 ? <p className="text-sm text-muted-foreground">No quotations match these filters.</p> :
          <div className="quote-scroll"><table className="quote-table"><thead><tr>{["Number / revision","Client","Project","Currency","One-time total","Monthly total","Issue","Valid through","Status","Assigned to","Updated","Actions"].map(label=><th key={label}>{label}</th>)}</tr></thead>
          <tbody>{table.quotes.map(row=><tr key={row.id}><td>{row.number} / {row.revision}</td><td>{row.client}</td><td>{row.title}</td><td>{row.currency}</td>
            <td>{formatQuoteMoney(row.oneTime,row.currency,row.digits)}</td><td>{formatQuoteMoney(row.monthly,row.currency,row.digits)}</td>
            <td>{row.issue}</td><td>{row.expiry}</td><td><span className="quote-status">{QUOTE_LABELS[row.status]}</span></td><td>{row.staff??"Unassigned"}</td><td>{stamp(row.updatedAt)}</td>
            <td><Link className="underline" href={adminQuotePath+"/"+row.id}>Open</Link></td>
          </tr>)}</tbody></table></div>}
        <div className="quote-actions"><Button variant="outline" disabled={query.loading||table.page<=1} onClick={()=>pageChange(table.page-1)}>Previous</Button>
          <span className="text-sm">Page {table.page} of {Math.max(1,Math.ceil(table.total/20))}</span>
          <Button variant="outline" disabled={query.loading||table.page*20>=table.total} onClick={()=>pageChange(table.page+1)}>Next</Button></div>
      </Section>}
      {stats && <Overview stats={stats}/>}
    </div>
  </AdminPage>;
}

function Bar({ label, value, max, display, tone="primary" }: { label:string;value:number;max:number;display?:ReactNode;tone?:string }) {
  return <div className="quote-chart">
    <div><span>{label}</span><strong>{display??value}</strong></div>
    <div className="quote-chart-track" aria-hidden="true"><i data-tone={tone} style={{width:Math.max(0,Math.min(100,(Math.abs(value)/Math.max(1,max))*100))+"%"}}/></div>
  </div>;
}
function Empty(){return <p className="text-sm text-muted-foreground">No data for these filters.</p>;}
const fmt=(row:Metric,value:string)=>formatQuoteMoney(n(row,value),s(row,"currency"),n(row,"digits"));
function Overview({ stats }: { stats:Analytics }) {
  const count=(...statuses:string[])=>stats.statuses.filter(row=>statuses.includes(s(row,"status"))).reduce((total,row)=>total+n(row,"count"),0);
  const all=stats.statuses.reduce((total,row)=>total+n(row,"count"),0);
  const sent=stats.money.reduce((total,row)=>total+n(row,"sent"),0);
  const accepted=count("accepted","invoiced");
  const tiles=[["Total",all],["Draft",count("draft")],["Sent",sent],["Pending",count("pending_approval","approved","sent","viewed","revision_requested")],
    ["Accepted",accepted],["Declined",count("declined")],["Expired",count("expired")],["Conversion",responseRate(accepted,sent)],["Follow-up",stats.followUps]];
  const monthGroups=[...new Set(stats.months.map(row=>s(row,"currency")+"/"+n(row,"digits")))];
  return <>
    <div className="quote-kpis">{tiles.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <Section title="Financial summary by currency">
      {!stats.money.length?<Empty/>:stats.money.map(row=><div className="quote-currency" key={s(row,"currency")+n(row,"digits")}>
        <h3>{s(row,"currency")}</h3>
        <div className="quote-grid">
          {([["Quoted value","oneTime","monthly"],["Accepted value","acceptedOneTime","acceptedMonthly"],["Estimated gross profit","profit","monthlyProfit"]] as const)
            .map(([label,one,recurring])=><dl key={label}><dt>{label}</dt><dd>{fmt(row,one)} one-time</dd><dd>{fmt(row,recurring)} / month</dd></dl>)}
          <dl><dt>Average quote</dt><dd>{formatQuoteMoney(Math.round(n(row,"oneTime")/Math.max(n(row,"count"),1)),s(row,"currency"),n(row,"digits"))} one-time</dd>
            <dd>{formatQuoteMoney(Math.round(n(row,"monthly")/Math.max(n(row,"count"),1)),s(row,"currency"),n(row,"digits"))} / month</dd></dl>
          {stats.invoices.filter(inv=>s(inv,"currency")===s(row,"currency")&&n(inv,"digits")===n(row,"digits")).map(inv=><dl key={s(inv,"currency")+n(inv,"digits")}>
            <dt>Draft and issued invoices</dt><dd>{fmt(inv,"invoiced")} invoiced</dd><dd>{fmt(inv,"received")} recorded as received</dd>
          </dl>)}
        </div>
      </div>)}
    </Section>
    <div className="quote-grid">
      <Section title="Quotation statuses">{stats.statuses.length?stats.statuses.map(row=><Bar key={s(row,"status")} label={QUOTE_LABELS[s(row,"status") as QuoteStatus]} value={n(row,"count")} max={all}/>):<Empty/>}</Section>
      <Section title="Inquiry conversion funnel">
        {n(stats.funnel,"inquiries") ? [["Inquiries","inquiries"],["With a quotation","quoted"],["Accepted","accepted"]].map(([label,key])=>
          <Bar key={key} label={label} value={n(stats.funnel,key)} max={n(stats.funnel,"inquiries")}/>) : <Empty/>}
      </Section>
      <Section title="Most requested services">{stats.services.length?stats.services.map(row=><Bar key={s(row,"key")} label={s(row,"label")} value={n(row,"count")} max={n(stats.services[0],"count")}/>):<Empty/>}</Section>
      <Section title="National and international clients">{stats.regions.length?stats.regions.map(row=><Bar key={s(row,"region")}
        label={s(row,"region")==="national"?"National":"International"} value={n(row,"count")} max={stats.regions.reduce((sum,item)=>sum+n(item,"count"),0)}/>):<Empty/>}</Section>
    </div>
    <Section title="Monthly quoted value, conversion and profit">
      {!monthGroups.length?<Empty/>:monthGroups.map(key=>{
        const rows=stats.months.filter(row=>s(row,"currency")+"/"+n(row,"digits")===key);
        const maximum=Math.max(0,...rows.flatMap(row=>["oneTime","monthly","profit","monthlyProfit"].map(field=>Math.abs(n(row,field)))));
        return <details className="quote-accordion" key={key} open={monthGroups.length===1}>
          <summary>{s(rows[0],"currency")} · Issue-month cohorts</summary>
          {rows.map(row=><div className="quote-currency" key={s(row,"month")}><h3>{s(row,"month")}</h3>
            <div className="quote-grid">
              <div><Bar label="One-time quoted" value={n(row,"oneTime")} display={fmt(row,"oneTime")} max={maximum}/>
                <Bar label="One-time accepted" value={n(row,"acceptedOneTime")} display={fmt(row,"acceptedOneTime")} max={maximum} tone="cyan"/>
                <Bar label="One-time estimated profit" value={n(row,"profit")} display={fmt(row,"profit")} max={maximum} tone="magenta"/></div>
              <div><Bar label="Monthly quoted" value={n(row,"monthly")} display={fmt(row,"monthly")} max={maximum}/>
                <Bar label="Monthly accepted" value={n(row,"acceptedMonthly")} display={fmt(row,"acceptedMonthly")} max={maximum} tone="cyan"/>
                <Bar label="Monthly estimated profit" value={n(row,"monthlyProfit")} display={fmt(row,"monthlyProfit")} max={maximum} tone="magenta"/></div>
            </div>
            <Bar label="Conversion among sent" value={n(row,"accepted")} max={n(row,"sent")} display={responseRate(n(row,"accepted"),n(row,"sent"))}/>
          </div>)}
        </details>;
      })}
    </Section>
    <Section title="Quoted line value by service category">
      <p className="text-sm text-muted-foreground">Included services after line discounts, before quotation-wide discounts and tax.</p>
      {!stats.category.length?<Empty/>:[...new Set(stats.category.map(row=>s(row,"currency")+"/"+n(row,"digits")+"/"+n(row,"recurring")))].map(key=>{
        const rows=stats.category.filter(row=>s(row,"currency")+"/"+n(row,"digits")+"/"+n(row,"recurring")===key);
        const max=Math.max(0,...rows.map(row=>n(row,"value")));
        return <div className="quote-currency" key={key}><h3>{s(rows[0],"currency")} · {n(rows[0],"recurring")?"Monthly":"One-time"}</h3>
          {rows.map(row=><Bar key={s(row,"category")} label={s(row,"category")} value={n(row,"value")} display={fmt(row,"value")} max={max}/>)}
        </div>;
      })}
    </Section>
    <div className="quote-grid">
      <Section title="Approvals, expiries and follow-up">{stats.queue.length ? <ul className="quote-history">{stats.queue.map(row=><li key={s(row,"id")}>
        <Link className="underline" href={adminQuotePath+"/"+s(row,"id")}>{s(row,"number")}</Link> · {QUOTE_LABELS[s(row,"status") as QuoteStatus]} · {s(row,"expiry")}<p>{s(row,"title")}</p>
      </li>)}</ul> : <Empty/>}</Section>
      <Section title="Recent client responses">{stats.activity.length?<ul className="quote-history">{stats.activity.map((row,index)=><li key={index}>
        <Link className="underline" href={adminQuotePath+"/"+s(row,"id")}>{s(row,"number")}</Link> · {({"accept":"Accepted","decline":"Declined","revise":"Requested changes"} as Record<string,string>)[s(row,"kind").replace("recipient_","")]} · {stamp(n(row,"createdAt"))}
      </li>)}</ul>:<Empty/>}</Section>
    </div>
  </>;
}
