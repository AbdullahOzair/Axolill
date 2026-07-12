import { z } from "zod";

import { definedOnly, itemRoute } from "@/lib/cms-api";
import { teamMember } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const patchTeamMember = z
  .object({
    name: z.string().min(1).max(120),
    role: z.string().min(1).max(120),
    bio: z.string().max(1000),
    skills: z.array(z.string().min(1).max(40)).max(16),
    photoUrl: z.string().max(300).nullable(),
    order: z.number().int().min(0),
    published: z.boolean(),
  })
  .partial();

export const { PATCH, DELETE } = itemRoute({
  table: teamMember,
  patchSchema: patchTeamMember,
  itemKey: "member",
  toValues: (b) => definedOnly(b),
});
