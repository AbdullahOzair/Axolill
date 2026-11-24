import { z } from "zod";

import { CONSULTATION_METHODS, GUIDANCE_CATEGORIES, IDEA_CATEGORIES, INQUIRY_COUNTRIES, INQUIRY_GROUPS, INQUIRY_PRIORITIES, INQUIRY_STAGES, INQUIRY_TYPES } from "./inquiries";

export const countryCode = z.string().refine((value) => INQUIRY_COUNTRIES.includes(value), "Select a country.");
const short = z.string().trim().min(1).max(160);
const detail = z.string().trim().min(1).max(2400);
const currencyCodes = new Set(Intl.supportedValuesOf("currency"));
const optionalTerms = {
  budget: z.number().nonnegative().max(1_000_000_000).optional(),
  currency: z.string().refine((value) => currencyCodes.has(value), "Select a supported currency.").optional(),
};
const contact = {
  requestId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  company: short.optional(),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 ().-]{5,29}$/).refine((value) => {
    const digits = value.replace(/\D/g, "").length;
    return digits >= 7 && digits <= 15;
  }, "Enter a valid phone number.").optional(),
  country: countryCode,
  websiteAddress: z.string().max(400).optional(),
  sessionId: z.uuid().optional(),
};

const attributionValue = z.string().trim().regex(/^[A-Za-z0-9._-]{1,80}$/);
const attribution = {
  referral: z.string().regex(/^[a-z0-9.-]{1,253}$/).optional(),
  campaign: z.object({
    source: attributionValue.optional(), medium: attributionValue.optional(),
    campaign: attributionValue.optional(), term: attributionValue.optional(), content: attributionValue.optional(),
  }).strict().optional(),
};

export const inquirySubmission = z.discriminatedUnion("type", [
  z.object({
    ...contact, type: z.literal("IDEA"), category: z.enum(IDEA_CATEGORIES), description: detail,
    objectives: detail, timeline: short.optional(), ...optionalTerms,
  }).strict(),
  z.object({
    ...contact, type: z.literal("PROJECT"), groups: z.array(z.enum(INQUIRY_GROUPS)).min(1).max(3),
    serviceKeys: z.array(z.string().max(500)).max(30),
    title: short, description: detail, objectives: detail,
    website: z.url({ protocol: /^https?$/ }).max(2048).refine((value) => {
      const parsed = new URL(value);
      return !parsed.username && !parsed.password;
    }, "Enter a public HTTP or HTTPS URL.").optional(),
    timeline: short, ...optionalTerms,
  }).strict(),
  z.object({
    ...contact, type: z.literal("GUIDANCE"), category: z.enum(GUIDANCE_CATEGORIES),
    situation: detail, description: detail, objectives: detail,
    consultation: z.enum(CONSULTATION_METHODS),
  }).strict(),
]);

export const funnelEvent = z.discriminatedUnion("event", [
  z.object({ event: z.literal("viewed"), sessionId: z.uuid(), ...attribution }).strict(),
  z.object({ event: z.literal("selected"), sessionId: z.uuid(), type: z.enum(INQUIRY_TYPES) }).strict(),
  z.object({ event: z.literal("started"), sessionId: z.uuid(), type: z.enum(INQUIRY_TYPES), step: z.number().int().min(1).max(3) }).strict(),
]);

export const inquiryUpdate = z.object({
  stage: z.enum(INQUIRY_STAGES).exclude(["converted"]).optional(),
  priority: z.enum(INQUIRY_PRIORITIES).optional(),
  assigneeId: z.string().min(1).max(160).nullable().optional(),
  followUpAt: z.iso.datetime({ offset: true }).nullable().optional(),
  lostReason: z.string().trim().min(1).max(1000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const inquiryConversion = z.object({
  clientId: z.string().min(1).max(160).optional(),
  project: z.object({
    name: short, service: z.string().trim().min(1).max(80),
    start: z.iso.date(), target: z.iso.date(),
  }).refine(({start, target}) => start <= target, "Target date must be on or after the start date.").optional(),
}).strict();

export const inquiryConfiguration = z.object({
  domesticCountry: countryCode,
  serviceGroups: z.record(z.string().max(500), z.enum(INQUIRY_GROUPS))
    .refine((value) => Object.keys(value).length <= 500, "Too many service mappings."),
}).strict();
