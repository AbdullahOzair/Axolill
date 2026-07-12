"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

/**
 * The publish toggle used in every admin list.
 *
 * A deliberate restyle of the shadcn Switch rather than a new primitive:
 * the default is a flat `--primary` blue with a linear thumb. This one uses
 * the brand gradient when on, gives the thumb a real shadow, and eases it
 * with a spring curve so the flip feels physical.
 */
export function PublishSwitch({
  className,
  ...props
}: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="publish-switch"
      className={cn(
        "group/ps relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 outline-none",
        // Enlarge the hit target without changing the visual size.
        "after:absolute after:-inset-x-2 after:-inset-y-2.5",
        "transition-colors duration-200 ease-out",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        // Off: a quiet, recessed track. On: the brand gradient.
        "data-unchecked:bg-muted data-unchecked:inset-ring-1 data-unchecked:inset-ring-border",
        "data-checked:bg-gradient-to-r data-checked:from-brand-secondary data-checked:to-accent-cyan",
        "data-checked:shadow-[0_0_0_1px_color-mix(in_oklch,var(--brand-secondary)_35%,transparent),0_2px_8px_-2px_color-mix(in_oklch,var(--brand-secondary)_50%,transparent)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="publish-switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white",
          "shadow-[0_1px_2px_0_rgb(2_6_23/0.25),0_1px_3px_0_rgb(2_6_23/0.15)]",
          // Spring-ish overshoot, not a linear slide.
          "transition-transform duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
          "data-unchecked:translate-x-0 data-checked:translate-x-4"
        )}
      />
    </SwitchPrimitive.Root>
  );
}
