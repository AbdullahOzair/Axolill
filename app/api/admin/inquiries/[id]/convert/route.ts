import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, sql } from "drizzle-orm";

import { badRequest, db, json, mutationJson, notFound, parseBody, requireAdmin } from "@/lib/api";
import { inquiry, portalRequest, user } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";
import { baseInquiries } from "@/lib/inquiry-admin";
import { inquiryConversion } from "@/lib/inquiry-validation";

export const dynamic = "force-dynamic";

export const POST = withApiErrors("POST convert inquiry", async function POST(
  request: Request, context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await parseBody(request, inquiryConversion);
  if (body instanceof Response) return body;

  const { id } = await context.params;
  const current = await baseInquiries().where(eq(inquiry.id, id)).get();
  if (!current) return notFound("Inquiry not found");
  const portal = await db().select().from(portalRequest).where(eq(portalRequest.leadId, id)).get();
  if (portal && ["closed", "cancelled"].includes(portal.state)) return badRequest("Reopen the client request before creating a project.");
  if (portal && body.clientId && body.clientId !== portal.ownerId) return badRequest("Create the project for the client who submitted the request.");
  if (current.convertedAt && (!portal || current.convertedProjectId || !body.project))
    return json({ clientId: current.convertedClientId, projectId: current.convertedProjectId });

  const email = current.email.trim().toLowerCase();
  const database = db();
  const knownClientId = portal?.ownerId ?? body.clientId;
  const matches = await database.select({ id: user.id, role: user.role }).from(user).where(
    knownClientId ? eq(user.id, knownClientId) : sql`lower(${user.email}) = ${email}`,
  );
  if (knownClientId && matches[0]?.role !== "client") return badRequest("Select an existing client.");
  if (!body.clientId && matches.some((match) => match.role === "admin")) return badRequest("That email belongs to an administrator. Select an existing client to link instead.");
  if (!body.clientId && matches.length > 1) return badRequest("Multiple accounts match this email. Select the correct client.");

  const d1 = getCloudflareContext().env.DB;
  const clientId = portal?.ownerId ?? body.clientId ?? matches[0]?.id ?? "inquiry-client-" + id;
  const projectId = body.project ? "inquiry-project-" + id : null;
  const eventId = crypto.randomUUID();
  const convertible = portal && body.project ? "convertedProjectId is null" : "convertedAt is null";
  const openPortal = "not exists(select 1 from portal_request where leadId=inquiry.id and state in ('closed','cancelled'))";
  const guard = `exists(select 1 from inquiry where id=? and version=? and ${convertible} and ${openPortal})`;
  const eligibleClient = "exists(select 1 from user where id=? and role='client')";
  const operations = [];
  if (!portal && !body.clientId && !matches.length) {
    operations.push(d1.prepare(`insert into user (id,email,name,company,phone,role)
      select ?,?,?,?,?,'client' where ${guard} and not exists(select 1 from user where lower(email)=?)
      on conflict do nothing`)
      .bind(clientId, email, current.name, current.company, current.phone, id, current.version, email));
  }
  if (body.project) {
    const { name, service, start, target } = body.project;
    operations.push(d1.prepare(`insert into project (id,clientId,name,service,startDate,targetDate)
      select ?,?,?,?,?,? where ${guard} and ${eligibleClient}`)
      .bind(projectId, clientId, name, service, Date.parse(start) / 1000, Date.parse(target) / 1000, id, current.version, clientId));
  }
  operations.push(
    d1.prepare(`insert into inquiry_activity (id,inquiryId,kind,previousStage,newStage,description,adminId)
      select ?,id,'conversion',stage,'converted',?,? from inquiry
      where id=? and version=? and ${convertible} and ${openPortal} and ${eligibleClient}`)
      .bind(eventId, projectId ? "Converted to client and created a project." : "Converted to client.", auth.user.id, id, current.version, clientId),
    d1.prepare(`update inquiry set stage='converted',convertedAt=unixepoch(),convertedClientId=?,convertedProjectId=?,
      lostReason=null,followUpAt=null,version=version+1 where id=? and version=? and exists(select 1 from inquiry_activity where id=?)`)
      .bind(clientId, projectId, id, current.version, eventId),
    d1.prepare(`update lead set clientId=?,status='won',updatedAt=unixepoch()
      where id=? and exists(select 1 from inquiry_activity where id=?)`).bind(clientId, id, eventId),
  );
  const result = await d1.batch(operations);
  if (!result.at(-2)?.meta.changes) {
    const record = await database.select().from(inquiry).where(and(eq(inquiry.id, id), sql`${inquiry.convertedAt} is not null`)).get();
    return record ? json({ clientId: record.convertedClientId, projectId: record.convertedProjectId }) :
      json({ error: "The inquiry or matching accounts changed. Refresh and try again." }, 409);
  }
  return mutationJson(auth.user, "inquiry.convert", { clientId, projectId });
});
