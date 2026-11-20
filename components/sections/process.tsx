"use client";

import * as React from "react";
import {
  Compass,
  Search,
  PenTool,
  Code2,
  FlaskConical,
  Rocket,
  LifeBuoy,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
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

export function Process() {
  const [active, setActive] = React.useState(0);
  const tablist = React.useRef<HTMLDivElement>(null);
  const id = React.useId();

  function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        next = (index + STEPS.length - 1) % STEPS.length;
        break;
      case "ArrowRight":
      case "ArrowDown":
        next = (index + 1) % STEPS.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = STEPS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActive(next);
    tablist.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  }

  return (
    <section id="process" aria-labelledby={`${id}-heading`} className={`${styles.section} scroll-mt-16 py-14 font-sans sm:py-18`}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <p className={styles.eyebrow}>How we work</p>
          <h2 id={`${id}-heading`} className="mt-3 font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            A development process <span className={styles.accent}>built for clarity</span>
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
            Seven deliberate steps take your product from a first conversation
            all the way to a scaling, supported release.
          </p>
        </header>

        <div className={styles.workbench}>
          <div ref={tablist} role="tablist" aria-label="Development stages" aria-orientation="vertical" className={styles.tabs}>
            {STEPS.map(({ name, icon: Icon }, index) => (
              <button
                key={name}
                type="button"
                role="tab"
                id={`${id}-tab-${index}`}
                aria-controls={`${id}-stage-${index}`}
                aria-selected={index === active}
                tabIndex={index === active ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => moveFocus(event, index)}
                className={styles.tab}
              >
                <Icon aria-hidden className={styles.tabIcon} />
                <span>{name}</span>
              </button>
            ))}
          </div>

          <div className={styles.frame}>
            {STEPS.map(({ name, description, icon: Icon }, index) => (
              <div
                key={name}
                role="tabpanel"
                id={`${id}-stage-${index}`}
                aria-labelledby={`${id}-tab-${index}`}
                hidden={index !== active}
                tabIndex={0}
                className={styles.panel}
              >
                <div className={styles.panelCopy}>
                  <p className={styles.stageCount}>Stage {index + 1} of {STEPS.length}</p>
                  <h3 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h3>
                  <p className={styles.description}>{description}</p>
                </div>
                <div aria-hidden="true" className={styles.artwork}>
                  <div className={styles.orbit}>
                    <span className={styles.orbitNode} />
                    <span className={styles.orbitCore}><Icon className={styles.orbitIcon} /></span>
                  </div>
                </div>
              </div>
            ))}

            <div className={styles.controls}>
              <span role="status" className="sr-only">Stage {active + 1} of {STEPS.length}: {STEPS[active].name}</span>
              <div aria-hidden="true" className={styles.progress}>
                {STEPS.map(({ name }, index) => <span key={name} data-reached={index <= active} />)}
              </div>
              <div className={styles.actions}>
                <button type="button" aria-label="Previous stage" disabled={active === 0} onClick={() => setActive(active - 1)}>
                  <ArrowLeft aria-hidden size={17} />
                </button>
                <button type="button" aria-label="Next stage" disabled={active === STEPS.length - 1} onClick={() => setActive(active + 1)}>
                  <ArrowRight aria-hidden size={17} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
