"use client";

import Image from "next/image";
import { ArrowLeft, Globe, Rotate3d } from "lucide-react";
import { useId, useRef, useState, type CSSProperties } from "react";

import { LinkedinIcon } from "@/components/brand-icons";
import { ScrollReveal } from "@/components/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import type { TeamMember } from "@/lib/data-model";
import { teamProfileUrl } from "@/lib/team-links";
import { fetchJson, useLoader } from "@/lib/use-api";
import layout from "@/components/site-layout.module.css";
import styles from "./team.module.css";

async function loadTeam(): Promise<TeamMember[]> {
  const { team } = await fetchJson<{ team: TeamMember[] }>("/api/team");
  return team.filter((member) => member.published);
}

export function Team() {
  const { data, error, loading, reload } = useLoader<TeamMember[]>(loadTeam);

  return (
    <section id="team" aria-labelledby="team-heading" aria-busy={loading} className={`${styles.section} ${layout.section} scroll-mt-16 font-sans`}>
      <div className={layout.content}>
        <ScrollReveal as="header" effect="up" className={layout.header}>
          <p className={`${styles.eyebrow} ${layout.eyebrow}`}>Meet the team</p>
          <h2 id="team-heading" className={`${layout.title} ${layout.stackedTitle} font-heading font-bold`}>
            Different minds. <span className={styles.accent}>One shared vision.</span>
          </h2>
          <p className={layout.intro}>
            Bringing together creativity, technology, and insight to turn ambitious ideas into meaningful digital experiences.
          </p>
        </ScrollReveal>

        {loading && !data ? (
          <div className={styles.grid} aria-hidden>
            {Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className={styles.placeholder} />)}
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} className={styles.state} />
        ) : !data?.length ? (
          <EmptyState title="No team members published yet" description="Team profiles will appear here once published." className={styles.state} />
        ) : (
          <ul className={styles.grid}>
            {data.map((member, index) => (
              <ScrollReveal as="li" key={member.id} className={styles.entry} style={{ "--team-delay": `${(index % 3) * 120}ms` } as CSSProperties}>
                <TeamCard member={member} />
              </ScrollReveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TeamCard({ member }: { member: TeamMember }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [backFocused, setBackFocused] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const control = useRef<HTMLButtonElement>(null);
  const detailsId = useId();
  const flipped = pinned || (!dismissed && (hovered || backFocused));
  const linkedin = teamProfileUrl(member.linkedinUrl);
  const portfolio = teamProfileUrl(member.portfolioUrl);
  const hasDetails = Boolean(member.bio || member.skills.length);
  const initials = member.name.trim().split(/\s+/).slice(0, 2)
    .map((part) => Array.from(part)[0]).join("").toUpperCase();

  function showFront() {
    control.current?.focus({ preventScroll: true });
    setPinned(false);
    setBackFocused(false);
    setDismissed(hovered);
  }

  return (
    <article
      className={styles.shell}
      data-flipped={flipped}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && matchMedia("(any-hover: hover) and (any-pointer: fine)").matches) {
          setHovered(true);
        }
      }}
      onPointerLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && flipped) {
          event.stopPropagation();
          showFront();
        }
      }}
    >
      <button
        type="button"
        ref={control}
        aria-controls={detailsId}
        aria-expanded={flipped}
        aria-label={flipped ? `Return to ${member.name}’s photo` : `Read about ${member.name}`}
        className={styles.toggle}
        onClick={flipped ? showFront : () => setPinned(true)}
      >
        <span className={styles.indicator}>
          {flipped ? <ArrowLeft aria-hidden size={17} /> : <Rotate3d aria-hidden size={17} />}
        </span>
      </button>
      <div className={styles.lift}>
        <div className={styles.rotor}>
          <div className={styles.edge} data-edge="left" aria-hidden />
          <div className={styles.edge} data-edge="right" aria-hidden />
          <div className={styles.edge} data-edge="top" aria-hidden />
          <div className={styles.edge} data-edge="bottom" aria-hidden />

          <div className={`${styles.face} ${styles.front}`} inert={flipped}>
            <div className={styles.portrait}>
              <span aria-hidden className={styles.initials + " brand-action font-heading"}>{initials}</span>
              {member.photoUrl && member.photoUrl !== failedPhoto && (
                <Image
                  src={`/api/media/${member.photoUrl}`}
                  alt=""
                  fill
                  unoptimized
                  onError={() => setFailedPhoto(member.photoUrl)}
                />
              )}
            </div>
            <div className={styles.identity}>
              <h3 className={styles.name + " font-heading"}>{member.name}</h3>
              <p className={styles.role}>{member.role}</p>
            </div>
          </div>

          <div
            id={detailsId}
            className={`${styles.face} ${styles.back}`}
            inert={!flipped}
            onFocus={() => setBackFocused(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setBackFocused(false);
            }}
          >
            <div
              className={styles.details}
              tabIndex={hasDetails ? 0 : undefined}
              role={hasDetails ? "region" : undefined}
              aria-label={hasDetails ? `Profile of ${member.name}` : undefined}
            >
              <div className={styles.backIdentity}>
                <h3 className={styles.name + " font-heading"}>{member.name}</h3>
                <p className={styles.role}>{member.role}</p>
              </div>
              {member.bio && <p className={styles.bio}>{member.bio}</p>}
              {member.skills.length > 0 && (
                <div className={styles.expertise}>
                  <h4>Expertise</h4>
                  <ul>
                    {member.skills.map((skill, index) => <li key={index}>{skill}</li>)}
                  </ul>
                </div>
              )}
            </div>
            {(linkedin || portfolio) && (
              <div className={styles.links}>
                {linkedin && (
                  <a href={linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on LinkedIn (opens in a new tab)`}>
                    <LinkedinIcon aria-hidden width={17} height={17} />
                  </a>
                )}
                {portfolio && (
                  <a href={portfolio} target="_blank" rel="noopener noreferrer" aria-label={`${member.name}’s portfolio (opens in a new tab)`}>
                    <Globe aria-hidden size={17} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
