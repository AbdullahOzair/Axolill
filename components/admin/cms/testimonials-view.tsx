"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Testimonial } from "@/lib/data-model";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CmsManager } from "@/components/admin/cms/cms-manager";
import { Field, type FieldErrors } from "@/components/admin/form-dialog";

type Draft = {
  name: string;
  role: string;
  quote: string;
  rating: number;
  published: boolean;
};

const EMPTY: Draft = {
  name: "",
  role: "",
  quote: "",
  rating: 5,
  published: false,
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          )}
        />
      ))}
    </span>
  );
}

export function TestimonialsView() {
  return (
    <CmsManager<Testimonial, Draft>
      title="Testimonials"
      description="Quotes shown in the homepage carousel."
      endpoint="/api/testimonials"
      listKey="testimonials"
      addLabel="Add testimonial"
      emptyDraft={EMPTY}
      // `testimonial` has no order column.
      orderable={false}
      labelOf={(t) => t.name}
      toDraft={(t) => ({
        name: t.name,
        role: t.role ?? "",
        quote: t.quote,
        rating: t.rating,
        published: t.published,
      })}
      validate={(d) => {
        const e: FieldErrors = {};
        if (!d.name.trim()) e.name = "Name is required.";
        if (!d.quote.trim()) e.quote = "Add the quote itself.";
        return e;
      }}
      columns={[
        {
          header: "Name",
          cell: (t) => (
            <div>
              <span className="font-medium">{t.name}</span>
              {t.role && (
                <span className="block text-xs text-muted-foreground">
                  {t.role}
                </span>
              )}
            </div>
          ),
        },
        {
          header: "Quote",
          cell: (t) => (
            <span className="line-clamp-1 max-w-md text-muted-foreground">
              “{t.quote}”
            </span>
          ),
        },
        {
          header: "Rating",
          className: "w-32",
          cell: (t) => <Stars rating={t.rating} />,
        },
      ]}
      renderForm={(d, patch, errors) => (
        <>
          <Field id="ts-name" label="Name" error={errors.name} required>
            {(f) => (
              <Input
                {...f}
                value={d.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Sarah Chen"
              />
            )}
          </Field>

          <Field
            id="ts-role"
            label="Role"
            hint="Job title and company, shown under the name."
            error={errors.role}
          >
            {(f) => (
              <Input
                {...f}
                value={d.role}
                onChange={(e) => patch({ role: e.target.value })}
                placeholder="CTO, Nimbus Commerce"
              />
            )}
          </Field>

          <Field id="ts-quote" label="Quote" error={errors.quote} required>
            {(f) => (
              <Textarea
                {...f}
                rows={4}
                value={d.quote}
                onChange={(e) => patch({ quote: e.target.value })}
                placeholder="They shipped in six weeks what our last agency couldn't in six months."
              />
            )}
          </Field>

          <Field
            id="ts-rating"
            label="Rating"
            hint="1 to 5 stars."
            error={errors.rating}
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={1}
                max={5}
                value={d.rating}
                onChange={(e) =>
                  patch({
                    rating: Math.min(
                      5,
                      Math.max(1, Number(e.target.value) || 5)
                    ),
                  })
                }
              />
            )}
          </Field>
        </>
      )}
    />
  );
}
