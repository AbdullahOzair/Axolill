import { eq } from "drizzle-orm";

import { db, json, notFound } from "@/lib/api";
import { getServerSession } from "@/lib/auth";
import { definedOnly, itemRoute } from "@/lib/cms-api";
import { technology } from "@/lib/db/schema";
import { withApiErrors } from "@/lib/http-security";
import { technologySchema } from "@/lib/technology-schema";

export const dynamic = "force-dynamic";

export const GET = withApiErrors("cms.technology.detail", async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const [item] = await db().select().from(technology).where(eq(technology.id, id)).limit(1);
  if (!item || (!item.published && (await getServerSession())?.user.role !== "admin")) {
    return notFound("Not found");
  }
  return json({ technology: item });
});

export const { PATCH, DELETE } = itemRoute({
  table: technology,
  patchSchema: technologySchema.partial(),
  itemKey: "technology",
  toValues: (b) => definedOnly(b),
});
