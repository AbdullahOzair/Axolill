import { z } from "zod";

import { portfolioCaseStudyPath, portfolioLiveUrl } from "@/lib/portfolio-links";

const website = z.string().nullable().transform((value, context) => {
  if (!value?.trim()) return null;
  const url = portfolioLiveUrl(value);
  if (url) return url;
  context.addIssue({ code: "custom", message: "Enter an HTTPS website URL without credentials." });
  return z.NEVER;
});

const caseStudy = z.string().nullable().transform((value, context) => {
  if (!value?.trim()) return null;
  const path = portfolioCaseStudyPath(value);
  if (path) return path;
  context.addIssue({ code: "custom", message: "Enter an internal path that starts with a single slash." });
  return z.NEVER;
});

const detailList = (length: number) => z.array(z.string().trim().max(length)).max(24)
  .transform((items) => items.filter(Boolean));

export const portfolioSchema = z.object({
  category: z.string().min(1).max(80),
  title: z.string().min(1).max(140),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  coverImage: z.string().max(300).nullable().optional(),
  screenshotImage: z.string().max(300).regex(/^cms\/[\w.-]+$/).nullable().optional(),
  liveUrl: website.optional(),
  caseStudyUrl: caseStudy.optional(),
  caseStudyDetails: z.object({
    location: z.string().trim().max(120).optional(),
    highlights: detailList(240).optional(),
    technologyStack: detailList(60).optional(),
  }).nullable().optional(),
  order: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
});
