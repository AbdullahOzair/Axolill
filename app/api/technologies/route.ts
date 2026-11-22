import { collectionRoute } from "@/lib/cms-api";
import { technology } from "@/lib/db/schema";
import { technologySchema } from "@/lib/technology-schema";

export const dynamic = "force-dynamic";

export const { GET, POST } = collectionRoute({
  table: technology,
  createSchema: technologySchema,
  listKey: "technologies",
  itemKey: "technology",
  toValues: (b) => ({
    category: b.category,
    name: b.name,
    iconUrl: b.iconUrl ?? null,
    order: b.order ?? 0,
    published: b.published ?? false,
  }),
});
