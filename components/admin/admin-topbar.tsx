"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const initials = (name: string, email: string) => {
  const source = name?.trim() || email.split("@")[0] || "?";
  return source
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

export function AdminTopbar({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image?: string | null;
}) {
  const [pending, setPending] = React.useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await signOut();
    } finally {
      // Hard navigation: guarantees we leave the guarded /admin tree and drops
      // the cached RSC payload that still holds this admin's data.
      window.location.assign("/");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-card/70 px-4 backdrop-blur-xl sm:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />

      <div className="flex flex-1 items-center justify-end gap-2">
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Account menu"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2 py-1.5 outline-none transition-colors duration-150",
                  "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                  // Base UI puts data-popup-open on the trigger. A *named group*
                  // variant silently fails to compile against it, so scope the
                  // open styles from the trigger itself.
                  "data-[popup-open]:bg-accent",
                  "[&[data-popup-open]_svg:last-of-type]:rotate-180"
                )}
              />
            }
          >
            <Avatar className="size-8">
              {image && <AvatarImage src={image} alt="" />}
              <AvatarFallback className="bg-gradient-to-br from-brand-secondary to-accent-cyan text-xs font-semibold text-white">
                {initials(name, email)}
              </AvatarFallback>
            </Avatar>

            <span className="hidden min-w-0 text-left leading-tight sm:block">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                Admin
              </span>
            </span>

            <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground transition-transform duration-200 sm:block" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-60">
            <DropdownMenuGroup>
              {/* Base UI: a Label must live inside a Group, or it throws. */}
              <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
                <span className="text-sm font-medium">{name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/admin" />}>
                <LayoutDashboard className="size-4" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/" />}>
                <ExternalLink className="size-4" />
                View site
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              {/* Instant — no confirmation. Signing back in costs one password. */}
              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={pending}
                className="text-destructive"
              >
                <LogOut className="size-4" />
                {pending ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
