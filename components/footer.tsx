import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";

import { FacebookIcon, GithubIcon, InstagramIcon } from "@/components/brand-icons";
import { BrandMark } from "@/components/brand-mark";
import { FooterDirections, FooterLocation } from "@/components/footer-location";
import layout from "@/components/site-layout.module.css";
import styles from "./footer.module.css";

const EXPLORE = [
  { label: "Services", href: "/#services" },
  { label: "Process", href: "/#process" },
  { label: "Our Work", href: "/#work" },
  { label: "Team", href: "/#team" },
  { label: "Work With Us", href: "/#work-with-us" },
  { label: "FAQ", href: "/#faq" },
];

const EMAIL = "info.axonill@gmail.com";
const WHATSAPP_URL = "https://wa.me/923288811677";

const SOCIALS = [
  { label: "GitHub", href: "https://github.com/Axonill", icon: GithubIcon },
  { label: "Facebook", href: "https://www.facebook.com/people/Axonill/61591623881782/", icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/info.axonill/", icon: InstagramIcon },
];

export function Footer() {
  return (
    <footer className={`${styles.footer} font-sans`}>
      <div className={`${layout.content} ${styles.content}`}>
        <div className={styles.main}>
          <div className={styles.brand}>
            <div className={styles.watermark} aria-hidden="true" />
            <Link href="/" className={styles.brandLink}>
              <BrandMark size={32} />
              <span className="font-heading">Axonill</span>
            </Link>
            <p>Innovating Digital Experiences.</p>
            <ul className={styles.socials} aria-label="Social media">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <li key={label}>
                  <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon aria-hidden="true" /></a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-labelledby="footer-explore">
            <h2 id="footer-explore" className={styles.groupHeading}>Explore</h2>
            <ul className={styles.explore}>
              {EXPLORE.map(({ label, href }) => (
                <li key={href}><Link href={href}>{label}</Link></li>
              ))}
            </ul>
          </nav>

          <div className={styles.connect}>
            <h2 className={styles.groupHeading}>Connect</h2>
            <ul className={styles.contacts}>
              <li>
                <a href={`mailto:${EMAIL}`}><Mail aria-hidden="true" /><span>{EMAIL}</span></a>
              </li>
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />WhatsApp</a>
              </li>
              <FooterDirections />
            </ul>
          </div>
          <FooterLocation />
        </div>

        <p className={styles.copyright}>&copy; {new Date().getFullYear()} Axonill. All rights reserved.</p>
      </div>
    </footer>
  );
}
