import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, newId } from "@/lib/api";
import { quotation, quotationActivity, quotationShare } from "@/lib/db/schema";
import { effectiveQuoteStatus, quoteD1, QuoteError, quoteExpiresAt, type QuoteRow } from "@/lib/quotation-store";

const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
export const hashQuoteSecret = async (value: string) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
const random = (size: number) => hex(crypto.getRandomValues(new Uint8Array(size)));

export async function createQuotationShare(row: QuoteRow, actor: string, days: number, version: number) {
  if (!["approved", "sent", "viewed"].includes(effectiveQuoteStatus(row)) || row.archived)
    throw new QuoteError("Approve the quotation before sharing it.", 409);
  const d1 = quoteD1();
  const token = random(32);
  const code = random(16);
  const id = newId();
  const expires = Math.min(quoteExpiresAt(row.expiry), Math.floor(Date.now() / 1000) + days * 86400);
  const results = await d1.batch([
    d1.prepare(`insert into quotation_share (id,quotationId,tokenHash,codeHash,expiresAt)
      select ?,id,?,?,? from quotation where id=? and version=? and status in ('approved','sent','viewed') and archived=0 and deleted=0
      and ? > unixepoch() and not exists(select 1 from quotation newer where newer.number=quotation.number and newer.revision>quotation.revision and newer.deleted=0)`)
      .bind(id, await hashQuoteSecret(token), await hashQuoteSecret(code), expires, row.id, version, expires),
    d1.prepare(`insert into quotation_activity (id,quotationId,actorId,kind)
      select ?,quotationId,?,'link_created' from quotation_share where id=?`).bind(id, actor, id),
  ]);
  if (!results[0].meta.changes) throw new QuoteError("This quotation changed or can no longer be shared.", 409);
  const origin = new URL(getCloudflareContext().env.BETTER_AUTH_URL).origin;
  return { url: origin + "/quotation/" + token, code, expires };
}

export async function revokeQuotationShare(quoteId: string, id: string, actor: string) {
  const d1 = quoteD1();
  const event = newId();
  const updated = await d1.batch([
    d1.prepare(`insert into quotation_activity (id,quotationId,actorId,kind,details)
      select ?,quotationId,?,'link_revoked',id from quotation_share where id=? and quotationId=? and revokedAt is null`)
      .bind(event, actor, id, quoteId),
    d1.prepare(`update quotation_share set revokedAt=unixepoch() where id=? and exists(select 1 from quotation_activity where id=?)`).bind(id, event),
  ]);
  if (!updated[0].meta.changes) throw new QuoteError("That link is unavailable or already revoked.", 409);
}

export async function lookupQuotationShare(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const record = await db().select({ quote: quotation, link: quotationShare }).from(quotationShare)
    .innerJoin(quotation, eq(quotation.id, quotationShare.quotationId)).where(and(
      eq(quotationShare.tokenHash, await hashQuoteSecret(token)), isNull(quotationShare.revokedAt),
      gt(quotationShare.expiresAt, Math.floor(Date.now() / 1000)), eq(quotation.archived, false), eq(quotation.deleted, false),
      sql`${quotation.status} in ('sent','viewed','revision_requested','accepted','declined','invoiced')
        and not exists(select 1 from quotation newer where newer.number=${quotation.number} and newer.revision>${quotation.revision} and newer.deleted=0)`,
    )).get();
  return record && effectiveQuoteStatus(record.quote) !== "expired" ? record : null;
}

export async function markQuoteViewed(linkId: string) {
  const d1 = quoteD1();
  const event = newId();
  const guard = `exists(select 1 from quotation_share s where s.id=? and s.quotationId=quotation.id and s.revokedAt is null and s.expiresAt>unixepoch())`;
  await d1.batch([
    d1.prepare(`update quotation set status='viewed',lastActionId=?,updatedAt=unixepoch(),version=version+1
      where status='sent' and archived=0 and deleted=0 and ${guard}
      and not exists(select 1 from quotation newer where newer.number=quotation.number and newer.revision>quotation.revision and newer.deleted=0)`).bind(event, linkId),
    d1.prepare(`insert into quotation_activity (id,quotationId,kind) select ?,id,'viewed' from quotation where lastActionId=?`).bind(event, event),
    d1.prepare(`update quotation_share set viewedAt=unixepoch() where id=? and viewedAt is null and revokedAt is null and expiresAt>unixepoch()`).bind(linkId),
  ]);
}

/** Validate a separate recipient code against an active, unused link. */
export async function verifyQuotationCode(quoteId: string, code: string) {
  const hash = await hashQuoteSecret(code);
  const records = await db().select({ id: quotationShare.id, codeHash: quotationShare.codeHash }).from(quotationShare)
    .where(and(eq(quotationShare.quotationId, quoteId), isNull(quotationShare.revokedAt), isNull(quotationShare.usedAt),
      gt(quotationShare.expiresAt, Math.floor(Date.now() / 1000))));
  for (const record of records) {
    let difference = 0;
    for (let index = 0; index < hash.length; index++) difference |= hash.charCodeAt(index) ^ record.codeHash.charCodeAt(index);
    if (!difference) return { shareId: record.id, codeHash: hash };
  }
  return null;
}
