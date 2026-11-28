import "server-only";
import { db, json, mutationJson, newId, type SessionUser } from "@/lib/api";
import { and, eq } from "drizzle-orm";
import { milestone } from "@/lib/db/schema";
import { quoteD1 } from "@/lib/quotation-store";
import { entryFields } from "@/lib/active-project";

export async function changeLegacyMilestone(actor: SessionUser, projectId: string, milestoneId: string, status: string) {
  const d1 = quoteD1();
  const record = newId();
  const result = await d1.batch([
    d1.prepare(`insert into project_workspace_entry(id,projectId,actorId,kind,state,data)
      select ?,projectId,?,'milestone_review',?,json_set(?,'$.milestoneVersion',1,'$.files',json('[]'))
      from milestone where id=? and projectId=? and reviewVersion=1 and status='awaiting_approval'
      and not exists(select 1 from project_file where milestoneId=milestone.id and clientVisible=1)`)
      .bind(record, actor.id, status, JSON.stringify(entryFields.parse({ kind: "activity", reference: milestoneId })), milestoneId, projectId),
    d1.prepare(`update milestone set status=?,updatedAt=unixepoch() where id=? and exists(select 1 from project_workspace_entry where id=?)`)
      .bind(status, milestoneId, record),
  ]);
  if (!result[0].meta.changes) return json({ error: "Use the project workspace to review the current deliverable." }, 409);
  const saved = await db().select().from(milestone).where(and(eq(milestone.id, milestoneId), eq(milestone.projectId, projectId))).get();
  return mutationJson(actor, "project.milestone.review", { milestone: saved });
}
