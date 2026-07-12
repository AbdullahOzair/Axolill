import Link from "next/link";
import { Mail } from "lucide-react";
import {
  FacebookIcon,
  GithubIcon,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
} from "@/components/brand-icons";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const QUICK_LINKS = [
  { label: "Process", href: "#process" },
  { label: "Work", href: "#work" },
  { label: "Team", href: "#team" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const SERVICES = [
  { label: "Product Strategy", href: "#services" },
  { label: "UX/UI Design", href: "#services" },
  { label: "Web Development", href: "#services" },
  { label: "Mobile Apps", href: "#services" },
  { label: "Branding", href: "#services" },
];

const RESOURCES = [
  { label: "Blog", href: "#" },
  { label: "Case Studies", href: "#work" },
  { label: "Documentation", href: "#" },
  { label: "Support", href: "#contact" },
  { label: "Privacy Policy", href: "#" },
];

const SOCIALS = [
  { label: "GitHub", href: "https://github.com/Axonill", icon: GithubIcon },
  { label: "LinkedIn", href: "https://linkedin.com/company/YOUR_HANDLE", icon: LinkedinIcon },
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61591623881782", icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/info.axonill/?hl=en", icon: InstagramIcon },
  { label: "Twitter", href: "https://twitter.com/YOUR_HANDLE", icon: TwitterIcon },
  { label: "Email", href: "mailto:info@axonill.com", icon: Mail },
];

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {label}
      </Link>
    </li>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <FooterLink key={link.label} {...link} />
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand + newsletter — spans wider on large screens */}
          <div className="col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label="Axonill home"
              className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <BrandMark size={36} interactive />
              <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
                Axonill
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Innovating Digital Experiences.
            </p>
          </div>

          <FooterColumn title="Quick Links" links={QUICK_LINKS} />
          <FooterColumn title="Services" links={SERVICES} />
          <FooterColumn title="Resources" links={RESOURCES} />

          {/* Social Media column */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-sm font-semibold text-foreground">
              Social Media
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors outline-none hover:border-brand-secondary/40 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <Icon className="size-4" />
                </Link>
              ))}
            </div>

            {/* Newsletter */}
            <p className="mt-6 text-sm font-medium text-foreground">
              Stay in the loop
            </p>
            <form
              className="mt-3 flex gap-2"
              // Placeholder — no submission wired up yet.
              action="#"
            >
              <Input
                type="email"
                required
                placeholder="you@company.com"
                aria-label="Email address"
                className="h-9"
              />
              <Button type="submit" size="lg" className="shrink-0">
                Subscribe
              </Button>
            </form>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Axonill. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="rounded-sm text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Terms
            </Link>
            <Link
              href="#"
              className="rounded-sm text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
