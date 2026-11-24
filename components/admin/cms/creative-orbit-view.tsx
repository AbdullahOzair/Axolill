"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AdminPage } from "@/components/admin/admin-page";
import { prepareOrbitImage } from "@/components/admin/cms/creative-orbit-image";
import { ImageUpload } from "@/components/admin/cms/image-upload";
import { Field, FormDialog } from "@/components/admin/form-dialog";
import { CreativeOrbit } from "@/components/sections/creative-orbit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_ORBIT_SETTINGS,
  ORBIT_DURATION_MAX,
  ORBIT_DURATION_MIN,
  ORBIT_LIMIT,
  orbitImageSchema,
  orbitSettingsSchema,
  type OrbitData,
  type OrbitImage,
  type OrbitImageInput,
  type OrbitSettings,
} from "@/lib/creative-orbit";
import { fetchJson, useLoader } from "@/lib/use-api";

const ENDPOINT = "/api/admin/creative-orbit";
const EMPTY_IMAGE: OrbitImageInput = { imageKey: "", title: "", alt: "", active: true };

function loadOrbit() {
  return fetchJson<OrbitData>(ENDPOINT);
}

export function CreativeOrbitView() {
  const { data, error, loading, reload, setData } = useLoader(loadOrbit);
  const [draft, setDraft] = useState<OrbitImageInput | null>(null);
  const [editing, setEditing] = useState<string>();
  const [removing, setRemoving] = useState<OrbitImage | null>(null);
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragged, setDragged] = useState<string>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");
  const [settingsDraft, setSettingsDraft] = useState<OrbitSettings | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const mutating = useRef(false);
  const images = data?.images ?? [];
  const settings = settingsDraft ?? data?.settings ?? DEFAULT_ORBIT_SETTINGS;
  const active = images.filter((image) => image.active);

  async function mutate(path: string, method: string, body?: unknown) {
    if (mutating.current) return false;
    mutating.current = true;
    setBusy(true);
    try {
      await fetchJson(path, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      try {
        const updated = await loadOrbit();
        setData(() => updated);
      } catch {
        reload();
      }
      return true;
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  }

  function openImage(image?: OrbitImage) {
    setEditing(image?.id);
    setDraft(image ? { imageKey: image.imageKey, title: image.title, alt: image.alt, active: image.active } : EMPTY_IMAGE);
    setFormError("");
  }

  async function saveImage() {
    if (!draft || uploading) return;
    const result = orbitImageSchema.safeParse(draft);
    if (!result.success) {
      setFormError(draft.imageKey ? "Enter alternative text before saving." : "Upload an image before saving.");
      return;
    }
    try {
      if (await mutate(editing ? `${ENDPOINT}/${editing}` : ENDPOINT, editing ? "PATCH" : "POST", result.data)) {
        setDraft(null);
        toast.success("Orbit image saved.");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the image.");
    }
  }

  async function deleteImage() {
    if (!removing) return;
    try {
      if (await mutate(`${ENDPOINT}/${removing.id}`, "DELETE")) {
        setRemoving(null);
        toast.success("Orbit image deleted.");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not delete the image.");
    }
  }

  async function moveImage(id: string, to: number) {
    const from = images.findIndex((image) => image.id === id);
    if (from < 0 || to < 0 || to >= images.length || from === to) return;
    const ordered = images.map((image) => image.id);
    ordered.splice(from, 1);
    ordered.splice(to, 0, id);
    try {
      if (await mutate(ENDPOINT, "PUT", { ids: ordered })) {
        setAnnouncement(`Image moved to position ${to + 1} of ${images.length}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder the images.");
      reload();
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    const result = orbitSettingsSchema.safeParse(settings);
    if (!result.success) {
      toast.error(`Enter a rotation duration between ${ORBIT_DURATION_MIN} and ${ORBIT_DURATION_MAX} seconds.`);
      return;
    }
    try {
      if (await mutate(ENDPOINT, "PATCH", result.data)) {
        setSettingsDraft(null);
        toast.success("Orbit settings saved.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings.");
    }
  }

  return (
    <AdminPage
      eyebrow="Content"
      title="Creative Orbit"
      description="Manage the project images that appear above the homepage contact CTA."
      action={<Button disabled={!data || busy || loading || images.length >= ORBIT_LIMIT} onClick={() => openImage()}><Plus /> Add image</Button>}
    >
      {loading && !data && <p role="status" className="text-sm text-muted-foreground">Loading Creative Orbit…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="outline" size="sm" onClick={reload}>Retry</Button></p>}

      {data && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.75fr)]">
          <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="orbit-images">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="orbit-images" className="font-heading text-lg font-semibold">Images</h2>
              <p className="text-sm text-muted-foreground">{images.length} / {ORBIT_LIMIT} uploaded</p>
            </div>
            {images.length === 0 && <p className="text-sm text-muted-foreground">Upload an image to start your showcase.</p>}
            <span className="sr-only" aria-live="polite">{announcement}</span>
            <ol className="space-y-2">
              {images.map((image, index) => (
                <li
                  key={image.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 ${dropTarget === image.id ? "border-ring bg-accent/30" : "border-border"}`}
                  onDragOver={(event) => {
                    if (!dragged || busy || dragged === image.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropTarget(image.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged) void moveImage(dragged, index);
                    setDragged(undefined);
                    setDropTarget(undefined);
                  }}
                >
                  <span
                    className="cursor-grab text-muted-foreground active:cursor-grabbing"
                    draggable={!busy}
                    aria-hidden="true"
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", image.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragged(image.id);
                    }}
                    onDragEnd={() => { setDragged(undefined); setDropTarget(undefined); }}
                  ><GripVertical className="size-4" /></span>
                  <span className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    <Image src={`/api/media/${image.imageKey}`} alt="" fill unoptimized sizes="64px" className="object-cover" />
                  </span>
                  <div className="min-w-24 flex-1 break-words">
                    <p className="text-sm font-medium">{image.title || image.alt}</p>
                    <p className="text-xs text-muted-foreground">{image.active ? "Active" : "Inactive"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="ghost" size="icon-sm" disabled={busy || index === 0} onClick={() => void moveImage(image.id, index - 1)} aria-label={`Move ${image.title || image.alt} up`}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" disabled={busy || index === images.length - 1} onClick={() => void moveImage(image.id, index + 1)} aria-label={`Move ${image.title || image.alt} down`}><ArrowDown /></Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => openImage(image)}>Edit</Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setRemoving(image); setFormError(""); }}>Delete</Button>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="min-w-0 space-y-5">
            <form className="space-y-4 rounded-xl border bg-card p-4 sm:p-5" onSubmit={saveSettings}>
              <h2 className="font-heading text-lg font-semibold">Orbit settings</h2>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettingsDraft({ ...settings, enabled: event.target.checked })} />
                Show Creative Orbit on the homepage
              </label>
              <Field id="orbit-duration" label="Seconds per revolution" required>
                {(props) => <Input {...props} type="number" min={ORBIT_DURATION_MIN} max={ORBIT_DURATION_MAX} required value={Number.isFinite(settings.duration) ? settings.duration : ""} onChange={(event) => setSettingsDraft({ ...settings, duration: event.target.valueAsNumber })} />}
              </Field>
              <Field id="orbit-direction" label="Rotation direction">
                {(props) => <select {...props} className="h-9 rounded-md border border-input bg-background px-2.5 text-sm" value={settings.direction} onChange={(event) => setSettingsDraft({ ...settings, direction: event.target.value === "anticlockwise" ? "anticlockwise" : "clockwise" })}>
                  <option value="clockwise">Clockwise</option>
                  <option value="anticlockwise">Anticlockwise</option>
                </select>}
              </Field>
              <Button type="submit" disabled={busy || !settingsDraft}>Save settings</Button>
            </form>

            <section className="rounded-xl border bg-card p-4 sm:p-5" aria-labelledby="orbit-preview">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="orbit-preview" className="font-heading text-lg font-semibold">Preview</h2>
                <div className="flex gap-1" aria-label="Preview theme">
                  {(["light", "dark"] as const).map((theme) => (
                    <Button key={theme} size="sm" variant={theme === previewTheme ? "secondary" : "ghost"} aria-pressed={theme === previewTheme} onClick={() => setPreviewTheme(theme)} className="capitalize">{theme}</Button>
                  ))}
                </div>
              </div>
              <div className={`overflow-hidden rounded-lg border p-3 text-center ${previewTheme === "dark" ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
                <CreativeOrbit images={active} settings={Number.isFinite(settings.duration) ? settings : data.settings} previewTheme={previewTheme} />
                <p className="py-3 text-base font-semibold">Let&apos;s discuss your project.</p>
                {(!settings.enabled || !active.length) && <p className="pb-2 text-xs opacity-80">{settings.enabled ? "No active images." : "The orbit is disabled."}</p>}
              </div>
            </section>
          </div>
        </div>
      )}

      {draft && (
        <FormDialog open onOpenChange={() => setDraft(null)} title={editing ? "Edit orbit image" : "Add orbit image"} description="Choose an image and describe what it shows." saving={busy || uploading} savingLabel={uploading ? "Uploading…" : "Saving…"} error={formError} onSubmit={() => void saveImage()}>
          <ImageUpload value={draft.imageKey || null} onChange={(key) => setDraft((current) => current && { ...current, imageKey: key ?? "" })} onUploadingChange={setUploading} prepareFile={prepareOrbitImage} />
          <Field id="orbit-image-title" label="Title">
            {(props) => <Input {...props} maxLength={100} value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />}
          </Field>
          <Field id="orbit-image-alt" label="Alternative text" required>
            {(props) => <Input {...props} required maxLength={180} value={draft.alt} onChange={(event) => setDraft({ ...draft, alt: event.target.value })} />}
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            Active on the homepage
          </label>
        </FormDialog>
      )}
      {removing && (
        <FormDialog open onOpenChange={() => setRemoving(null)} title="Delete orbit image?" description={removing.title || removing.alt} saving={busy} error={formError} submitLabel="Delete image" onSubmit={() => void deleteImage()}>
          <p className="text-sm">This image will be removed from the Creative Orbit.</p>
        </FormDialog>
      )}
    </AdminPage>
  );
}
