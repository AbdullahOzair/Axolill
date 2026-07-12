/**
 * TypeScript interfaces mirroring DATA_MODEL.md — the source of truth for
 * entities and fields. Field names here must match that document exactly.
 * Every entity implicitly carries createdAt / updatedAt (ISO 8601).
 */

export type UserRole = "client" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company: string | null;
  phone: string | null;
}

/**
 * What `/api/clients` returns: a User plus the two auth-table columns the admin
 * client list displays. Not a new entity — a projection, so it lives here
 * rather than in DATA_MODEL.md.
 */
export interface ClientAccount extends User {
  image: string | null;
  createdAt: string; // ISO date
}

export type ProjectStage =
  | "discover"
  | "research"
  | "design"
  | "develop"
  | "test"
  | "deploy"
  | "support";

/** Ordered lifecycle stages — index doubles as stage position. */
export const PROJECT_STAGES: ProjectStage[] = [
  "discover",
  "research",
  "design",
  "develop",
  "test",
  "deploy",
  "support",
];

export interface Project {
  id: string;
  clientId: string; // FK → User.id
  name: string;
  service: string;
  stage: ProjectStage;
  progress: number; // 0–100
  budget: number;
  startDate: string; // ISO date
  targetDate: string; // ISO date
}

export type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "awaiting_approval"
  | "approved"
  | "changes_requested";

export interface Milestone {
  id: string;
  projectId: string; // FK → Project.id
  title: string;
  description: string;
  status: MilestoneStatus;
  dueDate: string; // ISO date
  order: number;
}

export interface ProjectFile {
  id: string;
  projectId: string; // FK → Project.id
  milestoneId: string | null; // FK → Milestone.id (nullable)
  name: string;
  fileUrl: string;
  uploadedBy: string; // FK → User.id
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface Invoice {
  id: string;
  projectId: string; // FK → Project.id
  number: string;
  amount: number;
  currency: string; // ISO 4217, e.g. "USD"
  status: InvoiceStatus;
  dueDate: string; // ISO date
}

export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  service: string | null;
  budgetRange: string | null;
  message: string | null;
  status: LeadStatus;
  source: string | null;
}

/**
 * DATA_MODEL.md types Meeting.status as a string, noting the states
 * scheduled / completed / cancelled — narrowed to a union here.
 */
/** `requested` = client asked from /portal; no meetingUrl until an admin confirms. */
export type MeetingStatus =
  | "requested"
  | "scheduled"
  | "completed"
  | "cancelled";

/** Which system owns the booking. */
export type MeetingProvider = "calcom" | "google_meet";

export interface Meeting {
  id: string;
  leadId: string | null; // FK → Lead.id (nullable)
  clientId: string | null; // FK → User.id (nullable)
  projectId: string | null; // FK → Project.id (nullable)
  title: string;
  attendeeName: string;
  attendeeEmail: string;
  scheduledAt: string; // ISO datetime
  meetingUrl: string | null;
  status: MeetingStatus;
  googleEventId: string | null; // null for Cal.com bookings
  provider: MeetingProvider;
  confirmedAt: string | null; // set when an admin confirms a request
  clientSeenAt: string | null; // set when the client dismisses the notice
}

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  quote: string;
  rating: number;
  published: boolean;
}

/* ----------------------- CMS-backed marketing content ---------------------- */

export interface Service {
  id: string;
  /** lucide-react icon name, e.g. "CodeXml". */
  icon: string;
  title: string;
  summary: string;
  items: string[];
  order: number;
  published: boolean;
}

export const TECHNOLOGY_CATEGORIES = [
  "Frontend",
  "Backend",
  "Databases",
  "Mobile",
  "AI",
  "Cloud",
  "Tools",
] as const;

export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];

export interface Technology {
  id: string;
  category: TechnologyCategory;
  name: string;
  order: number;
  published: boolean;
}

export interface PortfolioItem {
  id: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
  /** R2 object key — serve via /api/media/<key>. */
  coverImage: string | null;
  order: number;
  published: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  skills: string[];
  /** R2 object key — serve via /api/media/<key>. */
  photoUrl: string | null;
  order: number;
  published: boolean;
}
