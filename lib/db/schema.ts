import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema for Cloudflare D1 (SQLite).
 *
 * - Domain tables mirror DATA_MODEL.md exactly (same entity + field names).
 * - Auth tables (user/session/account/verification) are better-auth's required
 *   schema. DATA_MODEL's `User` entity is merged INTO better-auth's `user`
 *   table as additional fields (role, company, phone) rather than creating a
 *   second, conflicting users table.
 *
 * Dates are stored as unix timestamps (integer) — better-auth's drizzle adapter
 * expects `Date` objects, which `{ mode: "timestamp" }` provides.
 */

/* -------------------------------------------------------------------------- */
/*                            better-auth core tables                         */
/* -------------------------------------------------------------------------- */

export const user = sqliteTable("user", {
  // better-auth required fields
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),

  // DATA_MODEL.md `User` fields (id, name, email are shared with better-auth)
  role: text("role", { enum: ["client", "admin"] })
    .notNull()
    .default("client"),
  company: text("company"),
  phone: text("phone"),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_userId_idx").on(t.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("account_userId_idx").on(t.userId)]
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

/* -------------------------------------------------------------------------- */
/*                        DATA_MODEL.md domain tables                          */
/* -------------------------------------------------------------------------- */

/** Project — one User (client) has many Projects. */
export const project = sqliteTable(
  "project",
  {
    id: text("id").primaryKey(),
    clientId: text("clientId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    service: text("service").notNull(),
    stage: text("stage", {
      enum: [
        "discover",
        "research",
        "design",
        "develop",
        "test",
        "deploy",
        "support",
      ],
    })
      .notNull()
      .default("discover"),
    progress: integer("progress").notNull().default(0),
    budget: real("budget").notNull().default(0),
    startDate: integer("startDate", { mode: "timestamp" }).notNull(),
    targetDate: integer("targetDate", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("project_clientId_idx").on(t.clientId)]
);

/** Milestone — one Project has many Milestones. */
export const milestone = sqliteTable(
  "milestone",
  {
    id: text("id").primaryKey(),
    projectId: text("projectId")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status", {
      enum: [
        "pending",
        "in_progress",
        "awaiting_approval",
        "approved",
        "changes_requested",
      ],
    })
      .notNull()
      .default("pending"),
    dueDate: integer("dueDate", { mode: "timestamp" }).notNull(),
    // `order` is a SQL keyword — Drizzle quotes it in generated DDL.
    order: integer("order").notNull().default(0),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("milestone_projectId_idx").on(t.projectId)]
);

/**
 * ProjectFile — belongs to one Project, optionally to one Milestone.
 * `fileUrl` holds the R2 object key / URL (see the FILES binding).
 */
export const projectFile = sqliteTable(
  "project_file",
  {
    id: text("id").primaryKey(),
    projectId: text("projectId")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    milestoneId: text("milestoneId").references(() => milestone.id, {
      onDelete: "set null",
    }), // nullable per DATA_MODEL.md
    name: text("name").notNull(),
    fileUrl: text("fileUrl").notNull(),
    uploadedBy: text("uploadedBy")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("project_file_projectId_idx").on(t.projectId),
    index("project_file_milestoneId_idx").on(t.milestoneId),
  ]
);

/** Invoice — one Project has many Invoices. */
export const invoice = sqliteTable(
  "invoice",
  {
    id: text("id").primaryKey(),
    projectId: text("projectId")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    number: text("number").notNull().unique(),
    amount: real("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status", { enum: ["draft", "sent", "paid", "overdue"] })
      .notNull()
      .default("draft"),
    dueDate: integer("dueDate", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("invoice_projectId_idx").on(t.projectId)]
);

/** Lead — inbound prospect; one Lead has many Meetings and LeadAttachments. */
export const lead = sqliteTable(
  "lead",
  {
    id: text("id").primaryKey(),
    /** Set when the lead is submitted from the client portal by a signed-in user. */
    clientId: text("clientId").references(() => user.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    service: text("service"),
    /** Pricing tier selected in the portal, e.g. "Growth". */
    packageName: text("packageName"),
    budgetRange: text("budgetRange"),
    message: text("message"),
    /** True when the client asked for a call as part of the submission. */
    wantsCall: integer("wantsCall", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", {
      enum: ["new", "contacted", "qualified", "won", "lost"],
    })
      .notNull()
      .default("new"),
    source: text("source"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("lead_clientId_idx").on(t.clientId)]
);

/**
 * LeadAttachment — a file uploaded with a lead (portal inquiry).
 * `r2Key` holds the R2 object key (same convention as ProjectFile.fileUrl).
 */
export const leadAttachment = sqliteTable(
  "lead_attachment",
  {
    id: text("id").primaryKey(),
    leadId: text("leadId")
      .notNull()
      .references(() => lead.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    r2Key: text("r2Key").notNull(),
    sizeBytes: integer("sizeBytes").notNull(),
    contentType: text("contentType").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("lead_attachment_leadId_idx").on(t.leadId)]
);

/** Meeting — optionally tied to a Lead, a client User, and/or a Project. */
export const meeting = sqliteTable(
  "meeting",
  {
    id: text("id").primaryKey(),
    leadId: text("leadId").references(() => lead.id, { onDelete: "set null" }),
    clientId: text("clientId").references(() => user.id, {
      onDelete: "set null",
    }),
    projectId: text("projectId").references(() => project.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    attendeeName: text("attendeeName").notNull(),
    attendeeEmail: text("attendeeEmail").notNull(),
    scheduledAt: integer("scheduledAt", { mode: "timestamp" }).notNull(),
    meetingUrl: text("meetingUrl"),
    /**
     * `requested` = the client asked for a call from /portal. It has no
     * meetingUrl yet; an admin confirms it, which mints the Google Meet.
     */
    status: text("status", {
      enum: ["requested", "scheduled", "completed", "cancelled"],
    })
      .notNull()
      .default("scheduled"),
    /** Google Calendar event id — null for bookings that came from Cal.com. */
    googleEventId: text("googleEventId"),
    /** Which system owns this booking. */
    provider: text("provider", { enum: ["calcom", "google_meet"] })
      .notNull()
      .default("calcom"),
    /** Set when an admin confirms a client request (drives the portal notice). */
    confirmedAt: integer("confirmedAt", { mode: "timestamp" }),
    /** Set when the client dismisses that notice, so it shows exactly once. */
    clientSeenAt: integer("clientSeenAt", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("meeting_leadId_idx").on(t.leadId),
    index("meeting_clientId_idx").on(t.clientId),
    index("meeting_projectId_idx").on(t.projectId),
    index("meeting_googleEventId_idx").on(t.googleEventId),
  ]
);

/** Testimonial — standalone, no foreign keys. */
export const testimonial = sqliteTable("testimonial", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  quote: text("quote").notNull(),
  rating: integer("rating").notNull().default(5),
  published: integer("published", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/* -------------------------------------------------------------------------- */
/*                        CMS-backed marketing content                        */
/* -------------------------------------------------------------------------- */
/*
 * These replace the hardcoded arrays in the homepage sections. Each row carries
 * `order` (display position) and `published` (drafts stay off the public site,
 * same pattern as `testimonial`).
 *
 * List fields (items/tags/skills) are stored as JSON text — D1 is SQLite, so
 * there's no array type. `{ mode: "json" }` + `$type<string[]>()` gives us a
 * typed string[] on both read and write.
 */

/** Service — a card in the Services section. */
export const service = sqliteTable("service", {
  id: text("id").primaryKey(),
  /** lucide-react icon name, e.g. "CodeXml" (see components/sections/services.tsx). */
  icon: text("icon").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  /** Sub-services, e.g. ["Next.js & React", "Design systems"]. */
  items: text("items", { mode: "json" }).$type<string[]>().notNull().default([]),
  order: integer("order").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** Technology — a badge inside one of the Technologies categories. */
export const technology = sqliteTable(
  "technology",
  {
    id: text("id").primaryKey(),
    category: text("category", {
      enum: [
        "Frontend",
        "Backend",
        "Databases",
        "Mobile",
        "AI",
        "Cloud",
        "Tools",
      ],
    }).notNull(),
    name: text("name").notNull(),
    order: integer("order").notNull().default(0),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("technology_category_idx").on(t.category)]
);

/** PortfolioItem — a project card in the Work section. */
export const portfolioItem = sqliteTable(
  "portfolio_item",
  {
    id: text("id").primaryKey(),
    /** Matches a Portfolio filter tab, e.g. "Web Development", "AI Solutions". */
    category: text("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    /** R2 object key (same convention as ProjectFile.fileUrl). Nullable. */
    coverImage: text("coverImage"),
    order: integer("order").notNull().default(0),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("portfolio_item_category_idx").on(t.category)]
);

/** TeamMember — a card in the Meet the Team section. */
export const teamMember = sqliteTable("team_member", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  bio: text("bio").notNull().default(""),
  skills: text("skills", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  /** R2 object key, or null to fall back to initials. */
  photoUrl: text("photoUrl"),
  order: integer("order").notNull().default(0),
  published: integer("published", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/* -------------------------------------------------------------------------- */
/*                          Google Calendar integration                       */
/* -------------------------------------------------------------------------- */

/**
 * GoogleCalendarConnection — OAuth tokens for an admin's Google Calendar.
 * One connection per admin (unique on adminUserId).
 *
 * SECURITY: accessToken/refreshToken are stored here in plaintext. They must
 * never leave the server — do not expose this table through a public API.
 */
export const googleCalendarConnection = sqliteTable(
  "google_calendar_connection",
  {
    id: text("id").primaryKey(),
    adminUserId: text("adminUserId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken").notNull(),
    refreshToken: text("refreshToken").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
    scope: text("scope").notNull().default(""),
    connectedAt: integer("connectedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("google_calendar_connection_adminUserId_idx").on(t.adminUserId),
  ]
);

/* --------------------------------- types ---------------------------------- */

export type User = typeof user.$inferSelect;
export type Project = typeof project.$inferSelect;
export type Milestone = typeof milestone.$inferSelect;
export type ProjectFile = typeof projectFile.$inferSelect;
export type Invoice = typeof invoice.$inferSelect;
export type Lead = typeof lead.$inferSelect;
export type LeadAttachment = typeof leadAttachment.$inferSelect;
export type Meeting = typeof meeting.$inferSelect;
export type Testimonial = typeof testimonial.$inferSelect;
export type Service = typeof service.$inferSelect;
export type Technology = typeof technology.$inferSelect;
export type PortfolioItem = typeof portfolioItem.$inferSelect;
export type TeamMember = typeof teamMember.$inferSelect;
export type GoogleCalendarConnection =
  typeof googleCalendarConnection.$inferSelect;
