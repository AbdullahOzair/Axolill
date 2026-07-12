import { Construction } from "lucide-react";

/**
 * Honest stand-in for admin sections whose UI isn't built yet. The sidebar,
 * guard, and (for the CMS sections) the D1 tables all exist — only the screen
 * is missing.
 */
export function SectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>

      <section className="rounded-2xl border border-dashed border-border bg-background/40 p-12 text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground">
          <Construction className="size-5" />
        </span>
        <h2 className="mt-4 font-heading text-lg font-semibold">
          Not built yet
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          The navigation, route guard, and database table for {title} are in
          place — this screen just needs to be filled in.
        </p>
      </section>
    </div>
  );
}
