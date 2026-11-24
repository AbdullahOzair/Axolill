import { json } from "@/lib/api";
import { readCreativeOrbit } from "@/lib/creative-orbit-server";
import { withApiErrors } from "@/lib/http-security";

export const dynamic = "force-dynamic";

export const GET = withApiErrors("GET /api/creative-orbit", async () => {
  return json(await readCreativeOrbit());
});
