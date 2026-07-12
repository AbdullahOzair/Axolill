"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileAuth, UserMenu } from "@/components/user-menu";
import { MagneticButton } from "@/components/magnetic-button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Services", href: "#services" },
  { label: "Process", href: "#process" },
  { label: "Work", href: "#work" },
  { label: "Team", href: "#team" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

/**
 * After a cross-route navigation to "/#section" the browser fires its native
 * hash scroll, but Next.js can race it during hydration. This hook re-fires
 * the scroll one animation frame after mount so the target is always reached.
 * Only active while the current pathname is "/".
 */
function useHashScroll() {
  const pathname = usePathname();
  React.useEffect(() => {
    if (pathname !== "/") return;
    const hash = window.location.hash;
    if (!hash) return;
    const id = hash.slice(1); // strip the leading "#"
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
}

/**
 * Returns a click-handler for a hash anchor.
 *   - On "/": smooth-scrolls in-place and cancels the navigation event.
 *   - Elsewhere: no-op — the <Link href="/#section"> handles navigation.
 */
function useSectionClick(hash: string, afterClick?: () => void) {
  const pathname = usePathname();
  return React.useCallback(
    (e: React.MouseEvent) => {
      if (pathname === "/") {
        e.preventDefault();
        const id = hash.replace(/^#/, "");
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }
      afterClick?.();
    },
    [pathname, hash, afterClick]
  );
}

/* ─────────────────────────── sub-components ────────────────────── */

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="Axonill home"
      className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <BrandMark size={36} priority interactive />
      <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
        Axonill
      </span>
    </Link>
  );
}

function DesktopNavLink({ label, href }: { label: string; href: string }) {
  const pathname = usePathname();
  const handleClick = useSectionClick(href);
  // Off-homepage: navigate to /#section; on-homepage: stay on "#section" (click handler intercepts).
  const resolvedHref = pathname === "/" ? href : `/${href}`;

  return (
    <Link
      href={resolvedHref}
      onClick={handleClick}
      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
    </Link>
  );
}



function MobileNavLink({
  label,
  href,
  onClose,
}: {
  label: string;
  href: string;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const handleClick = useSectionClick(href, onClose);
  const resolvedHref = pathname === "/" ? href : `/${href}`;

  return (
    <SheetClose
      render={
        <Link
          href={resolvedHref}
          onClick={handleClick}
          className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/80 transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {label}
        </Link>
      }
    />
  );
}

/** "Book a Call" CTA — same smart-scroll logic for #contact. */
function BookCallButton({
  className,
  onClose,
}: {
  className?: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const handleClick = useSectionClick("#contact", onClose);
  const resolvedHref = pathname === "/" ? "#contact" : "/#contact";

  return (
    <Link
      href={resolvedHref}
      onClick={handleClick}
      className={cn(
        "group relative inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-brand-secondary/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className
      )}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <span className="relative z-10 flex items-center gap-2">
        Book a Call
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/* ───────────────────────────── Navbar ──────────────────────────── */

export function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Re-fires hash scroll after cross-route navigation + hydration race.
  useHashScroll();

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-300",
        "bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60",
        scrolled ? "border-border" : "border-transparent"
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <DesktopNavLink
              key={link.href}
              label={link.label}
              href={link.href}
            />
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <MagneticButton strength={6} className="hidden lg:block">
            <BookCallButton />
          </MagneticButton>
          <UserMenu />
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu" />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-4/5 max-w-xs gap-0 p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle className="text-left">
                  <Logo onClick={() => setOpen(false)} />
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-1 p-4">
                {NAV_LINKS.map((link) => (
                  <MobileNavLink
                    key={link.href}
                    label={link.label}
                    href={link.href}
                    onClose={() => setOpen(false)}
                  />
                ))}
              </div>

              <div className="mt-auto flex flex-col gap-3 border-t p-4">
                <BookCallButton
                  className="w-full"
                  onClose={() => setOpen(false)}
                />
                <MobileAuth onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </motion.header>
  );
}
