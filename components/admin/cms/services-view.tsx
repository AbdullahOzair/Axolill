"use client";

import type { Service } from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChipInput } from "@/components/admin/cms/chip-input";
import { CmsManager } from "@/components/admin/cms/cms-manager";
import { Field, type FieldErrors } from "@/components/admin/form-dialog";
import { IconPicker } from "@/components/admin/cms/icon-picker";
import { iconFor } from "@/components/icon-map";

type Draft = {
  icon: string;
  title: string;
  summary: string;
  items: string[];
  order: number;
  published: boolean;
};

const EMPTY: Draft = {
  icon: "CodeXml",
  title: "",
  summary: "",
  items: [],
  order: 0,
  published: false,
};

export function ServicesView() {
  return (
    <CmsManager<Service, Draft>
      title="Services"
      description="The service cards shown in the Services section of the homepage."
      endpoint="/api/services"
      listKey="services"
      addLabel="Add service"
      emptyDraft={EMPTY}
      labelOf={(s) => s.title}
      toDraft={(s) => ({
        icon: s.icon,
        title: s.title,
        summary: s.summary,
        items: s.items,
        order: s.order,
        published: s.published,
      })}
      validate={(d) => {
        const e: FieldErrors = {};
        if (!d.title.trim()) e.title = "Give the service a title.";
        if (!d.icon) e.icon = "Pick an icon.";
        return e;
      }}
      columns={[
        {
          header: "Service",
          cell: (s) => {
            const Icon = iconFor(s.icon);
            return (
              <div className="flex items-center gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 dark:text-blue-400">
                  <Icon className="size-4" />
                </span>
                <span className="font-medium">{s.title}</span>
              </div>
            );
          },
        },
        {
          header: "Items",
          cell: (s) =>
            s.items.length ? (
              <Badge variant="secondary" className="rounded-full text-xs">
                {s.items.length}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          className: "w-24",
        },
      ]}
      renderForm={(d, patch, errors) => (
        <>
          <Field id="svc-icon" label="Icon" error={errors.icon} required>
            {() => (
              <IconPicker value={d.icon} onChange={(icon) => patch({ icon })} />
            )}
          </Field>

          <Field id="svc-title" label="Title" error={errors.title} required>
            {(f) => (
              <Input
                {...f}
                value={d.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Web Development"
              />
            )}
          </Field>

          <Field
            id="svc-summary"
            label="Summary"
            hint="One line, shown under the title on the homepage card."
            error={errors.summary}
          >
            {(f) => (
              <Textarea
                {...f}
                rows={3}
                value={d.summary}
                onChange={(e) => patch({ summary: e.target.value })}
                placeholder="Fast, accessible, production-grade web apps."
              />
            )}
          </Field>

          <Field
            id="svc-items"
            label="Sub-services"
            hint="Press Enter after each one."
            error={errors.items}
          >
            {(f) => (
              <ChipInput
                id={f.id}
                value={d.items}
                onChange={(items) => patch({ items })}
                placeholder="e.g. Next.js & React"
              />
            )}
          </Field>

          <Field
            id="svc-order"
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
