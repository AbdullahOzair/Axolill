"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Repeatable list input — used for Service.items, PortfolioItem.tags and
 * TeamMember.skills. Enter (or the + button) adds; Backspace on an empty field
 * removes the last chip.
 */
export function ChipInput({
  id,
  value,
  onChange,
  placeholder = "Type and press Enter",
  max = 12,
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [draft, setDraft] = React.useState("");
  const full = value.length >= max;

  function add() {
    const next = draft.trim();
    if (!next || full) return;
    if (value.includes(next)) {
      setDraft("");
      return; // no duplicates
    }
    onChange([...value, next]);
    setDraft("");
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          disabled={full}
          placeholder={full ? `Maximum ${max} reached` : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Don't submit the surrounding form.
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !draft && value.length) {
              removeAt(value.length - 1);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={full || !draft.trim()}
          onClick={add}
          aria-label="Add"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((chip, i) => (
            <li key={chip}>
              <Badge
                variant="secondary"
                className={cn(
                  "gap-1 rounded-full border border-border/60 bg-secondary/60 py-1 pr-1 pl-2.5",
                  "text-xs font-medium"
                )}
              >
                {chip}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${chip}`}
                  className="grid size-4 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
