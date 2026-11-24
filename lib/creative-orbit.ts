import { z } from "zod";

export const ORBIT_LIMIT = 16;
export const ORBIT_DURATION_MIN = 30;
export const ORBIT_DURATION_MAX = 240;

export const orbitSettingsSchema = z.object({
  enabled: z.boolean(),
  duration: z.number().int().min(ORBIT_DURATION_MIN).max(ORBIT_DURATION_MAX),
  direction: z.enum(["clockwise", "anticlockwise"]),
}).strict();

export const orbitImageSchema = z.object({
  imageKey: z.string().regex(/^cms\/[\w.-]{1,160}$/),
  title: z.string().trim().max(100).nullable().optional(),
  alt: z.string().trim().min(1).max(180),
  active: z.boolean(),
}).strict();

export const orbitOrderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(ORBIT_LIMIT)
    .refine((ids) => new Set(ids).size === ids.length, "Image IDs must be unique."),
}).strict();

export type OrbitSettings = z.infer<typeof orbitSettingsSchema>;
export type OrbitImageInput = z.infer<typeof orbitImageSchema>;
export type OrbitImage = OrbitImageInput & { id: string };
export type OrbitData = { settings: OrbitSettings; images: OrbitImage[] };
export const DEFAULT_ORBIT_SETTINGS: OrbitSettings = { enabled: true, duration: 100, direction: "clockwise" };
