import { z } from "zod";

import { collectionRoute } from "@/lib/cms-api";
import { technology } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Frontend",
  "Backend",
  "Databases",
  "Mobile",
  "AI",
  "Cloud",
  "Tools",
] as const;

const createTechnology = z.object({
  category: z.enum(CATEGORIES),
  name: z.string().min(1).max(80),
  order: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
});

export const { GET, POST } = collectionRoute({
  table: technology,
  createSchema: createTechnology,
  listKey: "technologies",
  itemKey: "technology",
  toValues: (b) => ({
    category: b.category,
    name: b.name,
    order: b.order ?? 0,
    published: b.published ?? false,
  }),
});
