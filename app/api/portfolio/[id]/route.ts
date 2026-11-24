import { definedOnly, itemRoute } from "@/lib/cms-api";
import { portfolioItem } from "@/lib/db/schema";
import { portfolioSchema } from "@/lib/portfolio-schema";

export const dynamic = "force-dynamic";

export const { PATCH, DELETE } = itemRoute({
  table: portfolioItem,
  patchSchema: portfolioSchema.partial(),
  itemKey: "item",
  toValues: (b) => definedOnly(b),
});
