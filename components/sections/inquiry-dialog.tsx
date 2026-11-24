"use client";

import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from "react";

import { BookingLink } from "@/components/booking-provider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fetchJson } from "@/lib/use-api";
import {
  CONSULTATION_METHODS, GROUP_LABELS, GUIDANCE_CATEGORIES, IDEA_CATEGORIES, INQUIRY_COUNTRIES, INQUIRY_GROUPS,
  inquiryCountry, type InquiryGroup, type InquiryServiceChoice, type InquiryType,
} from "@/lib/inquiries";
import { inquirySubmission } from "@/lib/inquiry-validation";
import styles from "./pricing.module.css";

const COUNTRY_OPTIONS = INQUIRY_COUNTRIES.map((value) => ({ value, label: inquiryCountry(value) }))
  .sort((a, b) => a.label.localeCompare(b.label));
const CURRENCIES = Intl.supportedValuesOf("currency");
const JOURNEYS = {
  IDEA: { first: "What kind of idea are you exploring?", second: "Tell us about your idea", final: "Submit my idea" },
  PROJECT: { first: "What expertise do you need?", second: "Tell us about your project", final: "Request a proposal" },
  GUIDANCE: { first: "What would you like help with?", second: "Tell us about the challenge", final: "Request a consultation" },
};

type Draft = {
  category: string; groups: InquiryGroup[]; serviceKeys: string[]; title: string; description: string;
  objectives: string; website: string; timeline: string; budget: string; currency: string;
  situation: string; consultation: string; name: string; email: string; company: string; country: string; phone: string;
};

const EMPTY: Draft = {
  category: "", groups: [], serviceKeys: [], title: "", description: "", objectives: "", website: "", timeline: "",
  budget: "", currency: "", situation: "", consultation: "", name: "", email: "", company: "", country: "", phone: "",
};

export function InquiryDialog({ journey, open, close, opener, tracking }: {
  journey: { type: InquiryType; title: string; origin: CSSProperties; key: string };
  open: boolean;
  close: () => void;
  opener: RefObject<HTMLButtonElement | null>;
  tracking: { step: (type: InquiryType, step: number) => void; submissionSession: () => Promise<string | undefined> };
}) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(EMPTY);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [reference, setReference] = useState("");
  const [catalogue, setCatalogue] = useState<InquiryServiceChoice[]>();
  const [catalogueError, setCatalogueError] = useState(false);
  const [serviceAttempt, setServiceAttempt] = useState(0);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const cancelDiscard = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const { type } = journey;
  const copy = JOURNEYS[type];

  useEffect(() => {
    if (type !== "PROJECT") return;
    const controller = new AbortController();
    fetchJson<{ services: InquiryServiceChoice[] }>("/api/inquiries/services", { signal: controller.signal })
      .then(({ services }) => setCatalogue(services))
      .catch(() => { if (!controller.signal.aborted) setCatalogueError(true); });
    return () => controller.abort();
  }, [type, serviceAttempt]);

  useEffect(() => {
    if (discard) cancelDiscard.current?.focus();
    else if (step > 1 || reference) stepHeading.current?.focus();
  }, [step, discard, reference]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function changeGroup(group: InquiryGroup) {
    setDraft((current) => {
      if (!current.groups.includes(group)) return { ...current, groups: [...current.groups, group] };
      const removed = new Set(catalogue?.filter((choice) => choice.group === group).map((choice) => choice.key));
      return { ...current, groups: current.groups.filter((value) => value !== group),
        serviceKeys: current.serviceKeys.filter((key) => !removed.has(key)) };
    });
    setError("");
  }

  function requestClose() {
    if (busy.current) return;
    const changed = step > 1 || Object.values(draft).some((value) => value.length > 0);
    if (!reference && changed) setDiscard(true);
    else close();
  }

  async function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (step === 1) {
      const hasChoices = catalogue?.some((choice) => draft.groups.includes(choice.group));
      if (type === "PROJECT" ? !catalogue || !draft.groups.length || (hasChoices && !draft.serviceKeys.length) : !draft.category) {
        setError(type === "PROJECT" ? "Select an expertise category and any available services you need." : "Choose an option to continue.");
        return;
      }
    }

    if (step < 3) {
      tracking.step(type, step);
      setStep(step + 1);
      setError("");
      return;
    }

    const contact = {
      requestId: journey.key, type, name: draft.name, email: draft.email.trim(),
      company: draft.company.trim() || undefined, phone: draft.phone.trim() || undefined, country: draft.country,
      websiteAddress: honeypot.current?.value || undefined,
    };
    const terms = { budget: draft.budget ? Number(draft.budget) : undefined, currency: draft.currency || undefined };
    const common = { ...contact, description: draft.description, objectives: draft.objectives };
    const input = type === "PROJECT" ? {
      ...common, ...terms, groups: draft.groups, serviceKeys: draft.serviceKeys, title: draft.title,
      website: draft.website.trim() || undefined, timeline: draft.timeline,
    } : type === "IDEA" ? {
      ...common, ...terms, category: draft.category, timeline: draft.timeline.trim() || undefined,
    } : { ...common, category: draft.category, situation: draft.situation, consultation: draft.consultation };

    const validated = inquirySubmission.safeParse(input);
    if (!validated.success) {
      const field = validated.error.issues[0]?.path[0];
      if (typeof field === "string" && !["name", "email", "phone", "company", "country"].includes(field)) setStep(2);
      setError(field === "phone" ? "Enter a valid phone or WhatsApp number with 7 to 15 digits." : "Please check the form fields and try again.");
      return;
    }

    busy.current = true;
    setSending(true);
    setError("");
    tracking.step(type, 3);
    try {
      const sessionId = await tracking.submissionSession();
      const result = await fetchJson<{ reference: string }>("/api/inquiries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validated.data, sessionId }),
      });
      setReference(result.reference);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Your inquiry could not be saved. Try again.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  const text = (name: keyof Draft, label: string, options: { optional?: boolean; multiline?: boolean; type?: string; max?: number } = {}) => {
    const { optional, multiline, type, max } = options;
    const value = draft[name];
    if (typeof value !== "string") return null;
    return (
      <label>
        <span>{label}{optional && <small> (optional)</small>}</span>
        {multiline ? (
          <textarea name={name} required={!optional} rows={3} maxLength={2400} value={value} onChange={(e) => update(name, e.currentTarget.value)} />
        ) : (
          <input name={name} type={type ?? "text"} required={!optional} maxLength={max ?? 160}
            min={type === "number" ? 0 : undefined} max={type === "number" ? 1_000_000_000 : undefined}
            step={type === "number" ? "0.01" : undefined} value={value} onChange={(e) => update(name, e.currentTarget.value)} />
        )}
      </label>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && open) requestClose(); }}>
      <DialogContent showCloseButton={false} finalFocus={() => opener.current} style={journey.origin} className={styles.dialog + " sm:max-w-[42rem]"}>
        <div className={styles.dialogTop}>
          <div>
            <DialogTitle className="text-sm">{journey.title}</DialogTitle>
            <DialogDescription>{reference ? "Inquiry saved." : "Work With Us inquiry"}</DialogDescription>
          </div>
          <button type="button" className={styles.inlineButton} disabled={sending} onClick={requestClose}>Close</button>
        </div>
        {reference ? (
          <div className={styles.confirmation}>
            <CheckCircle2 size={36} aria-hidden />
            <h3 ref={stepHeading} tabIndex={-1} className="font-heading">Great things start here.</h3>
            <p>Thank you for reaching out to Axonill. We&apos;ve received your inquiry, and our team will be in touch to discuss the next steps.</p>
            <p>Inquiry reference <strong>{reference}</strong></p>
            <div className={styles.actions}>
              {type === "GUIDANCE" && <BookingLink className={styles.secondary} onNavigate={close}>Request a preferred time</BookingLink>}
              <button type="button" className={styles.cta} onClick={close}>Done</button>
            </div>
          </div>
        ) : discard ? (
          <div className={styles.confirmation}>
            <h3 className="font-heading">Discard this inquiry?</h3>
            <p>Your entries will be cleared if you leave.</p>
            <div className={styles.actions}>
              <button ref={cancelDiscard} type="button" className={styles.secondary} onClick={() => {
                setDiscard(false);
                requestAnimationFrame(() => stepHeading.current?.focus());
              }}>Keep editing</button>
              <button type="button" className={styles.cta} onClick={close}>Discard inquiry</button>
            </div>
          </div>
        ) : (
          <form onSubmit={advance} className={styles.form}>
            <ol className={styles.progress} aria-label="Inquiry progress">
              {[type === "PROJECT" ? "Expertise" : "Category", "Details", "Contact"].map((label, index) => (
                <li key={label} data-complete={index < step - 1} aria-current={index === step - 1 ? "step" : undefined}>
                  <span>{index < step - 1 ? <Check size={14} aria-hidden /> : index + 1}</span>{label}
                </li>
              ))}
            </ol>

            <div key={step} className={styles.step}>
              <h3 ref={stepHeading} tabIndex={-1} className="font-heading">{step === 1 ? copy.first : step === 2 ? copy.second : "How can we reach you?"}</h3>
              {step === 1 && (type === "PROJECT" ? (
                <div className={styles.fields}>
                  <div className={styles.groupChoices} aria-label="Expertise categories" role="group">
                    {INQUIRY_GROUPS.map((group) => (
                      <button key={group} type="button" aria-pressed={draft.groups.includes(group)}
                        className={styles.choice} onClick={() => changeGroup(group)}>{GROUP_LABELS[group]}</button>
                    ))}
                  </div>
                  {catalogueError ? <p role="alert">The service catalogue could not load.{" "}
                    <button type="button" className={styles.inlineButton} onClick={() => {
                      setCatalogueError(false);
                      setServiceAttempt((attempt) => attempt + 1);
                    }}>Retry</button></p> : !catalogue ? <p role="status">Loading published services…</p> :
                    draft.groups.map((group) => {
                      const choices = catalogue.filter((item) => item.group === group);
                      return <fieldset key={group} className={styles.services}>
                        <legend>{GROUP_LABELS[group]}</legend>
                        {choices.length ? choices.map(({ key, label }) => (
                          <label key={key} className={styles.checkChoice}>
                            <input type="checkbox" checked={draft.serviceKeys.includes(key)}
                              onChange={(e) => update("serviceKeys", e.currentTarget.checked ? [...draft.serviceKeys, key] : draft.serviceKeys.filter((value) => value !== key))} />
                            <span>{label}</span>
                          </label>
                        )) : <p>No published services in this category. You can describe what you need in the next step.</p>}
                      </fieldset>;
                    })}
                </div>
              ) : (
                <fieldset className={styles.groupChoices}>
                  <legend className="sr-only">{copy.first}</legend>
                  {(type === "IDEA" ? IDEA_CATEGORIES : GUIDANCE_CATEGORIES).map((value) => (
                    <label key={value} className={styles.checkChoice}>
                      <input type="radio" name="category" checked={draft.category === value} onChange={() => update("category", value)} />
                      <span>{value}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
              {step === 2 && (
                <div className={styles.fields}>
                  {type === "PROJECT" && text("title", "Project title")}
                  {type === "GUIDANCE" && text("situation", "Current business situation", { multiline: true })}
                  {text("description", type === "IDEA" ? "Idea description" : type === "PROJECT" ? "Project description" : "Main challenge", { multiline: true })}
                  {text("objectives", type === "GUIDANCE" ? "Desired outcome" : "Business objectives", { multiline: true })}
                  {type === "PROJECT" && text("website", "Existing website URL", { optional: true, type: "url", max: 2048 })}
                  {type !== "GUIDANCE" ? <>
                    {text("timeline", type === "PROJECT" ? "Expected timeline" : "Estimated timeline", { optional: type === "IDEA" })}
                    <div className={styles.two}>
                      {text("budget", "Estimated budget", { optional: true, type: "number" })}
                      <label><span>Preferred currency <small>(optional)</small></span>
                        <select value={draft.currency} onChange={(e) => update("currency", e.currentTarget.value)}>
                          <option value="">Choose currency</option>
                          {CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}
                        </select>
                      </label>
                    </div>
                  </> : (
                    <label><span>Preferred consultation method</span>
                      <select required value={draft.consultation} onChange={(e) => update("consultation", e.currentTarget.value)}>
                        <option value="">Choose a method</option>
                        {CONSULTATION_METHODS.map((method) => <option key={method}>{method}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className={styles.fields}>
                  {text("name", "Full name", { max: 120 })}
                  {text("email", "Email address", { type: "email", max: 254 })}
                  {text("company", "Company name", { optional: true })}
                  <label><span>Country</span>
                    <select required value={draft.country} onChange={(e) => update("country", e.currentTarget.value)}>
                      <option value="">Select your country</option>
                      {COUNTRY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  {text("phone", "Phone or WhatsApp number", { optional: true, type: "tel", max: 30 })}
                  {type === "GUIDANCE" && <p className={styles.help}>Send a consultation request now. You can request a preferred meeting time after we receive it.</p>}
                  <p className={styles.help}>Axonill uses these details to respond to your inquiry and coordinate any next steps.</p>
                </div>
              )}
            </div>

            <div className={styles.trap} aria-hidden>
              <label>Leave this field empty<input ref={honeypot} name="websiteAddress" tabIndex={-1} autoComplete="off" /></label>
            </div>
            {error && <p role="alert" className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              {step > 1 && <button type="button" className={styles.secondary} disabled={sending}
                onClick={() => { setStep(step - 1); setError(""); requestAnimationFrame(() => stepHeading.current?.focus()); }}>
                <ArrowLeft size={15} aria-hidden />Back
              </button>}
              <button type="submit" className={styles.cta} disabled={sending}>
                {sending ? "Sending…" : step === 3 ? copy.final : "Continue"}<ArrowRight size={16} aria-hidden />
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
