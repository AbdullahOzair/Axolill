"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, Shield } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOut, useSession } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/* --------------------------------- helpers -------------------------------- */

type SessionUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
};

const initials = (name?: string | null, email?: string | null) => {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/[\s._-]+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

/** Admins land on /admin, everyone else on /portal. */
const dashboardFor = (user: SessionUser) =>
  user.role === "admin"
    ? { href: "/admin", label: "Admin dashboard", icon: Shield }
    : { href: "/portal", label: "Client portal", icon: LayoutDashboard };

function useSignOut() {
  const [pending, setPending] = React.useState(false);

  const run = React.useCallback(async () => {
    setPending(true);
    try {
      await signOut();
    } finally {
      /*
       * Hard navigation rather than router.push("/"):
       *  - guarantees we actually land on "/" (a soft push from a protected
       *    page like /portal was leaving the URL untouched), and
       *  - throws away the cached RSC payload, which still contains the
       *    signed-in user's data.
       */
      window.location.assign("/");
    }
  }, []);

  return { signOut: run, pending };
}

/* ------------------------------ desktop menu ------------------------------ */

export function UserMenu() {
  const { data: session, isPending } = useSession();
  const { signOut: doSignOut, pending } = useSignOut();

  // Avoid a logged-out flash while the session resolves.
  if (isPending) {
    return <Skeleton className="h-9 w-24 rounded-lg" />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/login"
          className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="group relative inline-flex h-9 items-center justify-center overflow-hidden rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-brand-secondary/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="relative z-10">Sign up</span>
        </Link>
      </div>
    );
  }

  const user = session.user as SessionUser;
  const dash = dashboardFor(user);
  const DashIcon = dash.icon;
  const firstName = user.name?.split(" ")[0] ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        }
      >
        <Avatar className="size-7">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="bg-gradient-to-br from-brand-secondary to-accent-cyan text-xs font-semibold text-white">
            {initials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-24 truncate">{firstName}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* Base UI requires GroupLabel (DropdownMenuLabel) to sit inside a Group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-semibold text-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem render={<Link href={dash.href} />}>
            <DashIcon className="size-4" />
            {dash.label}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={pending}
          onClick={() => void doSignOut()}
          className="text-destructive data-highlighted:text-destructive"
        >
          <LogOut className="size-4" />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------- mobile sheet ------------------------------ */

/** Same states as UserMenu, but laid out flat for the mobile sheet. */
export function MobileAuth({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session, isPending } = useSession();
  const { signOut: doSignOut, pending } = useSignOut();

  if (isPending) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  if (!session) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href="/login"
          onClick={onNavigate}
          className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          onClick={onNavigate}
          className="group relative inline-flex h-10 w-full items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <span className="relative z-10">Sign up</span>
        </Link>
      </div>
    );
  }

  const user = session.user as SessionUser;
  const dash = dashboardFor(user);
  const DashIcon = dash.icon;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          {user.image && <AvatarImage src={user.image} alt="" />}
          <AvatarFallback className="bg-gradient-to-br from-brand-secondary to-accent-cyan text-xs font-semibold text-white">
            {initials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {user.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Link
        href={dash.href}
        onClick={onNavigate}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <DashIcon className="size-4" />
        {dash.label}
      </Link>

      <Button
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() => {
          onNavigate?.();
          void doSignOut();
        }}
        className={cn("w-full gap-2 text-destructive hover:text-destructive")}
      >
        <LogOut className="size-4" />
        {pending ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
