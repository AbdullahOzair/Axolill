"use client";

import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

import styles from "./footer.module.css";

const ADDRESS = "Midway Centrum, 6th Road, Rawalpindi, Pakistan";
const DIRECTIONS = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`;
const MAP_EMBED = "https://www.google.com/maps?q=33.6415941%2C73.0763461&z=16&output=embed";

export function FooterDirections() {
  if (usePathname() !== "/") return null;

  return (
    <li>
      <a href={DIRECTIONS} target="_blank" rel="noopener noreferrer" className={styles.directions}>
        Get directions <ArrowUpRight aria-hidden="true" />
      </a>
    </li>
  );
}

export function FooterLocation() {
  if (usePathname() !== "/") return null;

  return (
    <div className={styles.location}>
      <h2 className={styles.groupHeading}>Location</h2>
      <div className={styles.mapFrame}>
        <iframe
          className={styles.map}
          title="Google Maps location of Axonill Studio at Midway Centrum, Rawalpindi"
          src={MAP_EMBED}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <address>{ADDRESS}</address>
    </div>
  );
}
