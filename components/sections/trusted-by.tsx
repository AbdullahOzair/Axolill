import { ScrollReveal } from "@/components/reveal";
import layout from "@/components/site-layout.module.css";

const CLIENTS = [
  "Nimbus",
  "Vertex",
  "Quanta",
  "Northwind",
  "Lumen",
  "Orbit",
  "Halcyon",
  "Meridian",
];

function Wordmark({ name }: { name: string }) {
  return (
    <span className="font-heading text-xl font-semibold tracking-tight text-muted-foreground transition-colors duration-300 hover:text-foreground sm:text-2xl">
      {name}
    </span>
  );
}

export function TrustedBy() {
  return (
    <section
      aria-label="Trusted by"
      className="border-y border-border/60 bg-background py-5 md:py-6"
    >
      <ScrollReveal effect="text" className={layout.content}>
        <p className={`${layout.eyebrow} mb-4 text-center font-medium tracking-wider text-muted-foreground uppercase`}>
          Trusted by teams building the future
        </p>
      </ScrollReveal>

      {/* group enables pause-on-hover; edges fade via mask */}
      <div className={`${layout.content} group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] motion-reduce:[mask-image:none]`}>
        <div className="flex w-max animate-marquee items-center gap-16 pr-16 group-hover:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none motion-reduce:pr-0">
          {/* Two identical copies for a seamless -50% loop */}
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className={copy === 1
                ? "flex shrink-0 items-center gap-16 pr-16 motion-reduce:hidden"
                : "flex shrink-0 items-center gap-16 pr-16 motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-x-6 motion-reduce:gap-y-3 motion-reduce:px-4"}
              aria-hidden={copy === 1}
            >
              {CLIENTS.map((name) => (
                <Wordmark key={`${copy}-${name}`} name={name} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
