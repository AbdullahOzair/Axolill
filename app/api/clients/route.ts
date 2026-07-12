import { asc, eq } from "drizzle-orm";

import { db, json, requireAdmin } from "@/lib/api";
import { user } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/**
 * GET — admin only. Lists the client accounts (role = "client").
 *
 * Columns are selected explicitly rather than `select()`-ing the whole row:
 * this table is better-auth's, and a blanket select would start leaking any
 * auth field added to it later. Admins are excluded — they aren't clients, and
 * the admin roster isn't something this screen should expose.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const clients = await db()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: user.company,
      phone: user.phone,
      image: user.image,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.role, "client"))
    .orderBy(asc(user.name));

  return json({ clients });
}
