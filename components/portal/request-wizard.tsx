"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/use-api";
import { CONSULTATION_METHODS, GROUP_LABELS, GUIDANCE_CATEGORIES, type InquiryServiceChoice } from "@/lib/inquiries";
import { currencies, timelines, validateBrief, journeys, type WorkspaceInput } from "@/lib/portal-workspace";
import { QUICK_TEMPLATES } from "./request-templates";

export const workspaceApi = "/api/portal/workspace";
export const attachmentAccept = ".pdf,.png,.jpg,.jpeg,.webp";

export function sendWorkspace<T>(url: string, method: string, body?: unknown) {
  return fetchJson<T>(workspaceApi + url, { method, ...(body === undefined ? {} : body instanceof FormData ? { body } :
    { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="axp-field"><span>{label}</span>{children}</label>;
}

export function BriefSummary({ input, catalog, attached }: { input: WorkspaceInput; catalog: InquiryServiceChoice[]; attached: string[] }) {
  const names = input.services.map((key) => catalog.find((service) => service.key === key)?.label ?? (() => {
    try { return String(JSON.parse(key)[1] ?? "Service"); } catch { return "Service"; }
  })());
  const values = [
    ["Name", input.title], ["Services", input.unsure ? "Not sure yet" : names.join(", ")],
    ["Description", input.description], ["Goals", input.objectives], ["Audience", input.audience],
    ["Requested features", input.features], ["Reference website", input.website], ["Area of assistance", input.area],
    ["Estimated budget", input.budget === null ? (input.budgetRange ? input.currency + " " + input.budgetRange : "Not sure yet") :
      new Intl.NumberFormat(undefined, { style: "currency", currency: input.currency }).format(input.budget)],
    ["Timeline", input.timeline === "Custom date" ? input.date : input.timeline], ["Attachments", attached.join(", ")],
    ["Preferred contact", input.communication], ["Introductory consultation", input.consultation ? "Requested" : ""],
  ];
  return <dl className="axp-summary">{values.filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>;
}

type WizardProps = {
  id: string; version: number; input: WorkspaceInput; catalog: InquiryServiceChoice[];
  ranges: Record<(typeof currencies)[number], string[]>; attachments: { id: string; name: string }[];
};

const projectSteps = ["Services", "Project details", "Estimated budget", "Timeline", "Review and submit"];

export function RequestWizard({ id, version, input, catalog, ranges, attachments }: WizardProps) {
  const [values, setValues] = useState(input);
  const [files, setFiles] = useState(attachments);
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState("Draft saved");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(input.budget !== null);
  const fieldset = useRef<HTMLHeadingElement>(null);
  const lastSaved = useRef(JSON.stringify(input));
  const versionRef = useRef(version);
  const operation = useRef<Promise<void>>(Promise.resolve());
  const paused = useRef(false);
  const pending = useRef(false);
  const steps = input.type === "PROJECT" ? projectSteps : [input.type === "IDEA" ? "Your idea" : "Tell us what you need", "Review and submit"];
  const path = "/requests/" + id;
  const isProject = input.type === "PROJECT";
  const review = step === steps.length - 1;
  const title = journeys.find((item) => item.id === input.type)?.title;

  function update<K extends keyof WorkspaceInput>(key: K, value: WorkspaceInput[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setSaveState("Saving changes…");
  }

  function save(snapshot: WorkspaceInput) {
    const data = JSON.stringify(snapshot);
    const next = operation.current.catch(() => undefined).then(async () => {
      if (lastSaved.current === data) return;
      const result = await sendWorkspace<{ version: number }>(path, "PATCH", { input: snapshot, version: versionRef.current });
      versionRef.current = result.version;
      lastSaved.current = data;
      setSaveState("Draft saved");
    });
    operation.current = next;
    return next;
  }

  useEffect(() => {
    if (paused.current || JSON.stringify(values) === lastSaved.current) return;
    const timer = window.setTimeout(() => {
      void save(values).catch(() => setSaveState("Could not save draft. Use Save draft to retry."));
    }, 650);
    return () => window.clearTimeout(timer);
    // The path remains fixed for this mounted draft. Saving uses the queued version token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(values) === lastSaved.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [values]);

  async function run(task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    paused.current = true;
    setBusy(true);
    setError("");
    try { await task(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Please try again."); }
    finally { pending.current = false; paused.current = false; setBusy(false); }
  }

  function goTo(next: number) {
    setStep(next);
    requestAnimationFrame(() => fieldset.current?.focus());
  }

  async function nextStep(event: FormEvent) {
    event.preventDefault();
    if (review) {
      const issue = validateBrief(values);
      if (issue) return setError(issue);
      await run(async () => {
        // Serialize submission behind any save already in flight and use the resulting version.
        await save(values);
        await sendWorkspace(path + "/submit", "POST", { input: values, version: versionRef.current });
        window.location.assign("/portal/requests/" + id + "?submitted=1");
      });
      return;
    }
    if (isProject && step === 0 && !values.unsure && !values.services.length) return setError("Choose a service or select Not sure yet.");
    if (isProject && step === 2 && custom && values.budget === null) return setError("Enter an amount, choose a range, or select Not sure yet.");
    if (isProject && step === 3) {
      const issue = validateBrief(values);
      if (issue) return setError(issue);
    }
    if (!isProject) {
      const issue = validateBrief(values);
      if (issue) return setError(issue);
    }
    setError("");
    goTo(step + 1);
    await run(() => save(values));
  }

  function addFile(file: File) {
    void run(async () => {
      await save(values);
      const form = new FormData();
      form.set("file", file);
      const result = await sendWorkspace<{ id: string }>(path + "/attachments", "POST", form);
      setFiles((previous) => [...previous, { id: result.id, name: file.name }]);
    });
  }

  const details = isProject ? step === 1 : step === 0;
  const budget = (isProject && step === 2) || (input.type === "IDEA" && step === 0);
  const timeline = isProject && step === 3;
  return <section className="axp-card axp-wizard">
    <div className="axp-row"><p className="axp-kicker">{title}</p><span className="axp-note" aria-live="polite">{saveState}</span></div>
    <ol className="axp-steps">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}>
      <button type="button" disabled={index > step || busy} onClick={() => goTo(index)}>{index + 1}. {label}</button>
    </li>)}</ol>
    <h2 tabIndex={-1} ref={fieldset}>{steps[step]}</h2>
    <form onSubmit={nextStep} className="axp-stack">
      {isProject && step === 0 && <>
        <p className="axp-note">Select all the services you need. It’s fine if you’re still deciding.</p>
        {Object.entries(GROUP_LABELS).map(([group, label]) => {
          const services = catalog.filter((item) => item.group === group);
          return services.length > 0 && <fieldset className="axp-checks" key={group}><legend>{label}</legend>
            {services.map((item) => <label key={item.key}><input type="checkbox" checked={values.services.includes(item.key)}
              onChange={(event) => setValues((previous) => ({ ...previous, unsure: false,
                services: event.target.checked ? [...previous.services, item.key] : previous.services.filter((key) => key !== item.key) }))} />{item.label}</label>)}
          </fieldset>;
        })}
        <label className="axp-check"><input type="checkbox" checked={values.unsure}
          onChange={(event) => setValues((previous) => ({ ...previous, unsure: event.target.checked, services: event.target.checked ? [] : previous.services }))} />Not sure yet</label>
      </>}
      {details && <>
        {isProject && <Field label="Start with a template (optional)"><select defaultValue="" onChange={(event) => {
          const template = QUICK_TEMPLATES.find((item) => item.id === event.target.value);
          if (template && ((!values.description && !values.features) || window.confirm("Replace your description and feature list with this template?")))
            setValues((previous) => ({ ...previous, description: template.description, features: template.features.join("\n") }));
        }}><option value="">Choose a template</option>{QUICK_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>}
        <Field label={isProject ? "Project or business name" : input.type === "IDEA" ? "Idea or business name" : "Business name (optional)"}>
          <input required={input.type !== "GUIDANCE"} maxLength={160} value={values.title} onChange={(event) => update("title", event.target.value)} />
        </Field>
        {input.type === "GUIDANCE" && <Field label="What would you like help with?"><select required value={values.area} onChange={(event) => update("area", event.target.value)}>
          <option value="">Choose an area</option>{GUIDANCE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
        </select></Field>}
        <Field label={input.type === "GUIDANCE" ? "What challenges are you facing?" : isProject ? "Describe your project" : "Describe your idea"}>
          <textarea rows={4} required maxLength={5000} value={values.description} onChange={(event) => update("description", event.target.value)} />
        </Field>
        {input.type !== "GUIDANCE" && <Field label={isProject ? "What do you want to achieve?" : "What problem does it solve?"}>
          <textarea required rows={3} maxLength={2000} value={values.objectives} onChange={(event) => update("objectives", event.target.value)} />
        </Field>}
        {isProject && <>
          <Field label="Requested features (optional)"><textarea rows={3} maxLength={2000} value={values.features} onChange={(event) => update("features", event.target.value)}
            placeholder={catalog.some((item) => values.services.includes(item.key) && item.group === "growth") ? "For example, the audiences or channels you want to reach" :
              catalog.some((item) => values.services.includes(item.key) && item.group === "creative") ? "For example, existing brand assets or styles you like" : "For example, checkout, sign-in, or bookings"} /></Field>
          <Field label="Reference website (optional)"><input type="url" maxLength={500} value={values.website} onChange={(event) => update("website", event.target.value)} /></Field>
        </>}
        {input.type === "IDEA" && <Field label="Who is it for? (optional)"><input maxLength={500} value={values.audience} onChange={(event) => update("audience", event.target.value)} /></Field>}
        {input.type !== "GUIDANCE" && <>
          <Field label="Reference files (optional)"><input type="file" accept={attachmentAccept} disabled={busy || files.length >= 8}
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) addFile(file); }} /></Field>
          <p className="axp-note">PDF, PNG, JPEG, or WebP. Up to 8 files, 5 MB each.</p>
          {files.map((file) => <div className="axp-row" key={file.id}>
            <a href={workspaceApi + path + "/attachments/" + file.id}>{file.name}</a>
            <Button variant="ghost" size="sm" type="button" disabled={busy} onClick={() => void run(async () => {
              await sendWorkspace(path + "/attachments/" + file.id, "DELETE");
              setFiles((items) => items.filter((item) => item.id !== file.id));
            })}>Remove</Button>
          </div>)}
        </>}
        {!isProject && <>
          <Field label={input.type === "GUIDANCE" ? "How would you like us to contact you?" : "Consultation preference (optional)"}>
            <select required={input.type === "GUIDANCE"} value={values.communication} onChange={(event) => update("communication", event.target.value)}>
              <option value="">Choose a preference</option>{CONSULTATION_METHODS.map((item) => <option key={item}>{item}</option>)}
            </select></Field>
          <label className="axp-check"><input type="checkbox" checked={values.consultation} onChange={(event) => update("consultation", event.target.checked)} />I’d like an introductory consultation</label>
        </>}
      </>}
      {budget && <>
        <p className="axp-note">An estimate helps us scope the work. You’ll receive a separate quotation.</p>
        <div className="axp-fields">
          <Field label="Currency"><select value={values.currency} onChange={(event) => {
            setValues((previous) => ({ ...previous, currency: event.target.value as WorkspaceInput["currency"], budget: null, budgetRange: "" }));
            setCustom(false);
          }}>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></Field>
          <Field label="Estimated budget"><select value={custom ? "custom" : values.budgetRange} onChange={(event) => {
            const value = event.target.value;
            setCustom(value === "custom");
            setValues((previous) => ({ ...previous, budget: null, budgetRange: value === "custom" ? "" : value }));
          }}><option value="">Not sure yet</option>{ranges[values.currency].map((range) => <option key={range}>{range}</option>)}<option value="custom">Enter a custom amount</option></select></Field>
        </div>
        {custom && <Field label="Estimated amount"><input required min="0" max="1000000000" type="number" step="0.01"
          value={values.budget ?? ""} onChange={(event) => update("budget", event.target.value === "" ? null : Number(event.target.value))} /></Field>}
      </>}
      {timeline && <>
        <Field label="When would you like the project delivered?"><select required value={values.timeline} onChange={(event) => update("timeline", event.target.value)}>
          <option value="">Choose a timeline</option>{timelines.map((item) => <option key={item}>{item}</option>)}
        </select></Field>
        {values.timeline === "Custom date" && <Field label="Target date"><input required type="date" value={values.date} onChange={(event) => update("date", event.target.value)} /></Field>}
        <label className="axp-check"><input type="checkbox" checked={values.consultation} onChange={(event) => update("consultation", event.target.checked)} />I’d like an introductory consultation</label>
      </>}
      {review && <BriefSummary input={values} catalog={catalog} attached={files.map((file) => file.name)} />}
      {error && <p className="axp-feedback" role="alert">{error}</p>}
      <div className="axp-actions">
        {step > 0 && <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={busy}>Back</Button>}
        <Button type="button" variant="outline" onClick={() => void run(() => save(values))} disabled={busy}>Save draft</Button>
        <Button type="submit" disabled={busy}>{busy ? "Working…" : review ? "Submit request" : "Continue"}</Button>
      </div>
    </form>
  </section>;
}
