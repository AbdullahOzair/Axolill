import { z } from "zod";

import { collectionRoute } from "@/lib/cms-api";
import { teamMember } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const createTeamMember = z.object({
  name: z.string().min(1).max(120),
  role: z.string().min(1).max(120),
  bio: z.string().max(1000).optional(),
  skills: z.array(z.string().min(1).max(40)).max(16).optional(),
  /** R2 object key from POST /api/media. */
  photoUrl: z.string().max(300).nullable().optional(),
  order: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
});

export const { GET, POST } = collectionRoute({
  table: teamMember,
  createSchema: createTeamMember,
  listKey: "team",
  itemKey: "member",
  toValues: (b) => ({
    name: b.name,
    role: b.role,
    bio: b.bio ?? "",
    skills: b.skills ?? [],
    photoUrl: b.photoUrl ?? null,
    order: b.order ?? 0,
    published: b.published ?? false,
  }),
});
