"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";

import type { PortfolioItem } from "@/lib/data-model";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChipInput } from "@/components/admin/cms/chip-input";
import { CmsManager } from "@/components/admin/cms/cms-manager";
import { Field, type FieldErrors } from "@/components/admin/form-dialog";
import { ImageUpload } from "@/components/admin/cms/image-upload";

type Draft = {
  category: string;
  title: string;
  description: string;
  tags: string[];
  coverImage: string | null;
  order: number;
  published: boolean;
};

const EMPTY: Draft = {
  category: "",
  title: "",
  description: "",
  tags: [],
  coverImage: null,
  order: 0,
  published: false,
};

/** Must match the filter tabs in components/sections/portfolio.tsx. */
const CATEGORY_SUGGESTIONS = [
  "Web Development",
  "Mobile Apps",
  "UI/UX",
  "AI Solutions",
  "Machine Learning",
  "Dashboards",
  "Data Analytics",
];

export function PortfolioView() {
  return (
    <CmsManager<PortfolioItem, Draft>
      title="Portfolio"
      description="Case-study cards shown in the Work section."
      endpoint="/api/portfolio"
      listKey="portfolio"
      addLabel="Add project"
      emptyDraft={EMPTY}
      labelOf={(p) => p.title}
      toDraft={(p) => ({
        category: p.category,
        title: p.title,
        description: p.description,
        tags: p.tags,
        coverImage: p.coverImage,
        order: p.order,
        published: p.published,
      })}
      validate={(d) => {
        const e: FieldErrors = {};
        if (!d.title.trim()) e.title = "Give the project a title.";
        if (!d.category.trim()) e.category = "Pick a category.";
        return e;
      }}
      columns={[
        {
          header: "Project",
          cell: (p) => (
            <div className="flex items-center gap-3">
              <div className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/60 bg-secondary">
                {p.coverImage ? (
                  <Image
                    src={`/api/media/${p.coverImage}`}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <ImageOff className="size-4 text-muted-foreground" />
                )}
              </div>
              <span className="font-medium">{p.title}</span>
            </div>
          ),
        },
        {
          header: "Category",
          cell: (p) => (
            <Badge variant="secondary" className="rounded-full text-xs">
              {p.category}
            </Badge>
          ),
          className: "w-44",
        },
        {
          header: "Tags",
          cell: (p) =>
            p.tags.length ? (
              <span className="text-muted-foreground">{p.tags.length}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
          className: "w-20",
        },
      ]}
      renderForm={(d, patch, errors) => (
        <>
          <Field
            id="pf-cover"
            label="Cover image"
            hint="Optional — falls back to the gradient band."
            error={errors.coverImage}
          >
            {() => (
              <ImageUpload
                value={d.coverImage}
                onChange={(coverImage) => patch({ coverImage })}
                label="cover"
              />
            )}
          </Field>

          <Field id="pf-title" label="Title" error={errors.title} required>
            {(f) => (
              <Input
                {...f}
                value={d.title}
                onChange={(e) => patch({ title: e.target.value })}
                placeholder="Nimbus Commerce"
              />
            )}
          </Field>

          <Field
            id="pf-category"
            label="Category"
            hint="Becomes a filter tab on the Work section."
            error={errors.category}
            required
          >
            {(f) => (
              <>
                <Input
                  {...f}
                  list="pf-category-options"
                  value={d.category}
                  onChange={(e) => patch({ category: e.target.value })}
                  placeholder="Web Development"
                />
                <datalist id="pf-category-options">
                  {CATEGORY_SUGGESTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>

          <Field id="pf-desc" label="Description" error={errors.description}>
            {(f) => (
              <Textarea
                {...f}
                rows={3}
                value={d.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            )}
          </Field>

          <Field
            id="pf-tags"
            label="Tags"
            hint="Press Enter after each one."
            error={errors.tags}
          >
            {(f) => (
              <ChipInput
                id={f.id}
                value={d.tags}
                onChange={(tags) => patch({ tags })}
                placeholder="e.g. Next.js"
              />
            )}
          </Field>

          <Field
            id="pf-order"
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
