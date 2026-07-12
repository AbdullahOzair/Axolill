import { z } from "zod";

import { collectionRoute } from "@/lib/cms-api";
import { portfolioItem } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const createPortfolioItem = z.object({
  category: z.string().min(1).max(80),
  title: z.string().min(1).max(140),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  /** R2 object key from POST /api/media. */
  coverImage: z.string().max(300).nullable().optional(),
  order: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
});

export const { GET, POST } = collectionRoute({
  table: portfolioItem,
  createSchema: createPortfolioItem,
  listKey: "portfolio",
  itemKey: "item",
  toValues: (b) => ({
    category: b.category,
    title: b.title,
    description: b.description ?? "",
    tags: b.tags ?? [],
    coverImage: b.coverImage ?? null,
    order: b.order ?? 0,
    published: b.published ?? false,
  }),
});
