import { z } from "zod";

import { definedOnly, itemRoute } from "@/lib/cms-api";
import { portfolioItem } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const patchPortfolioItem = z
  .object({
    category: z.string().min(1).max(80),
    title: z.string().min(1).max(140),
    description: z.string().max(1000),
    tags: z.array(z.string().min(1).max(40)).max(12),
    coverImage: z.string().max(300).nullable(),
    order: z.number().int().min(0),
    published: z.boolean(),
  })
  .partial();

export const { PATCH, DELETE } = itemRoute({
  table: portfolioItem,
  patchSchema: patchPortfolioItem,
  itemKey: "item",
  toValues: (b) => definedOnly(b),
});
