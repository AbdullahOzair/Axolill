import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { badRequest, db, json, loadProject, mutationJson, newId, notFound, parseBody, requireSession } from "@/lib/api";
import { inquiry, milestone, portalNotificationRead, projectFile, projectWorkspace, projectWorkspaceEntry, quotation, quotationInvoice, invoice } from "@/lib/db/schema";
import { entryFields, minorAmount, moduleSections, projectConfigSchema, projectEntryStates, projectWords } from "@/lib/active-project";
import { activeProjectData, addActivity, saveProjectConfig, verifyProjectProof, type ProjectRow } from "@/lib/active-project-store";
import { quoteD1 } from "@/lib/quotation-store";
import { withApiErrors } from "@/lib/http-security";
import { limitEndpoint } from "@/lib/rate-limit";
import { projectPdf } from "@/lib/project-pdf";
import { formatQuoteMoney } from "@/lib/quotations";

const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), config: projectConfigSchema, version: z.number().int().min(0), note: z.string().trim().max(1200) }),
  z.object({ action: z.literal("entry"), input: entryFields }),
  z.object({ action: z.literal("decision"), id: z.string(), version: z.number().int().nonnegative(), state: z.enum(projectEntryStates),
    note: z.string().trim().max(1200).default(""), quoteId: z.string().max(180).default(""), amount: z.string().max(30).default(""),
    target: z.iso.date().or(z.literal("")).default(""), receipt: z.string().trim().max(120).default(""), receivedOn: z.iso.date().optional() }),
  z.object({ action: z.literal("review"), id: z.string(), version: z.number().int().min(1),
    status: z.enum(["approved", "changes_requested"]), feedback: z.string().trim().max(2000).default("") }),
  z.object({ action: z.literal("module_review"), id: z.string(), version: z.number().int().nonnegative(), choice: z.enum(["approved","changes_requested"]), feedback: z.string().trim().max(2000).default("") }),
  z.object({ action: z.literal("read"), key: z.string().max(600).optional() }),
]);

export const activeProjectHandler = withApiErrors("project workspace", async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const auth = await requireSession(request.method === "GET" ? undefined : request);
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const row = await loadProject(id, auth.user);
  if (row instanceof Response) return row;
  const admin = auth.user.role === "admin";
  const url = new URL(request.url);
  if (request.method === "GET") {
    const data = await activeProjectData(row, auth.user);
    const kind = url.searchParams.get("document");
    if (!kind) return json(data);
    const limited = await limitEndpoint(request, "quote_pdf", auth.user.id);
    if (limited) return limited;
    const key = url.searchParams.get("entry");
    const preview = url.searchParams.get("view") === "1";
    if (kind === "invoice") {
      const invoice = data.invoices.find((item) => item.id === key && item.status !== "draft");
      if (!invoice) return notFound("Invoice unavailable.");
      const format = (value: number) => formatQuoteMoney(value, invoice.currency, invoice.digits);
      return projectPdf("Invoice " + invoice.number, [row.name, "Issued " + invoice.createdAt.toISOString().slice(0, 10),
        "Due " + invoice.dueDate.toISOString().slice(0, 10), "Amount " + format(invoice.minor),
        "Verified payments " + format(invoice.paid), "Outstanding " + format(invoice.balance),
        data.config.instructions || "Contact Axonill for payment instructions."], invoice.number, preview);
    }
    if (kind === "receipt") {
      const bill = data.invoices.find((item) => item.status !== "draft" && item.payments.some((payment) => payment.id === key));
      const receipt = bill?.payments.find((payment) => payment.id === key);
      if (!bill || !receipt) return notFound("Receipt unavailable.");
      return projectPdf("Payment receipt " + receipt.receipt, [row.name, "Invoice " + bill.number,
        "Verified amount " + formatQuoteMoney(receipt.amount, bill.currency, bill.digits), "Received " + receipt.receivedOn], receipt.receipt, preview);
    }
    const entry = data.events.find((item) => item.id === key && item.kind === "report" && item.state === "published");
    if (kind !== "report" || !entry) return notFound("Report unavailable.");
    return projectPdf(entry.data.title, [row.name, entry.data.period + " report  " + entry.data.date + "  " + entry.data.target, entry.data.body, entry.data.extra], entry.id, preview);
  }
  const body = await parseBody(request, mutation);
  if (body instanceof Response) return body;
  const conflict = (message: string) => json({ error: message }, 409);
  if (body.action === "read") {
    const { notifications } = await activeProjectData(row, auth.user);
    const unread = notifications.filter((item) => !item.read && (!body.key || body.key === item.key));
    const d1 = quoteD1();
    for (let index = 0; index < unread.length; index += 40)
      await d1.batch(unread.slice(index, index + 40).map(({ key }) => d1.prepare("insert or ignore into portal_notification_read(userId,key) values(?,?)").bind(auth.user.id, key)));
    return json({ saved: true });
  }
  if (body.action === "settings") {
    if (!admin) return notFound();
    const current = await activeProjectData(row, auth.user);
    if ([...body.config.team, body.config.managerId].some((id) => id && !current.teamOptions.some((person) => person.id === id)))
      return badRequest("Choose team members with published profiles.");
    if ((body.config.target && body.config.target !== row.targetDate.toISOString().slice(0, 10) ||
      body.config.start && body.config.start !== row.startDate.toISOString().slice(0, 10)) && !body.note) return badRequest("Explain the schedule change.");
    if (body.config.status === "completed" && (body.config.stages.some((stage)=>stage.status!=="completed") || !current.events.some((event) => event.kind === "handover" && event.state === "published") ||
      current.milestones.some((item) => !["approved","completed"].includes(item.status)) || current.invoices.some((bill) => bill.status === "draft" || bill.balance > 0) || current.financial.some((item) => item.hasAgreement && item.unbilled > 0)))
      return badRequest("Publish the handover, finish milestone approvals, and settle project invoices before completing this project.");
    const dateHistory = [
      body.config.start && body.config.start !== row.startDate.toISOString().slice(0, 10) ? "Kickoff: " + row.startDate.toISOString().slice(0, 10) + " → " + body.config.start : "",
      body.config.target && body.config.target !== row.targetDate.toISOString().slice(0, 10) ? "Delivery: " + row.targetDate.toISOString().slice(0, 10) + " → " + body.config.target : "",
    ].filter(Boolean).join(". ");
    const saved = await saveProjectConfig(row, auth.user, body.config, [body.note, dateHistory].filter(Boolean).join("\n"), body.version);
    return saved ? mutationJson(auth.user, "project.workspace.settings", { saved: true }) : conflict("The project plan changed. Reload and try again.");
  }
  if (body.action === "review") {
    if (admin) return badRequest("Only the project client may review a deliverable.");
    if (body.status === "changes_requested" && !body.feedback) return badRequest("Describe the changes you need.");
    const d1 = quoteD1();
    const eventId = newId();
    const result = await d1.batch([
      d1.prepare(`insert into project_workspace_entry(id,projectId,actorId,kind,state,data)
        select ?,m.projectId,?,'milestone_review',?,json_set(?,'$.milestoneVersion',m.reviewVersion,'$.files',
          json(coalesce((select json_group_array(id) from project_file f where f.milestoneId=m.id and f.projectId=m.projectId and f.clientVisible=1 and not exists(select 1 from project_file newer where newer.previousVersionId=f.id and newer.clientVisible=1)),'[]')))
        from milestone m where m.id=? and m.projectId=? and m.reviewVersion=? and m.status='awaiting_approval'
        and exists(select 1 from project where id=m.projectId and clientId=?)`)
        .bind(eventId, auth.user.id, body.status, JSON.stringify(entryFields.parse({ kind: "activity", reference: body.id, body: body.feedback })),
          body.id, row.id, body.version, auth.user.id),
      d1.prepare(`update milestone set status=?,updatedAt=unixepoch() where id=? and exists(select 1 from project_workspace_entry where id=?)`).bind(body.status, body.id, eventId),
    ]);
    return result[0].meta.changes ? mutationJson(auth.user, "project.workspace.review", { saved: true }) : conflict("This deliverable changed. Reload and review the current version first.");
  }
  const limited = await limitEndpoint(request, "project_workspace", auth.user.id);
  if (limited) return limited;
  const database = db();
  if (body.action === "module_review") {
    if (admin || body.choice === "changes_requested" && !body.feedback) return badRequest("Explain the requested changes.");
    const item = await database.select().from(projectWorkspaceEntry).where(and(eq(projectWorkspaceEntry.id,body.id),eq(projectWorkspaceEntry.projectId,id),
      eq(projectWorkspaceEntry.kind,"module"),eq(projectWorkspaceEntry.state,"pending"),eq(projectWorkspaceEntry.version,body.version))).get();
    if (!item?.data.module) return conflict("This item is no longer awaiting review.");
    const settings = await database.select().from(projectWorkspace).where(eq(projectWorkspace.projectId,id)).get();
    if (!settings?.config.modules.includes(item.data.module)) return notFound();
    const d1 = quoteD1();
    const eventId = newId();
    const result = await d1.batch([
      d1.prepare(`insert into project_workspace_entry(id,projectId,actorId,kind,state,data)
        select ?,projectId,?,'activity','published',? from project_workspace_entry where id=? and projectId=? and version=? and state='pending'`)
        .bind(eventId,auth.user.id,JSON.stringify(entryFields.parse({kind:"activity",title:((body.choice==="approved"?"Approved: ":"Changes requested: ")+item.data.title).slice(0,160),body:body.feedback,reference:item.id})),item.id,id,body.version),
      d1.prepare("update project_workspace_entry set state=?,version=version+1,updatedAt=unixepoch() where id=? and exists(select 1 from project_workspace_entry where id=?)")
        .bind(body.choice,item.id,eventId),
    ]);
    return result[0].meta.changes?mutationJson(auth.user,"project.module.review",{saved:true}):conflict("This item has changed.");
  }
  if (body.action === "entry") {
    const input = body.input;
    const kinds = admin ? ["message", "report", "handover", "module"] : ["message", "change", "support", "proof", "feedback"];
    if (!kinds.includes(input.kind) || !input.body || (["change", "support", "report", "handover", "module"].includes(input.kind) && !input.title))
      return badRequest("Complete the required fields for this item.");
    if (input.kind === "module") {
      const settings = await database.select().from(projectWorkspace).where(eq(projectWorkspace.projectId,id)).get();
      if (!input.module || !settings?.config.modules.includes(input.module) || !moduleSections[input.module].includes(input.category))
        return badRequest("Select a category in an enabled project module.");
    }
    if (input.parentId) {
      const parent = await database.select().from(projectWorkspaceEntry).where(and(eq(projectWorkspaceEntry.id, input.parentId), eq(projectWorkspaceEntry.projectId, id))).get();
      if (!parent || !["support", "change"].includes(parent.kind) || ["closed", "resolved", "declined"].includes(parent.state) || input.kind !== "message")
        return notFound("Conversation unavailable.");
    }
    if (input.fileId) {
      const file = await database.select({ id: projectFile.id }).from(projectFile).where(and(eq(projectFile.projectId, id),
        eq(projectFile.id, input.fileId), eq(projectFile.clientVisible, true),
        input.kind === "proof" ? eq(projectFile.uploadedBy, auth.user.id) : undefined)).get();
      if (!file) return notFound("Attachment unavailable.");
    }
    if (input.kind === "proof") {
      const data = await activeProjectData(row, auth.user);
      const bill = data.invoices.find((item) => item.id === input.invoiceId);
      const amount = bill && minorAmount(input.amount, bill.digits);
      if (!bill || !amount || amount > bill.balance || !input.fileId || !input.reference || !input.date || input.date > new Date().toISOString().slice(0,10))
        return badRequest("Select an issued invoice and provide an amount within its balance, a receipt reference, date, and proof file.");
    }
    if (input.kind === "feedback") {
      const data = await activeProjectData(row, auth.user);
      if (data.config.status !== "completed" || !input.scores) return badRequest("Feedback is available after the project is complete.");
    }
    const state = input.kind === "proof" || (input.kind === "module" && input.needsReview) ? "pending" : ["change", "support"].includes(input.kind) ? "open" : "published";
    const entryId = newId();
    if (input.kind === "proof") {
      const inserted = await quoteD1().prepare(`insert into project_workspace_entry(id,projectId,actorId,kind,state,data)
        select ?,?,?,'proof','pending',? where not exists(select 1 from project_workspace_entry
        where projectId=? and kind='proof' and state in ('pending','verified')
        and json_extract(data,'$.invoiceId')=? and lower(json_extract(data,'$.reference'))=lower(?))`)
        .bind(entryId,id,auth.user.id,JSON.stringify(input),id,input.invoiceId,input.reference).run();
      return inserted.meta.changes ? mutationJson(auth.user,"project.workspace.entry.proof",{id:entryId},201) :
        conflict("You already submitted this payment reference.");
    }
    await database.insert(projectWorkspaceEntry).values({ id: entryId, projectId: id, actorId: auth.user.id,
      kind: input.kind, state, data: { ...input, quoteId: "", invoiceId: "", publishConsent: input.kind === "feedback" && input.publishConsent } });
    return mutationJson(auth.user, "project.workspace.entry." + input.kind, { id: entryId }, 201);
  }
  if (!admin) return notFound();
  const entry = await database.select().from(projectWorkspaceEntry).where(and(eq(projectWorkspaceEntry.id, body.id),
    eq(projectWorkspaceEntry.projectId, id), eq(projectWorkspaceEntry.version, body.version))).get();
  if (!entry) return conflict("This item changed. Reload and try again.");
  const allowed: Record<string, string[]> = {
    change: ["under_review", "declined", "approved", "awaiting_client", "closed"],
    support: ["under_review", "in_progress", "awaiting_client", "resolved", "closed"],
    proof: ["verified", "rejected"],
  };
  if (!allowed[entry.kind]?.includes(body.state) || (entry.kind === "proof" && entry.state !== "pending")) return badRequest("This update is unavailable.");
  if (entry.kind === "proof" && body.state === "verified") {
    if (!body.receipt || !body.receivedOn || body.receivedOn > new Date().toISOString().slice(0,10)) return badRequest("Enter a unique receipt reference and the date received.");
    return await verifyProjectProof(row, entry, auth.user, body.receipt, body.receivedOn) ?
      mutationJson(auth.user, "project.workspace.payment.verified", { saved: true }) :
      conflict("The receipt is duplicate, the balance changed, or the payment is already verified.");
  }
  const quoteId = body.quoteId || entry.data.quoteId;
  if (["change", "support"].includes(entry.kind) && quoteId) {
    const workspace = await activeProjectData(row, auth.user);
    if (workspace.agreements.some((item) => item.id === quoteId && item.original)) return badRequest("Choose a separate quotation for this change.");
    const quote = await database.select({ id: quotation.id, status: quotation.status, leadId: quotation.leadId })
      .from(quotation).where(and(eq(quotation.id, quoteId), eq(quotation.clientId, row.clientId),
        eq(quotation.archived, false), eq(quotation.deleted, false))).get();
    const link = quote?.leadId ? await database.select({ project: inquiry.convertedProjectId }).from(inquiry).where(eq(inquiry.id, quote.leadId)).get() : null;
    const otherInvoice = await database.select({ id: invoice.id }).from(quotationInvoice).innerJoin(invoice,eq(invoice.id,quotationInvoice.invoiceId))
      .where(and(eq(quotationInvoice.quotationId,quoteId),sql`${invoice.projectId} != ${id}`)).get();
    const otherRequest = await database.select({ id: projectWorkspaceEntry.id }).from(projectWorkspaceEntry).where(
      sql`${projectWorkspaceEntry.projectId} != ${id} and ${projectWorkspaceEntry.kind} in ('change','support')
        and json_extract(${projectWorkspaceEntry.data},'$.quoteId')=${quoteId}`).get();
    if (!quote || (quote.leadId && link?.project !== id) || otherInvoice || otherRequest)
      return badRequest("Select a quotation belonging to this project and client.");
    if (body.state === "approved" && !["accepted", "invoiced"].includes(quote.status))
      return badRequest("The client must accept the linked change quotation first.");
  }
  if (entry.kind === "change" && body.state === "approved" && !quoteId)
    return badRequest("Link an accepted quotation to approve this change.");
  if (entry.kind === "change" && body.state === "approved") {
    if (body.target && Date.parse(body.target) < row.startDate.getTime()) return badRequest("The revised delivery date must follow kickoff.");
    const d1 = quoteD1();
    const historyId = newId();
    const update = { ...entry.data, extra: body.note, quoteId, target: body.target, amount: body.amount };
    const details = (body.note ? body.note + "\n" : "") + (body.target ?
      "Delivery changed from " + row.targetDate.toISOString().slice(0,10) + " to " + body.target : "");
    const statements = [
      d1.prepare(`insert into project_workspace_entry(id,projectId,actorId,kind,state,data)
        select ?,projectId,?,'activity','published',? from project_workspace_entry where id=? and projectId=? and version=?
        and exists(select 1 from quotation where id=? and clientId=? and status in ('accepted','invoiced') and deleted=0 and archived=0)`)
        .bind(historyId,auth.user.id,JSON.stringify(entryFields.parse({kind:"activity",title:("Scope change approved: "+entry.data.title).slice(0,160),body:details})),
          entry.id,row.id,entry.version,quoteId,row.clientId),
      d1.prepare("update project_workspace_entry set state='approved',data=?,version=version+1,updatedAt=unixepoch() where id=? and exists(select 1 from project_workspace_entry where id=?)")
        .bind(JSON.stringify(update),entry.id,historyId),
      ...(body.target ? [
        d1.prepare("update project set targetDate=?,updatedAt=unixepoch() where id=? and exists(select 1 from project_workspace_entry where id=?)").bind(Date.parse(body.target)/1000,row.id,historyId),
        d1.prepare("update project_workspace set config=json_set(config,'$.target',?),version=version+1 where projectId=? and exists(select 1 from project_workspace_entry where id=?)").bind(body.target,row.id,historyId),
      ] : []),
    ];
    return (await d1.batch(statements))[0].meta.changes ? mutationJson(auth.user,"project.workspace.change.approved",{saved:true}) :
      conflict("The accepted quotation or request changed. Refresh and try again.");
  }
  const [saved] = await database.update(projectWorkspaceEntry).set({ state: body.state,
    data: { ...entry.data, extra: body.note, ...(entry.kind === "change" ? { quoteId, target: body.target, amount: body.amount } : entry.kind === "support" ? { quoteId } : {}) },
    version: entry.version + 1, updatedAt: sql`unixepoch()` }).where(and(eq(projectWorkspaceEntry.id, body.id),
      eq(projectWorkspaceEntry.projectId, id), eq(projectWorkspaceEntry.version, body.version))).returning({ id: projectWorkspaceEntry.id });
  if (!saved) return conflict("This item changed. Reload and try again.");
  return mutationJson(auth.user, "project.workspace." + entry.kind + ".decision", { saved: true });
});

export async function recordLegacyProjectUpdate(row: ProjectRow, actorId: string, changes: { startDate?: string; targetDate?: string; stage?: string; progress?: number }) {
  if (changes.stage !== undefined && changes.stage !== row.stage || changes.progress !== undefined && changes.progress !== row.progress)
    await addActivity(row.id, actorId, "Delivery progress updated", changes.stage || (changes.progress + "%"));
}
