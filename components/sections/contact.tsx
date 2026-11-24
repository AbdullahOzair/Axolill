import { ArrowUpRight } from "lucide-react";
import { connection } from "next/server";

import { CreativeOrbit } from "@/components/sections/creative-orbit";
import { buttonVariants } from "@/components/ui/button";
import { readCreativeOrbit } from "@/lib/creative-orbit-server";
import { securityEvent } from "@/lib/http-security";
import layout from "@/components/site-layout.module.css";
import styles from "./contact.module.css";

export async function Contact() {
  await connection();
  const data = await readCreativeOrbit().catch(() => {
    securityEvent("creative_orbit_read_failed", {});
    return null;
  });

  return (
    <section id="contact" aria-labelledby="contact-heading" className={`${layout.section} ${styles.section} scroll-mt-16 font-sans`}>
      <div className={layout.content}>
        {data && <CreativeOrbit {...data} />}

        <header className={styles.closing}>
          <p className={`${layout.eyebrow} ${styles.eyebrow}`}>LET&apos;S CONNECT</p>
          <h2 id="contact-heading" className={`${layout.title} font-heading font-bold`}>
            Let&apos;s discuss <span className={styles.accent}>your project.</span>
          </h2>
          <p className={layout.intro}>
            Tell us what you have in mind, and let&apos;s explore how we can bring it to life.
          </p>
          <a href="#work-with-us" className={buttonVariants({ size: "lg", className: styles.cta })}>
            Start a conversation <ArrowUpRight aria-hidden="true" />
          </a>
        </header>

      </div>
    </section>
  );
}
