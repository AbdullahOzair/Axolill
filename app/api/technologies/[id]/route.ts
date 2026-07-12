import { z } from "zod";

import { definedOnly, itemRoute } from "@/lib/cms-api";
import { technology } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const patchTechnology = z
  .object({
    category: z.enum([
      "Frontend",
      "Backend",
      "Databases",
      "Mobile",
      "AI",
      "Cloud",
      "Tools",
    ]),
    name: z.string().min(1).max(80),
    order: z.number().int().min(0),
    published: z.boolean(),
  })
  .partial();

export const { PATCH, DELETE } = itemRoute({
  table: technology,
  patchSchema: patchTechnology,
  itemKey: "technology",
  toValues: (b) => definedOnly(b),
});
