import "server-only";

import { asc, eq } from "drizzle-orm";

import { db, filesBucket } from "@/lib/api";
import { CMS_IMAGE_MAX_BYTES, isCmsImageType } from "@/lib/cms-image";
import { DEFAULT_ORBIT_SETTINGS, ORBIT_LIMIT, type OrbitData } from "@/lib/creative-orbit";
import { creativeOrbitImage, creativeOrbitSettings } from "@/lib/db/schema";

export const ORBIT_SETTINGS_ID = "default";

export async function readCreativeOrbit(admin = false): Promise<OrbitData> {
  const database = db();
  const [[saved], images] = await database.batch([
    database.select({
      enabled: creativeOrbitSettings.enabled,
      duration: creativeOrbitSettings.duration,
      direction: creativeOrbitSettings.direction,
    }).from(creativeOrbitSettings).where(eq(creativeOrbitSettings.id, ORBIT_SETTINGS_ID)).limit(1),
    database.select({
      id: creativeOrbitImage.id,
      imageKey: creativeOrbitImage.imageKey,
      title: creativeOrbitImage.title,
      alt: creativeOrbitImage.alt,
      active: creativeOrbitImage.active,
    }).from(creativeOrbitImage)
      .where(admin ? undefined : eq(creativeOrbitImage.active, true))
      .orderBy(asc(creativeOrbitImage.displayOrder), asc(creativeOrbitImage.id))
      .limit(ORBIT_LIMIT),
  ]);
  return { settings: saved ?? DEFAULT_ORBIT_SETTINGS, images };
}

export async function isOrbitImage(imageKey: string) {
  const object = await filesBucket().head(imageKey);
  return Boolean(object && object.size > 0 && object.size <= CMS_IMAGE_MAX_BYTES &&
    isCmsImageType(object.httpMetadata?.contentType ?? ""));
}
