import { collectionRoute } from "@/lib/cms-api";
import { portfolioItem } from "@/lib/db/schema";
import { portfolioSchema } from "@/lib/portfolio-schema";

export const dynamic = "force-dynamic";

export const { GET, POST } = collectionRoute({
  table: portfolioItem,
  createSchema: portfolioSchema,
  listKey: "portfolio",
  itemKey: "item",
  toValues: (b) => ({
    category: b.category,
    title: b.title,
    description: b.description ?? "",
    tags: b.tags ?? [],
    coverImage: b.coverImage ?? null,
    screenshotImage: b.screenshotImage ?? null,
    liveUrl: b.liveUrl ?? null,
    caseStudyUrl: b.caseStudyUrl ?? null,
    caseStudyDetails: b.caseStudyDetails ?? null,
    order: b.order ?? 0,
    published: b.published ?? false,
  }),
});
