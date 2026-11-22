"use client";

import { useEffect, useState } from "react";

import {
  TECHNOLOGY_CATEGORIES,
  type Technology,
  type TechnologyCategory,
} from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CmsManager } from "@/components/admin/cms/cms-manager";
import { Field, type FieldErrors } from "@/components/admin/form-dialog";
import { TechnologyIcon } from "@/components/technology-icon";
import { TECHNOLOGY_ICON_URL_LIMIT, technologyIconUrlError } from "@/lib/technology-icon-url";

type Draft = {
  category: TechnologyCategory;
  name: string;
  iconUrl: string;
  order: number;
  published: boolean;
};

const EMPTY: Draft = {
  category: "Frontend",
  name: "",
  iconUrl: "",
  order: 0,
  published: false,
};

export function TechnologiesView() {
  return (
    <CmsManager<Technology, Draft>
      title="Technologies"
      description="The tech-stack badges, grouped by category on the homepage."
      endpoint="/api/technologies"
      listKey="technologies"
      addLabel="Add technology"
      emptyDraft={EMPTY}
      labelOf={(t) => t.name}
      toDraft={(t) => ({
        category: t.category,
        name: t.name,
        iconUrl: t.iconUrl ?? "",
        order: t.order,
        published: t.published,
      })}
      validate={(d) => {
        const e: FieldErrors = {};
        if (!d.name.trim()) e.name = "Name is required.";
        const iconError = technologyIconUrlError(d.iconUrl);
        if (iconError) e.iconUrl = iconError;
        return e;
      }}
      columns={[
        {
          header: "Technology",
          cell: (t) => (
            <span className="inline-flex items-center gap-2 font-medium">
              <TechnologyIcon name={t.name} iconUrl={t.iconUrl} className="size-5" />
              {t.name}
            </span>
          ),
        },
        {
          header: "Category",
          cell: (t) => (
            <Badge variant="secondary" className="rounded-full text-xs">
              {t.category}
            </Badge>
          ),
          className: "w-40",
        },
      ]}
      renderForm={(d, patch, errors) => (
        <>
          <Field
            id="tech-category"
            label="Category"
            error={errors.category}
            required
          >
            {(f) => (
              <Select
                items={TECHNOLOGY_CATEGORIES.map((c) => ({
                  value: c,
                  label: c,
                }))}
                value={d.category}
                onValueChange={(v) =>
                  patch({ category: v as TechnologyCategory })
                }
              >
                <SelectTrigger
                  id={f.id}
                  aria-invalid={f["aria-invalid"]}
                  aria-describedby={f["aria-describedby"]}
                  className="w-full"
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {TECHNOLOGY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field id="tech-name" label="Name" error={errors.name} required>
            {(f) => (
              <Input
                {...f}
                value={d.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="PostgreSQL"
              />
            )}
          </Field>

          <TechnologyIconField name={d.name} value={d.iconUrl} error={errors.iconUrl} onChange={(iconUrl) => patch({ iconUrl })} />

          <Field
            id="tech-order"
            label="Order"
            hint="Lower numbers appear first."
            error={errors.order}
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                value={d.order}
                onChange={(e) => patch({ order: Number(e.target.value) || 0 })}
              />
            )}
          </Field>
        </>
      )}
    />
  );
}

function TechnologyIconField({ name, value, error, onChange }: {
  name: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const invalid = technologyIconUrlError(value);
  const validUrl = invalid ? "" : value.trim();

  useEffect(() => {
    if (!validUrl) return;
    const timeout = window.setTimeout(() => setPreviewUrl(validUrl), 250);
    return () => window.clearTimeout(timeout);
  }, [validUrl]);

  return (
    <div className="space-y-2.5">
      <Field id="tech-icon-url" label="Technology Icon URL" error={error ?? invalid ?? undefined}>
        {(f) => (
          <Input
            {...f}
            type="url"
            maxLength={TECHNOLOGY_ICON_URL_LIMIT}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg"
          />
        )}
      </Field>
      <TechnologyIcon
        name={name}
        iconUrl={validUrl === previewUrl ? previewUrl : null}
        className="size-10"
        preview
        preparing={Boolean(validUrl && validUrl !== previewUrl)}
      />
    </div>
  );
}
