"use client";

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

type Draft = {
  category: TechnologyCategory;
  name: string;
  order: number;
  published: boolean;
};

const EMPTY: Draft = {
  category: "Frontend",
  name: "",
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
        order: t.order,
        published: t.published,
      })}
      validate={(d) => {
        const e: FieldErrors = {};
        if (!d.name.trim()) e.name = "Name is required.";
        return e;
      }}
      columns={[
        {
          header: "Technology",
          cell: (t) => <span className="font-medium">{t.name}</span>,
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
