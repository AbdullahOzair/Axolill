import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { badRequest, db, filesBucket, json, mutationJson, newId, notFound, parseBody, parseMultipart, requireAdmin, requireClient, type SessionUser } from "@/lib/api";
import { portalAttachment, portalNotificationRead, portalRequest, portalRequestEvent, user } from "@/lib/db/schema";
import { withApiErrors, PRIVATE_CACHE } from "@/lib/http-security";
import { requestInput, staffRequestStatuses, workspaceStatuses } from "@/lib/portal-workspace";
import { limitEndpoint } from "@/lib/rate-limit";
import { safeFileName, uploadFileToR2 } from "@/lib/r2-upload";
import { removeDraft, submitWorkspace, workspaceAttachments, workspaceD1, workspaceData, workspaceEvents, workspaceRequest, type WorkspaceRow } from "@/lib/portal-workspace-store";
import { quoteHandler } from "@/lib/quotation-api";
import { publicQuotation } from "@/lib/quotation-public";
import { quotationPdfResponse } from "@/lib/quotation-pdf";
import { changeQuotation, effectiveQuoteStatus, loadQuotation } from "@/lib/quotation-store";
import { verifyQuotationCode } from "@/lib/quotation-share";
import { portalAvailability } from "@/lib/portal-availability";

type Context = { params: Promise<{ path?: string[] }> };
const conflict = (message = "This request changed. Reopen it and try again.") => json({ error: message }, 409);
const requestEdit = z.object({ input: requestInput, version: z.number().int().min(0) });
const responseForm = z.object({ action: z.enum(["accept", "decline", "revise"]), code: z.string().trim().toLowerCase().regex(/^[a-f0-9]{32}$/), comment: z.string().trim().max(1200).default("") });
const workspaceProfile = z.object({ name: z.string().trim().min(1).max(120), company: z.string().trim().max(160), phone: z.string().trim().max(40) });
const requestMessage = z.object({ text: z.string().trim().min(1).max(4000), action: z.enum(["message", "needs_info", "response"]).default("message") });
const readRequest = z.object({ key: z.string().max(200).optional() });
const fileLimit = 5 * 1024 * 1024;
const totalFiles = 8;

async function ownQuote(id: string, userId: string) {
  const row = await loadQuotation(id);
  if (!row || row.archived || row.clientId !== userId || row.sentAt === null || ["draft", "pending_approval", "approved"].includes(row.status)) return null;
  return row;
}

async function quoteRead(request: Request, id: string, owner: string, mode?: string) {
  const row = await ownQuote(id, owner);
  if (!row) return notFound("Quotation not found.");
  const quote = publicQuotation({ ...row, status: effectiveQuoteStatus(row) });
  if (mode === "pdf") {
    const limited = await limitEndpoint(request, "quote_pdf", owner);
    return limited ?? quotationPdfResponse(quote, request);
  }
  return mode ? notFound() : json({ quote });
}

async function quoteRespond(request: Request, id: string, actor: SessionUser) {
  const limited = await limitEndpoint(request, "quote_response", actor.id);
  if (limited) return limited;
  const body = await parseBody(request, responseForm);
  if (body instanceof Response) return body;
  const row = await ownQuote(id, actor.id);
  if (!row) return notFound("Quotation not found.");
  const verification = await verifyQuotationCode(id, body.code);
  if (!verification) return json({ error: "The verification code is incorrect or has expired." }, 403);
  const saved = await changeQuotation(row, body.action, actor.id, row.version, body.comment, verification);
  return mutationJson(actor, "portal.quotation.respond", { quote: publicQuotation(saved) });
}

async function download(id: string, fileId: string) {
  const file = await db().select().from(portalAttachment)
    .where(and(eq(portalAttachment.requestId, id), eq(portalAttachment.id, fileId))).get();
  if (!file) return notFound("Attachment not found.");
  const result = await filesBucket().get(file.objectKey);
  if (!result) return notFound("Attachment not found.");
  return new Response(result.body, { headers: {
    "Cache-Control": PRIVATE_CACHE, "Content-Type": "application/octet-stream",
    "Content-Disposition": "attachment; filename=\"" + safeFileName(file.name) + "\"",
    "X-Content-Type-Options": "nosniff",
  } });
}

async function upload(request: Request, row: WorkspaceRow, actor: SessionUser) {
  const limited = await limitEndpoint(request, "portal_upload", actor.id);
  if (limited) return limited;
  const data = await parseMultipart(request, fileLimit + 128 * 1024);
  if (data instanceof Response) return data;
  const file = data.get("file");
  if (!(file instanceof File) || !file.size || file.size > fileLimit) return badRequest("Select a file up to 5 MB.");
  if (["cancelled", "closed"].includes(row.state) || (actor.role === "admin" && row.state === "draft")) return conflict("Attachments are unavailable for this request.");
  const draft = row.state === "draft";
  const caption = data.get("message");
  const requestInfo = !draft && actor.role === "admin" && data.get("action") === "needs_info";
  const respondToInfo = !draft && actor.role === "client" && row.state === "needs_info";
  if (!draft && (typeof caption !== "string" || !caption.trim() || caption.length > 4000)) return badRequest("Add a short message to explain the attachment.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const valid = (file.type === "application/pdf" && starts(37, 80, 68, 70, 45)) ||
    (file.type === "image/png" && starts(137, 80, 78, 71, 13, 10, 26, 10)) ||
    (file.type === "image/jpeg" && starts(255, 216, 255)) ||
    (file.type === "image/webp" && starts(82, 73, 70, 70) && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80);
  if (!valid) return badRequest("Upload a valid PDF, PNG, JPEG, or WebP file.");
  const id = newId();
  const event = newId();
  const key = "portal/" + row.id + "/" + id + "-" + safeFileName(file.name);
  const result = await uploadFileToR2(file, key, { requestId: row.id, actorId: actor.id });
  if (result instanceof Response) return result;
  const d1 = workspaceD1();
  const guard = "exists(select 1 from portal_request where id=? and state=? and version=?) and (select count(*) from portal_attachment where requestId=?)<?";
  const params = [row.id, row.state, row.version, row.id, totalFiles] as const;
  try {
    const inserted = await d1.batch([
      ...(!draft ? [d1.prepare(`insert into portal_request_event(id,requestId,actorId,kind,body) select ?,?,?,?,? where ${guard}`)
        .bind(event, row.id, actor.id, requestInfo ? "needs_info" : actor.role === "admin" ? "staff_message" : "client_message", String(caption).trim(), ...params)] : []),
      d1.prepare(`insert into portal_attachment(id,requestId,eventId,name,objectKey,size,contentType) select ?,?,?,?,?,?,? where ${guard}`)
        .bind(id, row.id, draft ? null : event, file.name.slice(0, 180), key, result.sizeBytes, result.contentType, ...params),
      ...(requestInfo || respondToInfo ? [d1.prepare("update portal_request set state=?,version=version+1,updatedAt=unixepoch() where id=? and exists(select 1 from portal_attachment where id=?)")
        .bind(requestInfo ? "needs_info" : "under_review", row.id, id)] : []),
    ]);
    if (!inserted[draft ? 0 : 1]?.meta.changes) {
      await filesBucket().delete(key);
      return conflict("The request changed or already has eight attachments.");
    }
  } catch (error) {
    await filesBucket().delete(key);
    throw error;
  }
  return mutationJson(actor, "portal.attachment.upload", { id }, 201);
}

async function addMessage(request: Request, row: WorkspaceRow, actor: SessionUser) {
  const limited = await limitEndpoint(request, "portal_message", actor.id);
  if (limited) return limited;
  const body = await parseBody(request, requestMessage);
  if (body instanceof Response) return body;
  if (["draft", "cancelled", "closed"].includes(row.state)) return conflict("Messaging is closed for this request.");
  if ((body.action === "needs_info" && actor.role !== "admin") || (body.action === "response" && actor.role !== "client"))
    return badRequest("This message action is unavailable.");
  const event = newId();
  const d1 = workspaceD1();
  const kind = body.action === "needs_info" ? "needs_info" : actor.role === "admin" ? "staff_message" : "client_message";
  const state = body.action === "needs_info" ? "needs_info" : body.action === "response" && row.state === "needs_info" ? "under_review" : row.state;
  const result = await d1.batch([
    d1.prepare("insert into portal_request_event(id,requestId,actorId,kind,body) select ?,id,?,?,? from portal_request where id=? and version=?")
      .bind(event, actor.id, kind, body.text, row.id, row.version),
    d1.prepare("update portal_request set state=?,version=version+1,updatedAt=unixepoch() where id=? and exists(select 1 from portal_request_event where id=?)")
      .bind(state, row.id, event),
  ]);
  return result[0].meta.changes ? mutationJson(actor, "portal.message.send", { id: event }, 201) : conflict();
}

async function statusChange(row: WorkspaceRow, actor: SessionUser, state: string, label: string) {
  if (row.state === "draft" || row.state === "cancelled") return conflict();
  const d1 = workspaceD1();
  const event = newId();
  const result = await d1.batch([
    d1.prepare(`insert into portal_request_event(id,requestId,actorId,kind,body)
      select ?,id,?,'status',? from portal_request where id=? and version=?
      and not exists(select 1 from inquiry where id=portal_request.leadId and convertedProjectId is not null)
      and (?!='cancelled' or not exists(select 1 from quotation where leadId=portal_request.leadId and status in ('accepted','invoiced') and deleted=0))`)
      .bind(event, actor.id, label, row.id, row.version, state),
    d1.prepare("update portal_request set state=?,version=version+1,updatedAt=unixepoch() where id=? and exists(select 1 from portal_request_event where id=?)")
      .bind(state, row.id, event),
    ...(state === "cancelled" ? [d1.prepare(`update inquiry set stage='lost',lostReason='Cancelled by client',version=version+1
      where id=? and exists(select 1 from portal_request_event where id=?)`).bind(row.leadId, event),
      d1.prepare(`update lead set status='lost',updatedAt=unixepoch() where id=? and exists(select 1 from portal_request_event where id=?)`).bind(row.leadId, event)] : []),
  ]);
  return result[0].meta.changes ? mutationJson(actor, "portal.request.status", { status: state }) : conflict();
}

async function clientRoute(request: Request, context: Context) {
  const write = request.method !== "GET";
  const auth = await requireClient(write ? request : undefined);
  if (auth instanceof Response) return auth;
  const actor = auth.user;
  const parts = (await context.params).path ?? [];
  const [section, id, action, fileId] = parts;

  if (parts.length === 0 && !write) return json(await workspaceData(actor.id, new URL(request.url).searchParams.get("request") ?? undefined));
  if (section === "availability" && parts.length === 1 && !write) {
    const limited = await limitEndpoint(request, "portal_availability", actor.id);
    return limited ?? json(await portalAvailability(actor.id));
  }
  if (section === "profile" && parts.length === 1 && request.method === "PATCH") {
    const limited = await limitEndpoint(request, "portal_message", actor.id);
    if (limited) return limited;
    const value = await parseBody(request, workspaceProfile);
    if (value instanceof Response) return value;
    await db().update(user).set(value).where(eq(user.id, actor.id));
    return mutationJson(actor, "portal.profile.update", { saved: true });
  }
  if (section === "notifications" && parts.length === 1 && request.method === "POST") {
    const body = await parseBody(request, readRequest);
    if (body instanceof Response) return body;
    const { notifications } = await workspaceData(actor.id);
    const items = notifications.filter((item) => !item.read && (!body.key || item.key === body.key));
    const d1 = workspaceD1();
    for (let start = 0; start < items.length; start += 40) {
      await d1.batch(items.slice(start, start + 40).map((item) => d1.prepare("insert or ignore into portal_notification_read(userId,key) values(?,?)").bind(actor.id, item.key)));
    }
    return json({ saved: true });
  }
  if (section === "quotations" && id && parts.length <= 3) {
    if (!write) return quoteRead(request, id, actor.id, action);
    if (request.method === "POST" && !action) return quoteRespond(request, id, actor);
  }
  if (section !== "requests" || parts.length > 4) return notFound();
  if (!id && request.method === "POST") {
    const limited = await limitEndpoint(request, "intake", actor.id);
    if (limited) return limited;
    const input = await parseBody(request, requestInput);
    if (input instanceof Response) return input;
    const requestId = newId();
    const reference = "AXN-REQ-" + requestId.replaceAll("-", "").toUpperCase();
    const inserted = await workspaceD1().prepare(`insert into portal_request(id,ownerId,reference,input)
      select ?,?,?,? where (select count(*) from portal_request where ownerId=? and state='draft')<20`)
      .bind(requestId, actor.id, reference, JSON.stringify(input), actor.id).run();
    return inserted.meta.changes ? mutationJson(actor, "portal.request.draft", { id: requestId, version: 0 }, 201) :
      conflict("Finish or delete an existing draft before starting another.");
  }
  if (!id) return notFound();
  const row = await workspaceRequest(id, actor.id);
  if (!row) return notFound("Request not found.");
  if (!write && action === "attachments" && fileId) return download(id, fileId);
  if (request.method === "POST" && action === "attachments" && !fileId) return upload(request, row, actor);
  if (request.method === "DELETE" && action === "attachments" && fileId) {
    const d1 = workspaceD1();
    const removed = await d1.prepare(`delete from portal_attachment where id=? and requestId=? and eventId is null
      and exists(select 1 from portal_request where id=? and state='draft') returning objectKey`).bind(fileId, id, id).first<{ objectKey: string }>();
    if (!removed) return notFound("Attachment not found.");
    await filesBucket().delete(removed.objectKey);
    return mutationJson(actor, "portal.attachment.delete", { deleted: true });
  }
  if (request.method === "POST" && action === "messages" && !fileId) return addMessage(request, row, actor);
  if (request.method === "POST" && action === "cancel" && !fileId) {
    if (["draft", "closed", "cancelled"].includes(row.state)) return conflict("This request cannot be cancelled.");
    return statusChange(row, actor, "cancelled", "Request cancelled");
  }
  if (request.method === "DELETE" && !action) return await removeDraft(row) ?
    mutationJson(actor, "portal.request.delete", { deleted: true }) : conflict("Only drafts can be deleted.");
  if (request.method === "POST" && action === "submit" && !fileId) {
    if (row.submittedAt) return json({ id, reference: row.reference });
    const limited = await limitEndpoint(request, "intake", actor.id);
    if (limited) return limited;
    const body = await parseBody(request, requestEdit);
    if (body instanceof Response) return body;
    if (body.input.type !== row.input.type) return badRequest("The request type cannot change.");
    const error = await submitWorkspace(row, actor, body.input, body.version);
    if (error) {
      const current = await workspaceRequest(id, actor.id);
      return current?.submittedAt ? json({ id, reference: row.reference }) : conflict(error);
    }
    return mutationJson(actor, "portal.request.submit", { id, reference: row.reference }, 201);
  }
  if (request.method === "PATCH" && !action) {
    const body = await parseBody(request, requestEdit);
    if (body instanceof Response) return body;
    if (body.input.type !== row.input.type) return badRequest("The request type cannot change.");
    const changed = await db().update(portalRequest).set({ input: body.input, version: body.version + 1, updatedAt: sql`unixepoch()` })
      .where(and(eq(portalRequest.id, id), eq(portalRequest.ownerId, actor.id), eq(portalRequest.version, body.version), eq(portalRequest.state, "draft"))).returning({ version: portalRequest.version });
    return changed.length ? json(changed[0]) : conflict();
  }
  return notFound();
}

async function adminRoute(request: Request, context: Context) {
  const auth = await requireAdmin(request.method === "GET" ? undefined : request);
  if (auth instanceof Response) return auth;
  const [leadId, action, fileId, extra] = (await context.params).path ?? [];
  if (!leadId || extra) return notFound();
  const row = await db().select().from(portalRequest).where(eq(portalRequest.leadId, leadId)).get();
  if (!row || row.state === "draft") return notFound("No client portal thread for this inquiry.");
  if (action === "attachments" && fileId && request.method === "GET") return download(row.id, fileId);
  if (fileId) return notFound();
  if (action === "read" && request.method === "POST") {
    await db().update(portalRequestEvent).set({ readAt: sql`unixepoch()` }).where(and(eq(portalRequestEvent.requestId, row.id), eq(portalRequestEvent.kind, "client_message")));
    return json({ saved: true });
  }
  if (!action && request.method === "GET") {
    const [events, attachments] = await Promise.all([workspaceEvents(row.id), workspaceAttachments(row.id)]);
    return json({ state: row.state, events, attachments });
  }
  if (request.method === "POST" && action === "messages") return addMessage(request, row, auth.user);
  if (request.method === "POST" && action === "attachments") return upload(request, row, auth.user);
  if (request.method === "PATCH" && action === "status") {
    const value = await parseBody(request, z.object({ state: z.enum(staffRequestStatuses) }));
    if (value instanceof Response) return value;
    return statusChange(row, auth.user, value.state, workspaceStatuses[value.state]);
  }
  return notFound();
}

export const clientWorkspaceHandler = quoteHandler("portal.workspace", clientRoute);
export const adminWorkspaceHandler = withApiErrors("admin.portal.workspace", adminRoute);
