import { z } from "zod";

import { collectionRoute } from "@/lib/cms-api";
import { service } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const createService = z.object({
  icon: z.string().min(1).max(60), // lucide-react icon name
  title: z.string().min(1).max(120),
  summary: z.string().max(500).optional(),
  items: z.array(z.string().min(1).max(120)).max(12).optional(),
  order: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
});

export const { GET, POST } = collectionRoute({
  table: service,
  createSchema: createService,
  listKey: "services",
  itemKey: "service",
  toValues: (b) => ({
    icon: b.icon,
    title: b.title,
    summary: b.summary ?? "",
    items: b.items ?? [],
    order: b.order ?? 0,
    published: b.published ?? false,
  }),
});
