"use client";

import * as React from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Send,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Reveal } from "@/components/reveal";

const SERVICES = [
  "Web Development",
  "Mobile Apps",
  "UI/UX Design",
  "AI",
  "Data Analytics",
  "Cloud Solutions",
  "Other",
];

const BUDGETS = [
  "Under $5k",
  "$5k – $10k",
  "$10k – $25k",
  "$25k – $50k",
  "$50k+",
];

const EMAIL = "hello@axonill.com";
const WHATSAPP_NUMBER = "1234567890"; // placeholder

type FormValues = {
  name: string;
  email: string;
  service: string;
  budget: string;
  message: string;
};

type Errors = Partial<Record<keyof FormValues, string>>;

const EMPTY: FormValues = {
  name: "",
  email: "",
  service: "",
  budget: "",
  message: "",
};

/** Creates a Lead via POST /api/contact — surfaces in the admin Leads table. */
async function submitLead(values: FormValues) {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: values.name,
      email: values.email,
      service: values.service,
      budgetRange: values.budget,
      message: values.message,
      source: "Website",
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "Could not send your message.");
  }
  return res.json();
}

function validate(values: FormValues): Errors {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = "Please enter your name.";
  if (!values.email.trim()) {
    errors.email = "Please enter your email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!values.service) errors.service = "Please select a service.";
  if (!values.budget) errors.budget = "Please select a budget range.";
  if (!values.message.trim()) {
    errors.message = "Please tell us a little about your project.";
  } else if (values.message.trim().length < 10) {
    errors.message = "A few more details would help (min. 10 characters).";
  }
  return errors;
}

export function Contact() {
  const reduce = useReducedMotion();
  const [values, setValues] = React.useState<FormValues>(EMPTY);
  const [errors, setErrors] = React.useState<Errors>({});
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success">(
    "idle"
  );
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const update =
    (field: keyof FormValues) =>
    (
      e:
        | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        | string
    ) => {
      const value = typeof e === "string" ? e : e.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      // Clear a field's error as the user corrects it.
      setErrors((prev) =>
        prev[field] ? { ...prev, [field]: undefined } : prev
      );
    };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setStatus("submitting");
    try {
      await submitLead(values);
      setStatus("success");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not send your message."
      );
      setStatus("idle");
    }
  }

  function reset() {
    setValues(EMPTY);
    setErrors({});
    setSubmitError(null);
    setStatus("idle");
  }

  return (
    <section id="contact" className="relative py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium tracking-wider text-brand-secondary uppercase dark:text-blue-400">
            Contact
          </p>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl md:text-5xl">
            Let&apos;s build something great
          </h2>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            Tell us about your project and we&apos;ll get back to you within one
            business day.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-16 grid gap-8 lg:grid-cols-2">
          {/* Form */}
          <div className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm backdrop-blur sm:p-8">
            <AnimatePresence mode="wait" initial={false}>
              {status === "success" ? (
                <motion.div
                  key="success"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex min-h-[28rem] flex-col items-center justify-center text-center"
                >
                  <motion.span
                    initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      type: reduce ? "tween" : "spring",
                      stiffness: 200,
                      damping: 15,
                      delay: 0.1,
                    }}
                    className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-brand-secondary to-accent-cyan text-white shadow-lg"
                  >
                    <CheckCircle2 className="size-8" />
                  </motion.span>
                  <h3 className="mt-6 font-heading text-xl font-semibold">
                    Message sent!
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    Thanks for reaching out, {values.name.split(" ")[0] || "there"}.
                    We&apos;ve received your message and will be in touch within one
                    business day.
                  </p>
                  <Button
                    variant="outline"
                    size="lg"
                    className="mt-8"
                    onClick={reset}
                  >
                    Send another message
                  </Button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  noValidate
                  onSubmit={handleSubmit}
                  initial={false}
                  exit={{ opacity: 0 }}
                  className="space-y-5"
                >
                  {submitError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                      {submitError}
                    </div>
                  )}

                  {/* Name */}
                  <Field
                    id="name"
                    label="Name"
                    error={errors.name}
                  >
                    <Input
                      id="name"
                      value={values.name}
                      onChange={update("name")}
                      placeholder="Jane Doe"
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "name-error" : undefined}
                    />
                  </Field>

                  {/* Email */}
                  <Field id="email" label="Email" error={errors.email}>
                    <Input
                      id="email"
                      type="email"
                      value={values.email}
                      onChange={update("email")}
                      placeholder="jane@company.com"
                      aria-invalid={!!errors.email}
                      aria-describedby={
                        errors.email ? "email-error" : undefined
                      }
                    />
                  </Field>

                  {/* Service + Budget */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="service" label="Service" error={errors.service}>
                      <Select
                        value={values.service}
                        onValueChange={(v) => update("service")(v as string)}
                      >
                        <SelectTrigger
                          id="service"
                          className="w-full"
                          aria-invalid={!!errors.service}
                        >
                          <SelectValue placeholder="Select a service" />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field id="budget" label="Budget range" error={errors.budget}>
                      <Select
                        value={values.budget}
                        onValueChange={(v) => update("budget")(v as string)}
                      >
                        <SelectTrigger
                          id="budget"
                          className="w-full"
                          aria-invalid={!!errors.budget}
                        >
                          <SelectValue placeholder="Select a range" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGETS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {/* Message */}
                  <Field id="message" label="Message" error={errors.message}>
                    <Textarea
                      id="message"
                      value={values.message}
                      onChange={update("message")}
                      placeholder="Tell us about your project, goals, and timeline…"
                      rows={5}
                      aria-invalid={!!errors.message}
                      aria-describedby={
                        errors.message ? "message-error" : undefined
                      }
                    />
                  </Field>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={status === "submitting"}
                    className="w-full"
                  >
                    {status === "submitting" ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send />
                        Send message
                      </>
                    )}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Info + map */}
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <ContactLink
                href={`mailto:${EMAIL}`}
                icon={Mail}
                label="Email us"
                value={EMAIL}
              />
              <ContactLink
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                icon={MessageCircle}
                label="WhatsApp"
                value="Chat with us"
                external
              />
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-4 backdrop-blur">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15">
                <MapPin className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Our location
                </p>
                <p className="text-sm text-muted-foreground">
                  Air University, Islamabad, Pakistan
                </p>
              </div>
            </div>

            {/* Google Maps embed */}
            <div className="relative aspect-[16/10] flex-1 overflow-hidden rounded-2xl border border-border/60 shadow-sm">
              <iframe
                title="Axonill location — Air University, Islamabad"
                src="https://www.google.com/maps?q=Air%20University%20Islamabad&output=embed"
                className="absolute inset-0 size-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function ContactLink({
  href,
  icon: Icon,
  label,
  value,
  external,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-4 backdrop-blur transition-colors outline-none hover:border-brand-secondary/40 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 transition-transform duration-300 group-hover:scale-105">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="truncate text-sm text-muted-foreground">{value}</p>
      </div>
    </a>
  );
}
