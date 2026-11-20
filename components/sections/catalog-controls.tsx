import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

type Filter = {
  label: string;
  allLabel: string;
  categories: string[];
  selected: string | null;
  onChange: (category: string | null) => void;
};

export function CatalogControls({ filter, label, page, pageCount, onPageChange }: {
  filter?: Filter;
  label: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (!filter && pageCount <= 1) return null;

  const pageButton = "grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-[var(--chart-1)] focus-visible:outline-2 focus-visible:outline-ring aria-disabled:cursor-default aria-disabled:opacity-45 aria-disabled:hover:border-border motion-reduce:transition-none";

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      {filter && (
        <div className="relative min-w-0 max-w-full">
          <select
            aria-label={filter.label}
            value={filter.selected ?? ""}
            onChange={(event) => filter.onChange(event.target.value || null)}
            className="h-9 max-w-full min-w-0 cursor-pointer appearance-none truncate rounded-lg border border-border bg-card pr-8 pl-2.5 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="">{filter.allLabel}</option>
            {filter.categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <ChevronDown aria-hidden size={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      )}
      {pageCount > 1 && (
        <nav aria-label={label} className="ml-auto flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous page"
            aria-disabled={page === 0}
            onClick={() => { if (page > 0) onPageChange(page - 1); }}
            className={pageButton}
          >
            <ChevronLeft aria-hidden size={17} />
          </button>
          <span role="status" className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{page + 1} of {pageCount}</span>
          <button
            type="button"
            aria-label="Next page"
            aria-disabled={page >= pageCount - 1}
            onClick={() => { if (page < pageCount - 1) onPageChange(page + 1); }}
            className={pageButton}
          >
            <ChevronRight aria-hidden size={17} />
          </button>
        </nav>
      )}
    </div>
  );
}
