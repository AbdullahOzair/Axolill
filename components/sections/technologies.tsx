"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, RefObject } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ScrollReveal } from "@/components/reveal";
import { TechnologyIcon } from "@/components/technology-icon";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { Technology } from "@/lib/data-model";
import { fetchJson, useLoader } from "@/lib/use-api";
import { orbitPosition, orbitRadius, startGalaxyMotion } from "./technology-galaxy-motion";
import styles from "./technologies.module.css";

type Group = { category: string; items: Technology[] };
const RINGS_PER_PAGE = 3;
const NODES_PER_RING = 6;
const MOBILE_NODES_PER_PAGE = 4;
const MOBILE_QUERY = "(width < 48rem)";
const MOBILE_ORBIT = { id: "mobile", x: 35, y: 31, period: 60_000 };
const MOBILE_ANGLES = [
  [0],
  [0, Math.PI],
  [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6],
  [-Math.PI / 4, -3 * Math.PI / 4, 3 * Math.PI / 4, Math.PI / 4],
];

function subscribeToMobile(onChange: () => void) {
  const query = matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getMobileSnapshot = () => matchMedia(MOBILE_QUERY).matches;
const getServerMobileSnapshot = () => false;

function usesLightLogoSurface({ name, iconUrl }: Technology) {
  if (!iconUrl) return false;

  const filename = iconUrl.split(/[?#]/, 1)[0].split("/").at(-1) ?? "";
  if (/(?:^|[._-])(?:white|on[-_]dark|reversed|inverted)(?=[._-]|$)/i.test(filename)) return false;
  if (/(?:^|[._-])(?:black|on[-_]light)(?=[._-]|$)/i.test(filename)) return true;

  const brand = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return /^(?:vercel|express(?:js)?|node(?:js)?|aws|amazonaws|amazonwebservices(?:aws)?|next(?:js)?)$/.test(brand);
}

async function loadTechnologies(): Promise<Technology[]> {
  const { technologies } = await fetchJson<{ technologies: Technology[] }>("/api/technologies");
  return technologies.filter((technology) => technology.published).sort((a, b) => a.order - b.order);
}

export function Technologies() {
  const { data, error, loading, reload } = useLoader(loadTechnologies);

  return (
    <section
      id="technologies"
      aria-labelledby="technologies-heading"
      aria-busy={loading}
      className={styles.section + " scroll-mt-16 font-sans"}
    >
      <div className={styles.layout}>
        <ScrollReveal as="header" effect="text" className={styles.header}>
          <p className={styles.eyebrow}>Our stack</p>
          <h2 id="technologies-heading" className={styles.heading + " font-heading tracking-tight"}>
            Technologies <span>we build with</span>
          </h2>
          <p className={styles.intro}>
            A modern, battle-tested toolkit across the whole stack — chosen for
            speed, reliability, and long-term maintainability.
          </p>
        </ScrollReveal>

        {loading && !data ? (
          <div className={styles.visual} role="status">
            <span className="sr-only">Loading technologies…</span>
            <GalaxyPlaceholder />
            <div className={styles.visualFooter} aria-hidden="true" />
          </div>
        ) : error ? (
          <div className={styles.visual}><ErrorState message={error} onRetry={reload} /></div>
        ) : !data?.length ? (
          <div className={styles.visual}>
            <EmptyState
              title="No technologies published yet"
              description="Technologies added in the admin will appear here once published."
            />
          </div>
        ) : (
          <TechnologyGalaxy technologies={data} />
        )}
      </div>
    </section>
  );
}

function buildPages(groups: Group[]) {
  const pages: Group[][] = [];
  for (let start = 0; start < groups.length; start += RINGS_PER_PAGE) {
    const batch = groups.slice(start, start + RINGS_PER_PAGE);
    const maxCount = Math.max(...batch.map(({ items }) => items.length));
    for (let offset = 0; offset < maxCount; offset += NODES_PER_RING) {
      pages.push(batch
        .map(({ category, items }) => ({ category, items: items.slice(offset, offset + NODES_PER_RING) }))
        .filter(({ items }) => items.length > 0));
    }
  }
  return pages;
}

function TechnologyGalaxy({ technologies }: { technologies: Technology[] }) {
  const isMobile = useSyncExternalStore(subscribeToMobile, getMobileSnapshot, getServerMobileSnapshot);
  const groups = useMemo(() => {
    const byCategory = new Map<string, Technology[]>();
    for (const technology of technologies) {
      const items = byCategory.get(technology.category);
      if (items) items.push(technology);
      else byCategory.set(technology.category, [technology]);
    }
    return Array.from(byCategory, ([category, items]) => ({ category, items }));
  }, [technologies]);
  const allPages = useMemo(() => buildPages(groups), [groups]);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [mobilePage, setMobilePage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [hovered, setHovered] = useState<Technology | null>(null);
  const [focused, setFocused] = useState<Technology | null>(null);
  const [selected, setSelected] = useState<Technology | null>(null);
  const entrance = useRef(false);

  const categoryGroup = groups.find((group) => group.category === category);
  const activeCategory = categoryGroup?.category ?? "";
  const pages = activeCategory
    ? allPages.filter((groups) => groups.some((group) => group.category === activeCategory))
    : allPages;
  const mobileTechnologies = categoryGroup?.items ?? technologies;
  const pageCount = isMobile ? Math.ceil(mobileTechnologies.length / MOBILE_NODES_PER_PAGE) : pages.length;
  const currentPage = Math.min(isMobile ? mobilePage : page, pageCount - 1);
  const pageGroups = isMobile ? [] : pages[currentPage];
  const mobileItems = isMobile
    ? mobileTechnologies.slice(currentPage * MOBILE_NODES_PER_PAGE, (currentPage + 1) * MOBILE_NODES_PER_PAGE)
    : null;
  const displayedItems = mobileItems ?? pageGroups.flatMap(({ items }) => items);
  const displayedIds = new Set(displayedItems.map(({ id }) => id));
  const orbitKey = mobileItems
    ? JSON.stringify(["mobile", mobileItems.map(({ id }) => id)])
    : JSON.stringify(pageGroups.map(({ category, items }) => [category, items.map(({ id }) => id)]));
  const inspecting = [hovered, focused].find((item) => item && displayedIds.has(item.id));
  const active = inspecting ?? (selected && displayedIds.has(selected.id) ? selected : null);
  const currentSelection = active ? technologies.find(({ id }) => id === active.id) : null;
  const categoryTitle = activeCategory || "All technologies";
  const count = categoryGroup?.items.length ?? technologies.length;

  function resetNode() {
    setHovered(null);
    setFocused(null);
    setSelected(null);
  }

  function chooseCategory(value: string) {
    setCategory(value);
    setPage(0);
    setMobilePage(0);
    resetNode();
  }

  function changePage(value: number) {
    if (isMobile) setMobilePage(value);
    else setPage(value);
    resetNode();
  }

  return (
    <>
      <div className={styles.controls}>
        <div className={styles.filters} aria-label="Technology categories" role="group">
          <button type="button" aria-pressed={!activeCategory} onClick={() => chooseCategory("")}>
            All technologies
          </button>
          {groups.map(({ category }) => (
            <button type="button" key={category} aria-pressed={activeCategory === category} onClick={() => chooseCategory(category)}>
              <span className={styles.filterDot} aria-hidden="true" />
              {category}
            </button>
          ))}
        </div>
        <div className={styles.controlRow}>
          <p aria-live="polite" className={styles.count}>
            {categoryTitle} <span>·</span> {count} {count === 1 ? "technology" : "technologies"}
          </p>
          <button
            type="button"
            className={styles.motionToggle}
            aria-label={paused ? "Resume orbital motion" : "Pause orbital motion"}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          </button>
        </div>
        <button
          type="button"
          className={styles.directoryToggle}
          aria-expanded={showDirectory}
          aria-controls="technology-directory"
          onClick={() => setShowDirectory((value) => !value)}
        >
          {showDirectory ? "Hide technology list" : "View all technologies"}
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.visual}>
        <OrbitDisplay
          key={orbitKey}
          groups={pageGroups}
          mobileItems={mobileItems}
          category={activeCategory}
          active={currentSelection}
          pausedCategory={inspecting?.category}
          selectedId={selected?.id}
          paused={paused}
          entrance={entrance}
          onHover={setHovered}
          onFocus={setFocused}
          onSelect={(item) => setSelected((current) => current?.id === item.id ? null : item)}
        />
        <div className={styles.visualFooter}>
          <div className={styles.readout} role="status">
            {currentSelection ? (
              <>
                <strong>{currentSelection.name}</strong>
                <span>{currentSelection.category}</span>
              </>
            ) : (
              <span>Select a logo to explore the stack</span>
            )}
          </div>
          {pageCount > 1 && (
            <div className={styles.pagination} aria-label="Galaxy pages" role="group">
              <button type="button" aria-label="Previous galaxy page" disabled={!currentPage} onClick={() => changePage(currentPage - 1)}>
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <span aria-live="polite">{currentPage + 1} / {pageCount}</span>
              <button type="button" aria-label="Next galaxy page" disabled={currentPage === pageCount - 1} onClick={() => changePage(currentPage + 1)}>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div id="technology-directory" hidden={!showDirectory} className={styles.directory} role="group" aria-label="Technology directory">
        {showDirectory && groups.map(({ category, items }) => (
          <div key={category} className={styles.cluster} data-muted={Boolean(activeCategory && activeCategory !== category)}>
            <h3>{category} <span>{items.length}</span></h3>
            <ul>
              {items.map((technology) => (
                <li key={technology.id}>
                  <TechnologyIcon name={technology.name} iconUrl={technology.iconUrl} className="size-4" />
                  <span>{technology.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

function OrbitDisplay({
  groups, mobileItems, category, active, pausedCategory, selectedId, paused, entrance, onHover, onFocus, onSelect,
}: {
  groups: Group[];
  mobileItems: Technology[] | null;
  category: string;
  active: Technology | null | undefined;
  pausedCategory?: string;
  selectedId?: string;
  paused: boolean;
  entrance: RefObject<boolean>;
  onHover: (item: Technology | null) => void;
  onFocus: (item: Technology | null) => void;
  onSelect: (item: Technology) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) return startGalaxyMotion(ref.current, entrance);
  }, [entrance]);

  function renderNode(item: Technology, muted: boolean, enableHover = true) {
    return (
      <button
        type="button"
        className={styles.node}
        data-muted={muted}
        aria-label={item.name + ", " + item.category}
        aria-pressed={selectedId === item.id}
        onPointerEnter={enableHover ? (event) => { if (event.pointerType === "mouse") onHover(item); } : undefined}
        onPointerLeave={enableHover ? () => onHover(null) : undefined}
        onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) onFocus(item); }}
        onBlur={() => onFocus(null)}
        onClick={() => onSelect(item)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (selectedId === item.id) onSelect(item);
            onFocus(null);
          }
        }}
      >
        <TechnologyIcon
          name={item.name}
          iconUrl={item.iconUrl}
          className={usesLightLogoSurface(item) ? `${styles.nodeIcon} ${styles.nodeIconOnLight}` : styles.nodeIcon}
        />
        {!enableHover && <span className={styles.mobileNodeName} aria-hidden="true">{item.name}</span>}
      </button>
    );
  }

  return (
    <div
      ref={ref}
      className={styles.stage}
      data-paused={paused}
      data-active-ring={pausedCategory ? (mobileItems ? MOBILE_ORBIT.id : pausedCategory) : ""}
    >
      <div className={styles.halo} aria-hidden="true" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.orbits} aria-hidden="true">
        <path className={styles.axes} d="M50 4v92M3 50h94" vectorEffect="non-scaling-stroke" />
        {groups.length === 1 && (
          <g className={styles.orbitGuides}>
            <ellipse cx="50" cy="50" rx="21" ry="21" vectorEffect="non-scaling-stroke" />
            <ellipse cx="50" cy="50" rx="43" ry="43" vectorEffect="non-scaling-stroke" />
          </g>
        )}
        {groups.map(({ category: name }, index) => (
          <ellipse
            key={name}
            className={styles.orbit}
            data-tone={index}
            data-highlight={Boolean(name === (active?.category || category))}
            data-muted={Boolean(category && name !== category && name !== active?.category)}
            cx="50" cy="50"
            rx={orbitRadius(index, groups.length)} ry={orbitRadius(index, groups.length)}
            pathLength="1"
            vectorEffect="non-scaling-stroke"
            style={{ "--ring-delay": 70 * index + "ms" } as CSSProperties}
          />
        ))}
      </svg>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.mobileOrbits} aria-hidden="true">
        <ellipse cx="50" cy="50" rx={MOBILE_ORBIT.x} ry={MOBILE_ORBIT.y} className={styles.orbit} vectorEffect="non-scaling-stroke" />
      </svg>
      <GalaxyHub />
      <div className={styles.desktopNodes} role="group" aria-label="Technology orbits">
        {groups.map(({ category: name, items }, ring) => {
          const radius = orbitRadius(ring, groups.length);
          return (
            <div key={name} data-galaxy-ring={name} data-radius={radius} data-tone={ring}>
              {items.map((item, index) => {
                const angle = (index / items.length + 0.13 + ring * 0.08) * Math.PI * 2;
                const [x, y] = orbitPosition(radius, angle);
                const muted = (category && name !== category) || (active && active.category !== name);
                return (
                  <div
                    key={item.id}
                    className={styles.nodeAnchor}
                    data-emphasized={active?.id === item.id}
                    data-angle={angle}
                    data-delay={(ring * 3 + index) * 32 + 105}
                    style={{ left: 50 + x + "%", top: 50 + y + "%" }}
                  >
                    {renderNode(item, Boolean(muted && active?.id !== item.id))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div
        className={styles.mobileNodes}
        role="group"
        aria-label="Technology constellation"
        data-galaxy-ring={mobileItems ? MOBILE_ORBIT.id : undefined}
        data-radius={MOBILE_ORBIT.x}
        data-radius-y={MOBILE_ORBIT.y}
        data-orbit-period={MOBILE_ORBIT.period}
      >
        {mobileItems?.map((item, index) => {
          const angle = MOBILE_ANGLES[mobileItems.length - 1][index];
          const [x, y] = orbitPosition(MOBILE_ORBIT.x, angle, MOBILE_ORBIT.y);
          return (
            <div
              key={item.id}
              className={styles.nodeAnchor}
              data-emphasized={active?.id === item.id}
              data-angle={angle}
              data-delay={105 + index * 48}
              style={{ left: 50 + x + "%", top: 50 + y + "%" }}
            >
              {renderNode(item, false, false)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GalaxyHub() {
  return (
    <div className={styles.hubAnchor}>
      <div className={styles.hub} role="img" aria-label="Axonill">
        <BrandMark size={48} />
      </div>
    </div>
  );
}

function GalaxyPlaceholder() {
  return (
    <div className={styles.stage} aria-hidden="true">
      <div className={styles.halo} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.orbits}>
        <ellipse cx="50" cy="50" rx="32" ry="32" className={styles.orbit} vectorEffect="non-scaling-stroke" />
      </svg>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.mobileOrbits}>
        <ellipse cx="50" cy="50" rx={MOBILE_ORBIT.x} ry={MOBILE_ORBIT.y} className={styles.orbit} vectorEffect="non-scaling-stroke" />
      </svg>
      <GalaxyHub />
    </div>
  );
}
