import { z } from "zod";

import { definedOnly, itemRoute } from "@/lib/cms-api";
import { service } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const patchService = z
  .object({
    icon: z.string().min(1).max(60),
    title: z.string().min(1).max(120),
    summary: z.string().max(500),
    items: z.array(z.string().min(1).max(120)).max(12),
    order: z.number().int().min(0),
    published: z.boolean(),
  })
  .partial();

export const { PATCH, DELETE } = itemRoute({
  table: service,
  patchSchema: patchService,
  itemKey: "service",
  toValues: (b) => definedOnly(b),
});
