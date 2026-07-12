"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  FolderKanban,
  Inbox,
  Layers,
  LayoutDashboard,
  MessageSquareQuote,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Sparkles,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/content/services", label: "Services", icon: Sparkles },
      {
        href: "/admin/content/technologies",
        label: "Technologies",
        icon: Server,
      },
      { href: "/admin/content/portfolio", label: "Portfolio", icon: Layers },
      { href: "/admin/content/team", label: "Team", icon: Users },
      {
        href: "/admin/content/testimonials",
        label: "Testimonials",
        icon: MessageSquareQuote,
      },
    ],
  },
  {
    label: "Clients",
    items: [
      { href: "/admin/clients", label: "Clients", icon: Building2 },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban },
      { href: "/admin/meetings", label: "Meetings", icon: CalendarDays },
    ],
  },
  {
    label: "Leads",
    items: [{ href: "/admin/leads", label: "Leads", icon: Inbox }],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/admin/settings/calendar",
        label: "Calendar",
        icon: CalendarCheck,
      },
    ],
  },
];

/** Shared-element id — one indicator slides between items across all groups. */
const INDICATOR = "admin-nav-indicator";

export function AdminSidebar() {
  const pathname = usePathname();
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const reduce = useReducedMotion();

  // On mobile the sidebar is a sheet, so it's never in rail mode.
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/60 bg-sidebar/70 backdrop-blur-xl"
    >
      <SidebarHeader className="p-3">
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed && "flex-col gap-3"
          )}
        >
          <Link
            href="/"
            aria-label="Axonill home"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark size={28} />
            <span
              className={cn(
                "truncate font-heading text-base font-semibold tracking-tight transition-opacity duration-150",
                collapsed && "pointer-events-none w-0 opacity-0"
              )}
            >
              Axonill
            </span>
          </Link>

          {/* The rail toggle. Doubles as the icon the topbar trigger mirrors. */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
              }
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3 pb-4">
        {NAV_GROUPS.map((group, gi) => (
          <div
            key={group.label}
            // Groups breathe: 24px between them, none before the first.
            className={cn(gi > 0 && "mt-6")}
          >
            {/* Section label — admin-eyebrow scale. Collapses to a rule. */}
            {collapsed ? (
              <div
                aria-hidden
                className="mx-auto mb-2 h-px w-6 bg-sidebar-border"
              />
            ) : (
              <p className="admin-eyebrow px-3 pb-2">{group.label}</p>
            )}

            <ul className="flex flex-col gap-1.5">
              {group.items.map((item) => {
                // "/admin" is a prefix of every other admin route, so the
                // overview item matches exactly — otherwise it would light up
                // on every page.
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={active}
                      collapsed={collapsed}
                      reduce={!!reduce}
                      onNavigate={() => isMobile && setOpenMobile(false)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  reduce,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  reduce: boolean;
  onNavigate: () => void;
}) {
  const { href, label, icon: Icon } = item;

  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-10 items-center gap-3 rounded-lg px-3 outline-none",
        "transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring",
        collapsed && "justify-center px-0",
        active
          ? "text-sidebar-accent-foreground"
          : // Inactive: dimmed, then full opacity + a surface on hover.
            "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      )}
    >
      {/*
       * The shared element. One motion.div with a constant layoutId across
       * every group, so navigating slides it from the old item to the new
       * one instead of popping a static outline.
       */}
      {active &&
        (reduce ? (
          <span className="absolute inset-0 rounded-lg bg-brand-secondary/12 ring-1 ring-inset ring-brand-secondary/25" />
        ) : (
          <motion.span
            layoutId={INDICATOR}
            aria-hidden
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="absolute inset-0 rounded-lg bg-brand-secondary/12 ring-1 ring-inset ring-brand-secondary/25"
          >
            {/* Accent bar rides along with the pill. */}
            <span className="absolute inset-y-2 -left-px w-[3px] rounded-full bg-brand-secondary shadow-[0_0_8px_0] shadow-brand-secondary/50" />
          </motion.span>
        ))}

      <Icon
        className={cn(
          // `relative` so it paints above the absolutely-positioned pill.
          "relative size-4 shrink-0 transition-colors duration-150",
          active
            ? "text-brand-secondary dark:text-blue-400"
            : "text-muted-foreground group-hover/nav:text-foreground"
        )}
      />

      {/* Cross-fade the label out on the way into rail mode. */}
      <span
        className={cn(
          "relative truncate text-sm transition-opacity duration-150",
          active && "font-medium",
          collapsed && "pointer-events-none w-0 opacity-0"
        )}
      >
        {label}
      </span>
    </Link>
  );

  // In rail mode the label is gone, so the tooltip carries the name.
  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
