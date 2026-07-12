import { Reveal } from "@/components/reveal";

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
      className="border-y border-border/60 bg-background py-12"
    >
      <Reveal>
        <p className="mb-8 text-center text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Trusted by teams building the future
        </p>
      </Reveal>

      {/* group enables pause-on-hover; edges fade via mask */}
      <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="flex w-max animate-marquee items-center gap-16 pr-16 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {/* Two identical copies for a seamless -50% loop */}
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex shrink-0 items-center gap-16 pr-16"
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
