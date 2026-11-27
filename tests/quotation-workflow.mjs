import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const root=fileURLToPath(new URL("../",import.meta.url));
const origin=new URL(process.env.AXONILL_TEST_URL??"http://localhost:8791");
const fixture=path.resolve(process.env.AXONILL_TEST_FIXTURE??"");
assert.ok(["localhost","127.0.0.1"].includes(origin.hostname));
assert.equal(path.dirname(fixture),path.join(root,".wrangler"));
assert.ok(path.basename(fixture).startsWith("security-check-"));
const config=JSON.parse(readFileSync(path.join(fixture,"wrangler.json"),"utf8"));
assert.ok(config.workers_dev===false&&!config.routes&&!config.account_id);
const api="/api/admin/quotations";

async function request(route,{method="GET",body,cookies,expected=200,foreign=false}={}) {
  const headers=new Headers();
  if(method!=="GET")headers.set("origin",foreign?"https://foreign.example":origin.origin);
  if(body!==undefined)headers.set("content-type","application/json");
  if(cookies?.length)headers.set("cookie",cookies.join("; "));
  const response=await fetch(new URL(route,origin),{method,headers,body:body===undefined?undefined:JSON.stringify(body),
    redirect:"manual",signal:AbortSignal.timeout(30_000)});
  const label=route.replace(/\/share\/[a-f0-9]{64}/,"/share/<token>");
  if(Array.isArray(expected))assert.ok(expected.includes(response.status),method+" "+label+" returned "+response.status);
  else assert.equal(response.status,expected,method+" "+label+" returned "+response.status);
  if(response.headers.get("content-type")?.includes("application/json"))return {response,data:await response.json()};
  return {response};
}
const cookiesFrom=response=>response.headers.getSetCookie().map(value=>value.split(";")[0]);
const run=randomUUID();
const credentialFile=path.join(fixture,"quotation-test-admin.json");
if(process.argv.includes("--prepare-admin")) {
  const email="quotation-"+run+"@example.com";
  let stdout;
  try {
    stdout=execFileSync(process.execPath,[path.join(root,"node_modules/tsx/dist/cli.mjs"),path.join(root,"scripts/create-admin.ts"),email],
      {cwd:fixture,encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  } catch (error) {
    const reason=String(error.stderr??"").match(/Wrangler could not execute the database batch[^\r\n]*/)?.[0];
    throw new Error(reason??"Could not provision an isolated quotation test admin.");
  }
  const password=stdout.match(/Generated password \(shown once\): ([\w-]+)/)?.[1];
  assert.ok(password,"The isolated admin script did not produce a credential");
  writeFileSync(credentialFile,JSON.stringify({email,password}),{mode:0o600});
  console.log("Isolated quotation test administrator prepared.");
  process.exit(0);
}
await request(api,{expected:401});
await request(api+"/analytics",{expected:401});
const signedUp=await request("/api/auth/sign-up/email",{method:"POST",body:{
  name:"Portal client fixture",email:"portal-"+run+"@example.com",password:randomBytes(24).toString("hex"),
}});
const clientCookies=cookiesFrom(signedUp.response);
await request(api+"/options",{cookies:clientCookies,expected:403});
await request(api+"/config",{method:"POST",cookies:clientCookies,body:{},expected:403});
const credentials=JSON.parse(readFileSync(credentialFile,"utf8"));
const adminCookies=cookiesFrom((await request("/api/auth/sign-in/email",{method:"POST",body:credentials})).response);
const admin=(route,options={})=>request(route,{...options,cookies:adminCookies});
const body=(route,data,expected=200)=>admin(route,{method:"POST",body:data,expected});
const action=(id,type,fields={},expected=200)=>body(api+"/"+id,{action:type,...fields},expected);
const source=randomUUID();
const clientEmail="sales-"+run+"@example.com";
await request("/api/inquiries",{method:"POST",expected:201,body:{
  type:"IDEA",requestId:source,category:"A website or application",name:"Quotation Fixture Client",email:clientEmail,
  company:"Quotation Fixture Business",phone:"+923001234567",country:"PK",budget:38000,currency:"PKR",
  description:"New website",objectives:"Clear enquiry funnel",timeline:"A month",
}});
const {data:options}=await admin(api+"/options?source="+source);
assert.equal(options.input.inquiryId,source);
assert.equal(options.input.client.email,clientEmail);
assert.equal(options.sourceBudget.amount,38000);
const service=(await body("/api/services",{icon:"CodeXml",title:"Quotation fixture service"},201)).data.service;
const template={name:"Fixture template",category:"Web",description:"Description",scope:"Scope",deliverables:"Deliverables",
  timeline:"One month",terms:"Terms",instructions:"Instructions"};
const templateId=(await body(api+"/config",{kind:"template",data:template})).data.id;
const line={...options.input.lines[0],serviceId:service.id,name:service.title,category:"Web",unitPrice:3800000,cost:3100,
  description:"Design, development and production handoff."};
const preset={...line,currency:"PKR",region:"national",timeline:"One month"};
const presetId=(await body(api+"/config",{kind:"preset",data:preset})).data.id;
await body(api+"/config",{kind:"settings",data:{...options.settings,
  currencies:[...options.settings.currencies.filter(item=>item.code!=="CAD"),{code:"CAD",digits:2}]}});
await admin(api,{method:"POST",foreign:true,body:{},expected:403});

const input={...options.input,title:"Website design and development",lines:[line],discount:300000,
  privateNotes:"PRIVATE QUOTATION NOTES",scope:"Website delivery",terms:"Payment according to the schedule."};
const q1=(await body(api,input,201)).data.quote;
assert.match(q1.number,/^AXN-QT-\d{4}-\d{4,}$/);
assert.equal(q1.oneTime,3500000);
assert.ok(q1.clientId);
assert.equal(q1.leadId,source);
const q2=(await action(q1.id,"duplicate")).data.quote;
assert.notEqual(q2.number,q1.number);
assert.equal(q2.clientId,q1.clientId);
const clients=(await admin("/api/clients")).data.clients.filter(item=>item.email===clientEmail);
assert.equal(clients.length,1);
const stale={version:q1.version+5,input};
await admin(api+"/"+q1.id,{method:"PATCH",body:stale,expected:409});
const edited=(await admin(api+"/"+q1.id,{method:"PATCH",body:{version:q1.version,input:{...input,title:"Revised website scope"}}})).data.quote;
assert.equal(edited.version,q1.version+1);
assert.equal(edited.oneTime,3500000);
await body(api+"/config",{kind:"preset",id:presetId,data:{...preset,unitPrice:9999900}});
assert.equal((await admin(api+"/"+q1.id)).data.quote.input.lines[0].unitPrice,3800000);
await body(api+"/config",{kind:"delete-template",id:templateId});
await action(q2.id,"archive",{version:q2.version});
assert.ok((await admin(api+"?archived=1&q="+q2.number)).data.quotes.some(item=>item.id===q2.id));

async function shareQuote(quote) {
  const pending=(await action(quote.id,"submit",{version:quote.version,note:""})).data.quote;
  const approved=(await action(quote.id,"approve",{version:pending.version,note:""})).data.quote;
  await action(quote.id,"delivery_failure",{note:"Test delivery failure"});
  const share=(await action(quote.id,"share",{version:approved.version,days:2})).data;
  const publicPath="/api/quotations/share/"+new URL(share.url).pathname.split("/").pop();
  await request(publicPath,{expected:404});
  await action(quote.id,"sent",{version:approved.version,note:"Verified external delivery"});
  return {...share,publicPath};
}
const original=await shareQuote(edited);
const publicQuote=(await request(original.publicPath)).data.quote;
assert.equal(publicQuote.oneTime.total,3500000);
assert.deepEqual(publicQuote.milestones.map(item=>item.amount),[1050000,2450000]);
assert.doesNotMatch(JSON.stringify(publicQuote),/PRIVATE QUOTATION NOTES|"cost"|"profit"|tokenHash|codeHash/);
await request(original.publicPath,{method:"POST",foreign:true,body:{action:"accept",code:original.code},expected:403});
await request(original.publicPath,{method:"POST",body:{action:"accept",code:"0".repeat(32)},expected:403});
await request(original.publicPath,{method:"POST",body:{action:"view"}});
assert.equal((await request(original.publicPath)).data.quote.status,"viewed");
const accepted=(await request(original.publicPath,{method:"POST",body:{action:"accept",code:original.code,comment:"Approved scope."}})).data.quote;
assert.equal(accepted.status,"accepted");
await request(original.publicPath,{method:"POST",body:{action:"accept",code:original.code},expected:409});
const revised=(await action(q1.id,"revision")).data.quote;
assert.equal(revised.revision,2);
assert.equal(revised.number,q1.number);
assert.equal((await admin(api+"/"+q1.id)).data.quote.status,"accepted");
await request(original.publicPath,{expected:404});
const next=await shareQuote(revised);
const publicPage=await request(new URL(next.url).pathname);
assert.match(publicPage.response.headers.get("cache-control"),/no-store/);
assert.equal(publicPage.response.headers.get("referrer-policy"),"no-referrer");
const publicHtml=await publicPage.response.text();
assert.match(publicHtml,/Revised website scope/);
assert.doesNotMatch(publicHtml,/PRIVATE QUOTATION NOTES|tokenHash|codeHash/);
const pdfResponse=await request(next.publicPath+"/pdf");
assert.match(pdfResponse.response.headers.get("content-type"),/application\/pdf/);
assert.ok((await PDFDocument.load(await pdfResponse.response.arrayBuffer())).getPageCount()>=1);
const verification=(await request(next.publicPath,{method:"POST",body:{action:"accept",code:next.code}})).data.quote;
assert.equal(verification.revision,2);

const version=(await admin(api+"/"+revised.id)).data.quote.version;
const invoice=(await action(revised.id,"invoice",{version,projectId:"",due:input.expiry})).data;
await action(revised.id,"invoice",{version,projectId:"",due:input.expiry},[400,409]);
const invoiceDetail=(await admin("/api/invoices/"+invoice.invoiceId)).data;
assert.equal(invoiceDetail.invoice.amount,35000);
assert.equal(invoiceDetail.quotation.revision,2);
await admin("/api/invoices/"+invoice.invoiceId,{method:"PATCH",body:{amount:1},expected:400});
await action(revised.id,"payment",{amount:1050000,receipt:"R-1",receivedOn:input.issue});
await action(revised.id,"payment",{amount:1050000,receipt:"R-1",receivedOn:input.issue},409);
await action(revised.id,"payment",{amount:2450000,receipt:"R-2",receivedOn:input.issue});
assert.equal((await admin("/api/invoices/"+invoice.invoiceId)).data.invoice.status,"paid");
const totals=(await admin(api+"/analytics?currency=PKR&q="+q1.number)).data;
assert.equal(totals.money[0].acceptedOneTime,3500000);
assert.equal(totals.invoices[0].received,3500000);
assert.equal(totals.funnel.quoted,1);
assert.equal(totals.funnel.accepted,1);

const long=(await body(api,{...input,title:"Révision — Δοκιμή",currency:"USD",discount:0,lines:Array.from({length:30},(_,i)=>({...line,name:"Service "+i,
  description:"Specified design work, functional review and production handoff. ".repeat(4)}))},201)).data.quote;
const manyPages=await admin(api+"/"+long.id+"/pdf?view=1");
assert.match(manyPages.response.headers.get("content-disposition"),/^inline/);
assert.ok((await PDFDocument.load(await manyPages.response.arrayBuffer())).getPageCount()>1);
await request(api+"/"+long.id+"/pdf",{cookies:clientCookies,expected:403});
const linkId=(await admin(api+"/"+revised.id)).data.links[0].id;
await action(revised.id,"revoke",{shareId:linkId});
await request(next.publicPath,{expected:404});
await admin("/admin/quotations/overview");
await admin("/admin/quotations/new?source="+source);
if(process.env.AXONILL_QUOTE_BROWSER_SESSION==="1")writeFileSync(path.join(fixture,"quote-browser.json"),JSON.stringify({cookies:adminCookies,quoteId:revised.id,source}));
console.log("Quotation workflow passed on isolated Cloudflare D1: inquiry, clients, settings, presets, templates, drafts, locking, revisions, secure response, PDFs, invoices, receipts, analytics, and admin pages.");
