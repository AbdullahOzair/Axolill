import { z } from "zod";

import { TEAM_LINK_LIMIT, teamProfileUrl } from "./team-links";

export const optionalTeamLink = z.string().trim().max(TEAM_LINK_LIMIT)
  .refine((value) => !value || teamProfileUrl(value) !== null, "Enter a valid HTTP or HTTPS URL.")
  .transform(teamProfileUrl)
  .nullable();
