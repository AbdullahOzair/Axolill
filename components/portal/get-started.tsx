"use client";

import * as React from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  Check,
  CheckCircle2,
  Cloud,
  FileCheck,
  ListChecks,
  Loader2,
  Paperclip,
  Receipt,
  ReceiptText,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";

import { PRICING_TIERS, type PricingTier } from "@/lib/pricing-tiers";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* ─────────────────────────── constants ─────────────────────────── */

const PROJECT_TYPES = [
  "Web Development",
  "Mobile Apps",
  "UI/UX Design",
  "AI",
  "Data Analytics",
  "Cloud Solutions",
  "Other",
] as const;

const BUDGET_RANGES = [
  "Under $5k",
  "$5k – $10k",
  "$10k – $25k",
  "$25k – $50k",
  "$50k+",
] as const;

const TIMELINES = [
  "ASAP",
  "4–6 weeks",
  "8–12 weeks",
  "3–6 months",
  "Flexible",
] as const;

const VALUE_PROPS = [
  {
    title: "Live status tracking",
    description: "See exactly where your build stands at every stage.",
    icon: Activity,
  },
  {
    title: "Milestone approvals",
    description:
      "Review deliverables and sign off — or request changes — in one click.",
    icon: ListChecks,
  },
  {
    title: "Secure file sharing",
    description: "All project assets in a private, client-only space.",
    icon: Paperclip,
  },
  {
    title: "Invoicing in one place",
    description:
      "Track quotes, invoices, and payments without chasing email threads.",
    icon: Receipt,
  },
  {
    title: "Book a call anytime",
    description:
      "Request a Google Meet when you need to talk — we confirm the slot here.",
    icon: Video,
  },
] as const;

/* ─────────────────────── quick-start templates ─────────────────── */

type QuickTemplate = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  projectType: (typeof PROJECT_TYPES)[number];
  description: string;
  features: string[];
};

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: "business-website",
    label: "Business Website",
    icon: Cloud,
    projectType: "Web Development",
    description:
      "A polished, conversion-focused website for our business — including a homepage, services section, about page, and a contact form.",
    features: [
      "Responsive design (mobile + desktop)",
      "Contact & lead-capture form",
      "SEO-ready structure",
      "CMS for blog or news",
      "Google Analytics integration",
    ],
  },
  {
    id: "mobile-app",
    label: "Mobile App",
    icon: Smartphone,
    projectType: "Mobile Apps",
    description:
      "A native-quality mobile app (iOS & Android) that lets our users accomplish [goal] — clean UX, fast performance, and offline support.",
    features: [
      "iOS & Android (React Native or Flutter)",
      "User authentication & profiles",
      "Push notifications",
      "Offline-first data sync",
      "App store submission",
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce Store",
    icon: ShoppingCart,
    projectType: "Web Development",
    description:
      "A full-featured online store with product catalogue, cart, checkout, and order management — built for scale and conversion.",
    features: [
      "Product catalogue & search",
      "Shopping cart & checkout",
      "Stripe or Shopify payments",
      "Order management dashboard",
      "Inventory & stock alerts",
    ],
  },
  {
    id: "ai-automation",
    label: "AI Automation",
    icon: Bot,
    projectType: "AI",
    description:
      "An AI-powered workflow that automates [manual task] — reducing time-to-output and eliminating repetitive human effort.",
    features: [
      "LLM integration (OpenAI / Anthropic)",
      "Custom data pipeline or RAG",
      "API or webhook triggers",
      "Human-in-the-loop review UI",
      "Usage monitoring & cost controls",
    ],
  },
  {
    id: "dashboard-analytics",
    label: "Dashboard & Analytics",
    icon: BarChart3,
    projectType: "Data Analytics",
    description:
      "A real-time analytics dashboard that surfaces key metrics from our data sources — with filters, exports, and role-based access.",
    features: [
      "Real-time charts & KPIs",
      "Data source integrations (DB / API / CSV)",
      "Filters, date ranges & drill-down",
      "CSV / PDF export",
      "Role-based access control",
    ],
  },
];

/* ────────────────────────── form types ─────────────────────────── */

type IntakeForm = {
  projectName: string;
  projectType: string;
  description: string;
  features: string[];      // chip array
  budgetRange: string;
  timeline: string;
  wantsCall: boolean;
};

const EMPTY_FORM: IntakeForm = {
  projectName: "",
  projectType: "",
  description: "",
  features: [],
  budgetRange: "",
  timeline: "",
  wantsCall: false,
};

/* ─────────────────────────── helpers ───────────────────────────── */

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ═══════════════════════ GetStarted (root) ══════════════════════ */

export function GetStarted() {
  const reduce = useReducedMotion();
  const intakeRef = React.useRef<HTMLElement>(null);

  const [selectedTier, setSelectedTier] = React.useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<IntakeForm>(EMPTY_FORM);
  const [files, setFiles] = React.useState<File[]>([]);
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = React.useState<string | null>(null);

  const tier = PRICING_TIERS.find((t) => t.name === selectedTier) ?? null;

  /* ── tier selection ── */
  function selectTier(name: string) {
    setSelectedTier(name);
  }

  function scrollToIntake(name: string) {
    setSelectedTier(name);
    requestAnimationFrame(() => {
      intakeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* ── template selection ── */
  function applyTemplate(tpl: QuickTemplate) {
    const next = activeTemplate === tpl.id ? null : tpl.id;
    setActiveTemplate(next);
    if (next) {
      setForm((prev) => ({
        ...prev,
        projectType: tpl.projectType,
        description: tpl.description,
        features: [...tpl.features],
      }));
    }
  }

  /* ── generic field update ── */
  function updateField<K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /* ── feature chips ── */
  function addFeature(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || form.features.includes(trimmed)) return;
    setForm((prev) => ({ ...prev, features: [...prev.features, trimmed] }));
  }

  function removeFeature(tag: string) {
    setForm((prev) => ({ ...prev, features: prev.features.filter((f) => f !== tag) }));
  }

  /* ── files ── */
  function mergeFiles(incoming: File[]) {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...incoming.filter((f) => !existing.has(f.name + f.size))];
    });
  }

  function onFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files;
    if (!picked?.length) return;
    mergeFiles(Array.from(picked));
    event.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  /* ── submit ── */
  async function submitIntake(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedTier) return setError("Pick a package above to continue.");
    if (!form.projectName.trim()) return setError("Give your project a name.");
    if (!form.projectType) return setError("Select a project type.");
    if (!form.description.trim()) return setError("Tell us about the project.");
    if (!form.budgetRange) return setError("Select a budget range.");
    if (!form.timeline) return setError("Select a timeline.");

    setStatus("submitting");
    setError(null);

    const body = new FormData();
    body.append("projectName", form.projectName.trim());
    body.append("projectType", form.projectType);
    body.append("description", form.description.trim());
    body.append("features", JSON.stringify(form.features));
    body.append("budgetRange", form.budgetRange);
    body.append("timeline", form.timeline);
    body.append("packageName", selectedTier);
    body.append("wantsCall", String(form.wantsCall));
    for (const file of files) body.append("files", file);

    try {
      const res = await fetch("/api/portal/intake", { method: "POST", body });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not submit your intake.");
      }
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  /* ── success screen ── */
  if (status === "success") {
    return (
      <section className="rounded-2xl border border-success/30 bg-success/5 p-8 text-center shadow-sm backdrop-blur sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-7" />
        </span>
        <h2 className="mt-5 font-heading text-2xl font-semibold tracking-tight">
          Thanks — we&apos;ve got your brief
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-muted-foreground">
          We&apos;ll review it and get back to you within{" "}
          <strong className="text-foreground">1 business day</strong>. Feel free
          to book a call in the meantime.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/portal/book"
            className={cn(
              buttonVariants({ variant: "default" }),
              "group relative overflow-hidden"
            )}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <span className="relative z-10 flex items-center gap-2">
              <Video className="size-4" />
              Book a Google Meet
            </span>
          </a>
          <a
            href="/portal"
            className={buttonVariants({ variant: "outline" })}
          >
            Back to portal
          </a>
        </div>
      </section>
    );
  }

  /* ── main view ── */
  return (
    <div className="space-y-10">
      {/* ── Value proposition ───────────────────────────────── */}
      <section className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm backdrop-blur transition-shadow duration-200 hover:shadow-md sm:p-8">
        <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
          Client portal
        </p>
        <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          Your project, fully transparent
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">
          Everything you need to stay in the loop — from first kickoff to final
          invoice — lives here. No more digging through email threads.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {VALUE_PROPS.map(({ title, description, icon: Icon }) => (
            <li
              key={title}
              className="flex gap-3 rounded-xl border border-border/50 bg-background/40 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-secondary/30 hover:shadow-md"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 dark:text-blue-400">
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div>
          <h3 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Simple, transparent pricing
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Pick the engagement that fits where you are — every tier is a fixed,
            upfront quote with no surprises.
          </p>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
          {PRICING_TIERS.map((t) => (
            <SelectableTierCard
              key={t.name}
              tier={t}
              selected={selectedTier === t.name}
              onSelect={() => selectTier(t.name)}
              onGetStarted={() => scrollToIntake(t.name)}
              reduceMotion={reduce}
            />
          ))}
        </div>
      </section>

      {/* ── Portal promise strip ─────────────────────────────── */}
      <PortalPromiseStrip />

      {/* ── Intake form ─────────────────────────────────────── */}
      <section
        ref={intakeRef}
        id="intake-form"
        className="scroll-mt-24 rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm backdrop-blur sm:p-8"
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-xl font-semibold tracking-tight">
              Tell us about your project
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Share a brief and any reference files — we&apos;ll take it from here.
            </p>
          </div>
          {tier && (
            <Badge className="rounded-full bg-brand-secondary/10 text-brand-secondary dark:text-blue-400">
              {tier.name} package
            </Badge>
          )}
        </div>

        {/* Quick-start templates */}
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Quick start — pick a template
          </p>
          <div className="flex flex-wrap gap-2.5">
            {QUICK_TEMPLATES.map((tpl) => (
              <TemplateChip
                key={tpl.id}
                template={tpl}
                active={activeTemplate === tpl.id}
                onSelect={() => applyTemplate(tpl)}
                disabled={status === "submitting"}
              />
            ))}
          </div>
          <AnimatePresence>
            {activeTemplate && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="mt-2 text-xs text-muted-foreground"
              >
                Template applied — feel free to edit any field below.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Error banner */}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {/* Form */}
        <form onSubmit={submitIntake} className="mt-6 space-y-5">
          {/* Project name + type */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="intake-name">Project name</Label>
              <Input
                id="intake-name"
                value={form.projectName}
                onChange={(e) => updateField("projectName", e.target.value)}
                placeholder="Acme client portal"
                disabled={status === "submitting"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-type">Project type</Label>
              <Select
                value={form.projectType}
                onValueChange={(v) => updateField("projectType", v ?? "")}
                disabled={status === "submitting"}
              >
                <SelectTrigger id="intake-type" className="w-full">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="intake-description">Description &amp; goals</Label>
            <Textarea
              id="intake-description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="What are you building, and who is it for? What does success look like?"
              rows={4}
              disabled={status === "submitting"}
            />
          </div>

          {/* Features chip input */}
          <FeatureChipInput
            features={form.features}
            onAdd={addFeature}
            onRemove={removeFeature}
            disabled={status === "submitting"}
          />

          {/* Budget + timeline */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="intake-budget">Budget range</Label>
              <Select
                value={form.budgetRange}
                onValueChange={(v) => updateField("budgetRange", v ?? "")}
                disabled={status === "submitting"}
              >
                <SelectTrigger id="intake-budget" className="w-full">
                  <SelectValue placeholder="Select a range" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_RANGES.map((range) => (
                    <SelectItem key={range} value={range}>
                      {range}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intake-timeline">Desired timeline</Label>
              <Select
                value={form.timeline}
                onValueChange={(v) => updateField("timeline", v ?? "")}
                disabled={status === "submitting"}
              >
                <SelectTrigger id="intake-timeline" className="w-full">
                  <SelectValue placeholder="When do you need this?" />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File dropzone */}
          <FileDropzone
            files={files}
            onFilesChange={onFilesChange}
            onMerge={mergeFiles}
            onRemove={removeFile}
            disabled={status === "submitting"}
          />

          {/* Intro-call checkbox */}
          <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <label
              htmlFor="intake-call"
              className="flex cursor-pointer items-start gap-3"
            >
              <Checkbox
                id="intake-call"
                checked={form.wantsCall}
                onCheckedChange={(checked) =>
                  updateField("wantsCall", Boolean(checked))
                }
                disabled={status === "submitting"}
                className="mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-medium leading-none">
                  I&apos;d like to schedule an intro call about this
                </p>
                <AnimatePresence>
                  {form.wantsCall ? (
                    <motion.p
                      key="call-note"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mt-1.5 text-xs text-brand-secondary overflow-hidden dark:text-blue-400"
                    >
                      We&apos;ll reach out to confirm a time once we review your brief.
                    </motion.p>
                  ) : (
                    <motion.p
                      key="call-hint"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="mt-1.5 text-xs text-muted-foreground overflow-hidden"
                    >
                      Optional — we&apos;ll follow up to confirm a Google Meet slot.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </label>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={status === "submitting" || !selectedTier}
            className="group relative h-11 w-full gap-2 overflow-hidden sm:w-auto sm:min-w-48"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            <span className="relative z-10 inline-flex items-center gap-2">
              {status === "submitting" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  Submit intake
                  <ArrowRight className="size-4" />
                </>
              )}
            </span>
          </Button>
        </form>
      </section>
    </div>
  );
}

/* ═════════════════════ TemplateChip ════════════════════════════ */

function TemplateChip({
  template,
  active,
  onSelect,
  disabled,
}: {
  template: QuickTemplate;
  active: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  const Icon = template.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium",
        "transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-brand-secondary/70 bg-brand-secondary/10 text-brand-secondary shadow-sm shadow-brand-secondary/10 ring-1 ring-brand-secondary/25 dark:text-blue-400"
          : "border-border/60 bg-background/50 text-foreground hover:border-brand-secondary/30 hover:bg-background/70"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors",
          active ? "text-brand-secondary dark:text-blue-400" : "text-muted-foreground"
        )}
      />
      {template.label}
      {active && <Check className="ml-0.5 size-3.5 text-brand-secondary dark:text-blue-400" />}
    </button>
  );
}

/* ═════════════════════ FeatureChipInput ════════════════════════ */

function FeatureChipInput({
  features,
  onAdd,
  onRemove,
  disabled,
}: {
  features: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = React.useState("");

  function commit(raw: string) {
    // support comma-separated paste
    raw.split(",").forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) onAdd(trimmed);
    });
    setDraft("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && features.length > 0) {
      onRemove(features[features.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="intake-features-input">
        Features wanted
        <span className="ml-1.5 font-normal text-muted-foreground">
          (type &amp; press Enter or comma to add)
        </span>
      </Label>

      {/* Chip field */}
      <div
        className={cn(
          "flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background transition-colors",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          disabled && "opacity-50 pointer-events-none"
        )}
        onClick={() => document.getElementById("intake-features-input")?.focus()}
      >
        {features.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-md bg-brand-secondary/10 px-2 py-0.5 text-xs font-medium text-brand-secondary ring-1 ring-brand-secondary/20 dark:text-blue-400"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
              aria-label={`Remove feature: ${tag}`}
              className="ml-0.5 rounded-sm opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id="intake-features-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (draft.trim()) commit(draft); }}
          placeholder={features.length === 0 ? "e.g. User authentication, Stripe billing…" : "Add more…"}
          disabled={disabled}
          className="min-w-[140px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      {features.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {features.length} feature{features.length !== 1 ? "s" : ""} added
        </p>
      )}
    </div>
  );
}

/* ═════════════════════ FileDropzone ════════════════════════════ */

function FileDropzone({
  files,
  onFilesChange,
  onMerge,
  onRemove,
  disabled,
}: {
  files: File[];
  onFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMerge: (f: File[]) => void;
  onRemove: (i: number) => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = React.useState(false);

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }

  function onDragLeave() { setDragging(false); }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length) onMerge(dropped);
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="intake-files">Attachments</Label>

      <label
        htmlFor="intake-files"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center",
          "transition-all duration-200",
          dragging
            ? "border-brand-secondary/70 bg-brand-secondary/5 shadow-md"
            : "border-border/80 bg-background/40 hover:border-brand-secondary/40 hover:bg-muted/30",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl transition-colors duration-200",
            dragging
              ? "bg-brand-secondary/15 text-brand-secondary"
              : "bg-secondary text-muted-foreground"
          )}
        >
          <Upload className="size-5" />
        </span>
        <span className="text-sm font-medium">
          {dragging ? "Drop to attach" : "Drop files or click to upload"}
        </span>
        <span className="text-xs text-muted-foreground">
          PDFs, docs, wireframes, brand assets — up to 25 MB each
        </span>
        <input
          id="intake-files"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.svg,.zip,.sketch,.fig"
          className="sr-only"
          onChange={onFilesChange}
          disabled={disabled}
        />
      </label>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {fmtFileSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${file.name}`}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════ PortalPromiseStrip ════════════════════════ */

const PORTAL_PROMISES = [
  {
    icon: ListChecks,
    title: "You approve every milestone",
    body: "Before we move on, you review the deliverable and sign it off — or send it back with notes. Nothing slips through without your OK.",
  },
  {
    icon: FileCheck,
    title: "Files land here as we finish them",
    body: "Designs, builds, and assets are uploaded directly to your portal the moment they're ready. No hunting through email attachments.",
  },
  {
    icon: ReceiptText,
    title: "Invoices appear here automatically",
    body: "Every quote and payment request shows up in one place, with status at a glance. No separate emails, no chasing.",
  },
  {
    icon: CalendarCheck,
    title: "Book a call anytime, no back-and-forth",
    body: "Pick a slot that works for you and we'll send a calendar invite. No email chains, no scheduling tools.",
  },
] as const;

function PortalPromiseStrip() {
  const reduce = useReducedMotion();
  const lineRef = React.useRef<HTMLDivElement>(null);

  // Animate the connecting line as the section scrolls into view
  const { scrollYProgress } = useScroll({
    target: lineRef,
    offset: ["start 0.85", "end 0.55"],
  });
  const drawn = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 22,
    restDelta: 0.001,
  });

  return (
    <section aria-label="How we keep you updated">
      {/* Section header */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
          How we keep you updated
        </p>
        <h3 className="mt-2 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          Radical transparency, built in
        </h3>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Every action we take surfaces in your portal automatically — so
          you&apos;re always in the loop, never in the dark.
        </p>
      </motion.div>

      {/* Timeline */}
      <div ref={lineRef} className="relative mt-8">
        {/* ── Connecting line: vertical on mobile, hidden on desktop (dots do the job) ── */}
        <div
          aria-hidden
          className="absolute top-0 bottom-0 left-[19px] w-0.5 sm:left-[23px] lg:hidden"
        >
          {/* Static track */}
          <div className="h-full w-full bg-border/60" />
          {/* Animated fill */}
          <motion.div
            className="absolute inset-0 origin-top bg-gradient-to-b from-brand-secondary to-accent-cyan"
            style={{ scaleY: reduce ? 1 : drawn }}
          />
        </div>

        {/* ── Horizontal connector line on desktop ── */}
        <div
          aria-hidden
          className="absolute top-[19px] left-[38px] right-[38px] h-0.5 hidden lg:block"
        >
          <div className="h-full w-full bg-border/60" />
          <motion.div
            className="absolute inset-0 origin-left bg-gradient-to-r from-brand-secondary to-accent-cyan"
            style={{ scaleX: reduce ? 1 : drawn }}
          />
        </div>

        {/* ── Steps ── */}
        <ol className="space-y-6 lg:grid lg:grid-cols-4 lg:gap-6 lg:space-y-0">
          {PORTAL_PROMISES.map(({ icon: Icon, title, body }, i) => (
            <motion.li
              key={title}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: reduce ? 0 : i * 0.09,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative flex gap-4 lg:flex-col lg:gap-3"
            >
              {/* Node dot */}
              <div className="relative z-10 shrink-0">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-full ring-4 ring-background",
                    "bg-gradient-to-br from-brand-secondary to-accent-cyan text-white shadow-md",
                    "sm:size-12"
                  )}
                >
                  <Icon className="size-4 sm:size-5" />
                </span>
              </div>

              {/* Card */}
              <div className="min-w-0 flex-1 rounded-xl border border-border/60 bg-background/60 p-4 backdrop-blur transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-secondary/30 hover:shadow-md lg:p-5">
                <p className="font-heading text-sm font-semibold leading-snug">
                  {title}
                </p>
                <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
                  {body}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ═════════════════════ SelectableTierCard ══════════════════════ */

function SelectableTierCard({
  tier,
  selected,
  onSelect,
  onGetStarted,
  reduceMotion,
}: {
  tier: PricingTier;
  selected: boolean;
  onSelect: () => void;
  onGetStarted: () => void;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.div
      layout={!reduceMotion}
      animate={{ scale: selected ? 1.02 : 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Card
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "relative flex h-full cursor-pointer flex-col overflow-hidden border-border/60 bg-background/60 backdrop-blur transition-all duration-200",
          "hover:-translate-y-0.5 hover:border-brand-secondary/40 hover:shadow-lg",
          selected &&
            "border-brand-secondary/70 shadow-lg shadow-brand-secondary/10 ring-2 ring-brand-secondary/20",
          tier.featured && !selected && "lg:mt-0"
        )}
      >
        {tier.featured && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/2 -z-10 size-48 -translate-x-1/2 rounded-full bg-brand-secondary/15 blur-3xl"
            />
            <span className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-brand-secondary to-accent-cyan" />
            <div className="absolute top-4 right-4">
              <Badge className="gap-1 rounded-full bg-brand-secondary text-white shadow-sm">
                <Sparkles className="size-3" />
                Most Popular
              </Badge>
            </div>
          </>
        )}

        {selected && (
          <span className="absolute top-4 left-4 grid size-6 place-items-center rounded-full bg-brand-secondary text-white shadow-sm">
            <Check className="size-3.5" />
          </span>
        )}

        <CardHeader className={cn(tier.featured && "pt-7", selected && "pl-12")}>
          <CardTitle className="font-heading text-lg">{tier.name}</CardTitle>
          <CardDescription>{tier.description}</CardDescription>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="font-heading text-3xl font-bold tracking-tight">
              {tier.price}
            </span>
            {tier.cadence && (
              <span className="text-sm text-muted-foreground">{tier.cadence}</span>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1">
          <ul className="space-y-2.5">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <CheckCircle2
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    tier.featured || selected ? "text-brand-secondary" : "text-success"
                  )}
                />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>

        <CardFooter className="mt-auto flex-col gap-2">
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <Button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGetStarted();
                  }}
                  className="group relative h-11 w-full overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  <span className="relative z-10">Get Started with {tier.name}</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
