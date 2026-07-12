"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Eye, EyeOff, Loader2, Shield } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { authClient, signIn, signOut } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Admin sign-in. Deliberately email + password ONLY:
 *  - no "Sign up" link  — admins are created by `npm run create-admin`
 *  - no "Continue with Google" — that path can only ever produce a client
 */
export function AdminLoginForm() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "submitting">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setStatus("submitting");

    const result = await signIn.email({ email: email.trim(), password });
    if (result.error) {
      setError(result.error.message ?? "Invalid email or password.");
      setStatus("idle");
      return;
    }

    /*
     * A client's credentials are valid here too, so verify the role and refuse
     * non-admins — otherwise they'd sign in only to be bounced to /portal with
     * no explanation.
     */
    const session = await authClient.getSession();
    const sessionUser = session.data?.user as { role?: string } | undefined;
    if (sessionUser?.role !== "admin") {
      await signOut();
      setError("This account doesn't have admin access.");
      setStatus("idle");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    // No navbar on /admin/login (it sits outside the (site) group), so this is a
    // full-height screen rather than 100vh minus the 4rem navbar.
    <section className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      {/* Brand background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_55%_55%_at_50%_45%,black,transparent)] dark:opacity-30" />
        <div className="absolute -top-24 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-brand-secondary/15 blur-3xl dark:bg-brand-secondary/20" />
      </div>

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl border border-border/60 bg-background/70 p-6 shadow-xl shadow-black/5 backdrop-blur-xl sm:p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand-secondary to-accent-cyan text-white shadow-sm">
              <Shield className="size-5" />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight">
              Admin sign in
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Staff access only.
            </p>
          </div>

          <form noValidate onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                placeholder="you@axonill.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Input
                  id="admin-password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!error}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                  className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "submitting"}
              className="group relative inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm outline-none transition-all duration-300 hover:shadow-md hover:shadow-brand-secondary/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-70"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative z-10 flex items-center gap-2">
                {status === "submitting" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </span>
            </button>
          </form>

          <p className="mt-6 border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
            Admin accounts are provisioned by the Axonill team and can&apos;t be
            created here.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Not staff?{" "}
          <Link
            href="/login"
            className="rounded-sm font-medium text-brand-secondary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-blue-400"
          >
            Client sign in
          </Link>
        </p>
      </motion.div>
    </section>
  );
}
