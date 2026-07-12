"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ICON_NAMES, iconFor } from "@/components/icon-map";

/** Searchable grid of lucide icons. Stores the icon *name* (e.g. "CodeXml"). */
export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [query, setQuery] = React.useState("");

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICON_NAMES;
    return ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  const Selected = iconFor(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-secondary/10 to-accent-cyan/10 text-brand-secondary ring-1 ring-brand-secondary/15 dark:text-blue-400">
          <Selected className="size-4" />
        </span>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value ? `Selected: ${value}` : "Search icons…"}
          aria-label="Search icons"
        />
      </div>

      <div
        role="radiogroup"
        aria-label="Icon"
        className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-lg border border-border/60 p-2 sm:grid-cols-10"
      >
        {matches.map((name) => {
          const Icon = iconFor(name);
          const active = name === value;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={active}
              title={name}
              onClick={() => onChange(name)}
              className={cn(
                "grid aspect-square place-items-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}

        {matches.length === 0 && (
          <p className="col-span-full py-4 text-center text-xs text-muted-foreground">
            No icons match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
