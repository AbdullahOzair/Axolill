import { z } from "zod";

import { TECHNOLOGY_CATEGORIES } from "@/lib/data-model";
import { technologyIconUrlError } from "@/lib/technology-icon-url";

export const technologySchema = z.object({
  category: z.enum(TECHNOLOGY_CATEGORIES),
  name: z.string().min(1).max(80),
  iconUrl: z.string().nullable().transform((value, context) => {
    const url = value?.trim() || null;
    const message = url && technologyIconUrlError(url);
    if (message) {
      context.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return url;
  }).optional(),
  order: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
});
