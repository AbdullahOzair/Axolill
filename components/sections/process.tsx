"use client";

import { ScrollReveal } from "@/components/reveal";
import * as React from "react";
import {
  Compass,
  Search,
  PenTool,
  Code2,
  FlaskConical,
  Rocket,
  LifeBuoy,
  ArrowDown,
} from "lucide-react";
import { mountProcessOrbit, ORBIT_PATH } from "./process-orbit";
import layout from "@/components/site-layout.module.css";
import styles from "./process.module.css";

type Step = {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

// Mirrors the Project.stage enum in DATA_MODEL.md
const STEPS: Step[] = [
  {
    name: "Discover",
    description:
      "We dig into your goals, users, and constraints to frame the real problem.",
    icon: Compass,
  },
  {
    name: "Research",
    description:
      "Market, competitor, and technical research that de-risks the roadmap.",
    icon: Search,
  },
  {
    name: "Design",
    description:
      "Wireframes to polished UI and a design system your product can grow into.",
    icon: PenTool,
  },
  {
    name: "Develop",
    description:
      "Clean, tested, scalable code shipped in tight, visible increments.",
    icon: Code2,
  },
  {
    name: "Test",
    description:
      "Automated and manual QA across devices to catch issues before users do.",
    icon: FlaskConical,
  },
  {
    name: "Deploy",
    description:
      "Smooth, automated releases to production with zero-drama rollouts.",
    icon: Rocket,
  },
  {
    name: "Support",
    description:
      "Monitoring, iteration, and ongoing support to keep you scaling.",
    icon: LifeBuoy,
  },
];

const GEAR_OUTLINE = Array.from({ length: 20 }, (_, tooth) =>
  [0, 0.22, 0.62, 0.8].map((offset, index) => {
    const angle = (tooth + offset) * Math.PI / 10;
    const radius = index === 1 || index === 2 ? 46 : 40;
    return `${(50 + Math.cos(angle) * radius).toFixed(2)},${(50 + Math.sin(angle) * radius).toFixed(2)}`;
  }),
).flat().join(" ");

function Gear({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" aria-hidden="true">
      <polygon points={GEAR_OUTLINE} strokeWidth="0.65" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="34.5" strokeWidth="0.45" />
      <circle cx="50" cy="50" r="16" strokeWidth="0.65" />
      <circle cx="50" cy="50" r="9" strokeWidth="0.5" />
      <path d="M50 15.5v18.5m34.5 16H66M50 84.5V66M15.5 50H34" strokeWidth="0.45" />
      <path d="m25.5 25.5 13.2 13.2m35.8 35.8L61.3 61.3m13.2-35.8L61.3 38.7M25.5 74.5l13.2-13.2" strokeWidth="0.45" />
    </svg>
  );
}

export function Process() {
  const track = React.useRef<HTMLDivElement>(null);
  const stage = React.useRef<HTMLDivElement>(null);
  const orbit = React.useRef<ReturnType<typeof mountProcessOrbit> | undefined>(undefined);
  const [active, setActive] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!track.current || !stage.current) return;
    const animation = mountProcessOrbit(track.current, stage.current, setExpanded, setActive);
    orbit.current = animation;
    return () => {
      orbit.current = undefined;
      animation.dispose();
    };
  }, []);

  return (
    <section id="process" aria-labelledby="process-heading" className={`${styles.section} ${layout.section} scroll-mt-16 font-sans`}>
      <div className={styles.gears} aria-hidden="true">
        <div className={styles.gearField} data-process-gears>
          <Gear className={styles.gearOne} />
          <Gear className={styles.gearTwo} />
          <Gear className={styles.gearThree} />
        </div>
      </div>
      <div className={layout.content}>
        <ScrollReveal as="header" effect="text" className={layout.header}>
          <p className={`${styles.eyebrow} ${layout.eyebrow}`}>How we work</p>
          <h2 id="process-heading" className={`${layout.title} mt-3 font-heading font-semibold`}>
            A development process <span className={styles.accent}>built for clarity</span>
          </h2>
          <p className={layout.intro}>
            Seven deliberate steps take your product from a first conversation
            all the way to a scaling, supported release.
          </p>
        </ScrollReveal>

        <div ref={track} className={styles.track} data-process-track>
          <div ref={stage} className={styles.stage} data-process-stage data-active={active}>
            <div className={styles.diagram} data-process-diagram aria-hidden="true">
              <svg viewBox="0 0 600 280" preserveAspectRatio="none" className={styles.path}>
                <defs>
                  <linearGradient id="process-brand-path">
                    <stop offset="0%" stopColor="var(--brand-purple)" />
                    <stop offset="48%" stopColor="var(--brand-magenta)" />
                    <stop offset="100%" stopColor="var(--brand-cyan)" />
                  </linearGradient>
                </defs>
                <path d={ORBIT_PATH} className={styles.pathBase} />
                <path d={ORBIT_PATH} pathLength={1} stroke="url(#process-brand-path)" data-process-progress className={styles.pathProgress} />
              </svg>
            </div>
            <div
              data-process-hub
              tabIndex={-1}
              className={styles.hub}
            >
              <span>Process</span>
              <ArrowDown aria-hidden size={15} />
            </div>

            <ol aria-label="Development stages" className={styles.nodes} inert={!expanded}>
              {STEPS.map(({ name, icon: Icon }, index) => (
                <li key={name} className={styles.node} data-process-node>
                  <button
                    type="button"
                    aria-label={`Stage ${index + 1}: ${name}`}
                    aria-current={index === active ? "step" : undefined}
                    aria-controls="process-detail"
                    className={styles.nodeButton}
                    onClick={() => orbit.current?.choose(index)}
                  >
                    <Icon aria-hidden className={styles.nodeIcon} />
                  </button>
                  <span className={styles.nodeLabel} aria-hidden="true">{name}</span>
                </li>
              ))}
            </ol>

            <div id="process-detail" className={styles.detail} inert={!expanded}>
              <div aria-live="polite" aria-atomic="true">
                <div key={active} className={styles.detailContent}>
                  <p className={styles.detailCount}>Stage {active + 1} of {STEPS.length}</p>
                  <h3 className={styles.detailTitle}>{STEPS[active].name}</h3>
                  <p className={styles.description}>{STEPS[active].description}</p>
                </div>
              </div>
              <p className={styles.scrollHint}>
                <ArrowDown aria-hidden size={13} />
                <span>Scroll to explore</span>
              </p>
            </div>
          </div>
        </div>

        <ol className={styles.staticList} aria-label="Development stages">
          {STEPS.map(({ name, description, icon: Icon }) => (
            <li key={name}>
              <Icon aria-hidden className={styles.nodeIcon} />
              <div>
                <h3 className="font-heading text-base font-semibold">{name}</h3>
                <p className={styles.description}>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
