# Axonill — Data Model

This document is the **source of truth** for all entities, fields, and relationships in Axonill.
Every later prompt and implementation must match this file. Do not introduce new fields or
entities elsewhere without updating this document first.

---

## Conventions

- **`id`** — primary key, string (UUID / cuid). Unique per entity.
- **Foreign keys** end in `Id` (e.g. `clientId`) and reference the `id` of the target entity.
- **Timestamps** — every entity implicitly carries `createdAt` and `updatedAt` (ISO 8601 datetime),
  omitted from the field lists below for brevity.
- **Enums** are written inline as `field: a|b|c`.
- Nullable / optional foreign keys are marked _(nullable)_.

---

## Entities

### User
A person who can sign in. Either a `client` (customer) or an `admin` (Axonill staff).

| Field     | Type               | Notes                                  |
|-----------|--------------------|----------------------------------------|
| id        | string (PK)        |                                        |
| name      | string             |                                        |
| email     | string             | unique                                 |
| role      | `client` \| `admin`| access level                           |
| company   | string             | organization the user belongs to       |
| phone     | string             | contact number                         |

**Relationships**
- One **User** (as client) has many **Projects** (`Project.clientId → User.id`).
- One **User** (as client) has many **Meetings** (`Meeting.clientId → User.id`).
- One **User** (as client) has many **Leads** (`Lead.clientId → User.id`).

---

### Project
A unit of client work moving through the delivery lifecycle.

| Field      | Type                                                                 | Notes                          |
|------------|---------------------------------------------------------------------|--------------------------------|
| id         | string (PK)                                                         |                                |
| clientId   | string (FK → User.id)                                               | the owning client              |
| name       | string                                                              |                                |
| service    | string                                                              | service line delivered         |
| stage      | `discover` \| `research` \| `design` \| `develop` \| `test` \| `deploy` \| `support` | current lifecycle stage |
| progress   | number (%)                                                          | 0–100                          |
| budget     | number                                                              | monetary amount                |
| startDate  | date                                                                |                                |
| targetDate | date                                                                | expected completion            |

**Relationships**
- Each **Project** belongs to one **User** (client) via `clientId`.
- One **Project** has many **Milestones** (`Milestone.projectId → Project.id`).
- One **Project** has many **ProjectFiles** (`ProjectFile.projectId → Project.id`).
- One **Project** has many **Invoices** (`Invoice.projectId → Project.id`).
- One **Project** has many **Meetings** (`Meeting.projectId → Project.id`).

---

### Milestone
A deliverable checkpoint within a project, ordered for display and approval flow.

| Field       | Type                                                                                   | Notes                     |
|-------------|----------------------------------------------------------------------------------------|---------------------------|
| id          | string (PK)                                                                            |                           |
| projectId   | string (FK → Project.id)                                                               |                           |
| title       | string                                                                                 |                           |
| description | string                                                                                 |                           |
| status      | `pending` \| `in_progress` \| `awaiting_approval` \| `approved` \| `changes_requested` | approval workflow state   |
| dueDate     | date                                                                                    |                           |
| order       | number                                                                                  | sort position within project |

**Relationships**
- Each **Milestone** belongs to one **Project** via `projectId`.
- One **Milestone** has many **ProjectFiles** (`ProjectFile.milestoneId → Milestone.id`).

---

### ProjectFile
A file attached to a project, optionally scoped to a specific milestone.

| Field       | Type                                | Notes                                       |
|-------------|-------------------------------------|---------------------------------------------|
| id          | string (PK)                         |                                             |
| projectId   | string (FK → Project.id)            |                                             |
| milestoneId | string (FK → Milestone.id) _(nullable)_ | null when not tied to a milestone       |
| name        | string                              | display / file name                         |
| fileUrl     | string                              | storage location                            |
| uploadedBy  | string (FK → User.id)               | the uploading user                          |

**Relationships**
- Each **ProjectFile** belongs to one **Project** via `projectId`.
- Each **ProjectFile** optionally belongs to one **Milestone** via `milestoneId`.
- Each **ProjectFile** is uploaded by one **User** via `uploadedBy`.

---

### Invoice
A billing document issued against a project.

| Field    | Type                                                | Notes                       |
|----------|-----------------------------------------------------|-----------------------------|
| id       | string (PK)                                         |                             |
| projectId| string (FK → Project.id)                            |                             |
| number   | string                                             | human-readable invoice no.  |
| amount   | number                                             | total charged               |
| currency | string                                             | ISO 4217 code (e.g. `USD`)  |
| status   | `draft` \| `sent` \| `paid` \| `overdue`           | billing state               |
| dueDate  | date                                               | payment due                 |

**Relationships**
- Each **Invoice** belongs to one **Project** via `projectId`.

---

### Lead
An inbound sales prospect captured before becoming a client/project. May be submitted
anonymously from the marketing site or by a signed-in client from the portal.

| Field       | Type                                                        | Notes                                      |
|-------------|-------------------------------------------------------------|--------------------------------------------|
| id          | string (PK)                                                |                                            |
| clientId    | string (FK → User.id) _(nullable)_                         | set when submitted from the client portal  |
| name        | string                                                     |                                            |
| email       | string                                                     |                                            |
| company     | string                                                     |                                            |
| service     | string                                                     | service of interest                        |
| packageName | string _(nullable)_                                        | pricing tier selected in the portal        |
| budgetRange | string                                                     | e.g. `$5k–$10k`                            |
| message     | string                                                     | free-text inquiry                          |
| wantsCall   | boolean                                                    | default `false`; client requested a call   |
| status      | `new` \| `contacted` \| `qualified` \| `won` \| `lost`     | sales pipeline stage                       |
| source      | string                                                     | where the lead came from                   |

**Relationships**
- Each **Lead** optionally belongs to one **User** (client) via `clientId`.
- One **Lead** has many **Meetings** (`Meeting.leadId → Lead.id`).
- One **Lead** has many **LeadAttachments** (`LeadAttachment.leadId → Lead.id`).

---

### LeadAttachment
A file uploaded with a lead inquiry (typically from the client portal).

| Field       | Type                     | Notes                                       |
|-------------|--------------------------|---------------------------------------------|
| id          | string (PK)              |                                             |
| leadId      | string (FK → Lead.id)    | cascade delete with the parent lead         |
| name        | string                   | display / file name                         |
| r2Key       | string                   | **R2 object key** (same convention as `ProjectFile.fileUrl`) |
| sizeBytes   | number                   | file size in bytes                          |
| contentType | string                   | MIME type, e.g. `application/pdf`           |

> **Timestamps:** `LeadAttachment` carries `createdAt` only — no `updatedAt`.

**Relationships**
- Each **LeadAttachment** belongs to one **Lead** via `leadId`.

---

### Meeting
A scheduled call, tied to a lead (pre-sale), a client, and/or a project.

| Field         | Type                                    | Notes                                  |
|---------------|-----------------------------------------|----------------------------------------|
| id            | string (PK)                             |                                        |
| leadId        | string (FK → Lead.id) _(nullable)_      | set when scheduled from a lead         |
| clientId      | string (FK → User.id) _(nullable)_      | set when scheduled with a client       |
| projectId     | string (FK → Project.id) _(nullable)_   | set when tied to a project             |
| title         | string                                  |                                        |
| attendeeName  | string                                  | external attendee                      |
| attendeeEmail | string                                  | external attendee                      |
| scheduledAt   | datetime                                | when the meeting occurs                |
| meetingUrl    | string                                  | video/conference link                  |
| status        | string                                  | meeting state (e.g. scheduled/completed/cancelled) |
| googleEventId | string _(nullable)_                     | Google Calendar event id; null for Cal.com bookings |
| provider      | `calcom` \| `google_meet`               | which system owns the booking (default `calcom`) |

**Relationships**
- Each **Meeting** optionally belongs to one **Lead** via `leadId`.
- Each **Meeting** optionally belongs to one **User** (client) via `clientId`.
- Each **Meeting** optionally belongs to one **Project** via `projectId`.

---

### Testimonial
A published quote used for social proof on the marketing site.

| Field     | Type        | Notes                       |
|-----------|-------------|-----------------------------|
| id        | string (PK) |                             |
| name      | string      | person quoted               |
| role      | string      | their title / company       |
| quote     | string      | testimonial text            |
| rating    | number      | e.g. 1–5                    |
| published | boolean     | visible on the site or not  |

**Relationships**
- Standalone. No foreign keys.

---

## CMS-backed marketing content

These entities back the homepage sections that used to be hardcoded arrays. They all share
the same two conventions:

- **`order`** — display position (ascending).
- **`published`** — drafts are hidden from the public site (default `false`), exactly like
  `Testimonial.published`.

List fields (`items`, `tags`, `skills`) are **JSON string arrays** — D1 is SQLite, which has
no array type, so they're stored as JSON text.

### Service
A card in the Services section.

| Field     | Type              | Notes                                              |
|-----------|-------------------|----------------------------------------------------|
| id        | string (PK)       |                                                    |
| icon      | string            | lucide-react icon name, e.g. `CodeXml`             |
| title     | string            |                                                    |
| summary   | string            | short description                                  |
| items     | string[] (json)   | sub-services, e.g. `["Next.js & React", "APIs"]`   |
| order     | number            | display position                                   |
| published | boolean           | default `false`                                    |

**Relationships** — Standalone. No foreign keys.

### Technology
A badge inside one of the Technologies categories.

| Field     | Type                                                                        | Notes            |
|-----------|-----------------------------------------------------------------------------|------------------|
| id        | string (PK)                                                                 |                  |
| category  | `Frontend` \| `Backend` \| `Databases` \| `Mobile` \| `AI` \| `Cloud` \| `Tools` | grouping     |
| name      | string                                                                      | e.g. `PostgreSQL` |
| order     | number                                                                      | within the category |
| published | boolean                                                                     | default `false`  |

**Relationships** — Standalone. No foreign keys.

### PortfolioItem
A project card in the Work section.

| Field       | Type                | Notes                                                |
|-------------|---------------------|------------------------------------------------------|
| id          | string (PK)         |                                                      |
| category    | string              | matches a Portfolio filter tab, e.g. `AI Solutions`  |
| title       | string              |                                                      |
| description | string              |                                                      |
| tags        | string[] (json)     | e.g. `["Next.js", "Stripe"]`                         |
| coverImage  | string _(nullable)_ | **R2 object key** (same convention as `ProjectFile.fileUrl`) |
| order       | number              | display position                                     |
| published   | boolean             | default `false`                                      |

**Relationships** — Standalone. No foreign keys.

### TeamMember
A card in the Meet the Team section.

| Field     | Type                | Notes                                        |
|-----------|---------------------|----------------------------------------------|
| id        | string (PK)         |                                              |
| name      | string              |                                              |
| role      | string              | e.g. `Full Stack Developer`                  |
| bio       | string              |                                              |
| skills    | string[] (json)     | e.g. `["Next.js", "PostgreSQL"]`             |
| photoUrl  | string _(nullable)_ | **R2 object key**; null → fall back to initials |
| order     | number              | display position                             |
| published | boolean             | default `false`                              |

**Relationships** — Standalone. No foreign keys.

---

## Integrations

### GoogleCalendarConnection
OAuth tokens for an admin's connected Google Calendar. **One connection per admin**
(`adminUserId` is unique).

| Field        | Type                  | Notes                                  |
|--------------|-----------------------|----------------------------------------|
| id           | string (PK)           |                                        |
| adminUserId  | string (FK → User.id) | **unique** — one connection per admin  |
| accessToken  | string                | ⚠️ secret — server-only                |
| refreshToken | string                | ⚠️ secret — server-only                |
| expiresAt    | datetime              | when the access token expires          |
| scope        | string                | granted OAuth scopes                   |
| connectedAt  | datetime              | when the admin linked their calendar   |

**Relationships**
- Each **GoogleCalendarConnection** belongs to one **User** (admin) via `adminUserId`
  (cascade on delete).

> **Security:** `accessToken` / `refreshToken` are stored in plaintext. They must never be
> exposed through a public API or sent to the browser.

---

## Relationship Summary

```
User (client) 1 ──── * Project
User (client) 1 ──── * Meeting
User (client) 1 ──── * Lead
User (uploader) 1 ─── * ProjectFile
User (admin)  1 ──── 1 GoogleCalendarConnection   (unique)

Project 1 ──── * Milestone
Project 1 ──── * ProjectFile
Project 1 ──── * Invoice
Project 1 ──── * Meeting

Milestone 1 ──── * ProjectFile

Lead 1 ──── * Meeting
Lead 1 ──── * LeadAttachment
```

**Standalone (no foreign keys):** Testimonial · Service · Technology · PortfolioItem ·
TeamMember.
