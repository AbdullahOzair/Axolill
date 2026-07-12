"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { signIn, signUp } from "@/lib/auth-client";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleIcon } from "@/components/brand-icons";

type Mode = "login" | "signup";

type Values = {
  name: string;
  email: string;
  password: string;
  confirm: string;
};
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = { name: "", email: "", password: "", confirm: "" };

const COPY = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to your Axonill account to continue.",
    submit: "Sign in",
    google: "Continue with Google",
    switchText: "Don't have an account?",
    switchCta: "Sign up",
    switchHref: "/signup",
    successTitle: "Signed in!",
  },
  signup: {
    title: "Create your account",
    subtitle: "Start building with Axonill in a couple of clicks.",
    submit: "Create account",
    google: "Continue with Google",
    switchText: "Already have an account?",
    switchCta: "Sign in",
    switchHref: "/login",
    successTitle: "Account created!",
  },
} as const;

function validate(mode: Mode, v: Values): Errors {
  const e: Errors = {};
  if (mode === "signup" && !v.name.trim()) e.name = "Please enter your name.";

  if (!v.email.trim()) e.email = "Please enter your email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
    e.email = "Please enter a valid email address.";

  if (!v.password) e.password = "Please enter your password.";
  else if (mode === "signup" && v.password.length < 8)
    e.password = "Password must be at least 8 characters.";

  if (mode === "signup") {
    if (!v.confirm) e.confirm = "Please confirm your password.";
    else if (v.confirm !== v.password) e.confirm = "Passwords don't match.";
  }
  return e;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where to land after auth — set by requireUser()/requireAdmin() redirects.
  const next = searchParams.get("next") ?? "/portal";

  const copy = COPY[mode];
  const [values, setValues] = React.useState<Values>(EMPTY);
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success">(
    "idle"
  );
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const update =
    (field: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setValues((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    };

  const onBlur = (field: keyof Values) => () => {
    const found = validate(mode, values);
    if (found[field]) setErrors((prev) => ({ ...prev, [field]: found[field] }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(mode, values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    setFormError(null);
    setStatus("submitting");

    const result =
      mode === "login"
        ? await signIn.email({
            email: values.email,
            password: values.password,
          })
        : await signUp.email({
            name: values.name,
            email: values.email,
            password: values.password,
          });

    if (result.error) {
      setFormError(
        result.error.message ??
          "Something went wrong. Please check your details and try again."
      );
      setStatus("idle");
      return;
    }

    setStatus("success");
    // refresh() so server components pick up the new session cookie.
    router.push(next);
    router.refresh();
  }

  async function handleGoogle() {
    setFormError(null);
    setStatus("submitting");
    const result = await signIn.social({
      provider: "google",
      callbackURL: next,
    });
    if (result?.error) {
      setFormError(result.error.message ?? "Google sign-in failed.");
      setStatus("idle");
    }
    // On success better-auth redirects the browser to Google.
  }

  return (
    <section className="relative isolate flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-16">
      {/* Brand background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_55%_55%_at_50%_45%,black,transparent)] dark:opacity-30" />
        <div className="absolute -top-24 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-brand-secondary/15 blur-3xl dark:bg-brand-secondary/20" />
        <div className="absolute bottom-0 left-1/3 size-[24rem] rounded-full bg-accent-cyan/10 blur-3xl" />
      </div>

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>

        <div className="rounded-2xl border border-border/60 bg-background/70 p-6 shadow-xl shadow-black/5 backdrop-blur-xl sm:p-8">
          {status === "success" ? (
            <SuccessState mode={mode} reduce={!!reduce} />
          ) : (
            <>
              {/* Header */}
              <div className="flex flex-col items-center text-center">
                <BrandMark size={44} priority />
                <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight">
                  {copy.title}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {copy.subtitle}
                </p>
              </div>

              {/* Google */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={status === "submitting"}
                className="mt-6 w-full gap-2.5"
                onClick={handleGoogle}
              >
                <GoogleIcon className="size-4.5" />
                {copy.google}
              </Button>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">
                  or continue with email
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              {/* Form */}
              <form noValidate onSubmit={handleSubmit} className="space-y-4">
                {/* Server-side auth error (bad credentials, email taken, …) */}
                {formError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    <CircleAlert className="mt-0.5 size-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {mode === "signup" && (
                  <Field id="name" label="Full name" error={errors.name}>
                    <Input
                      id="name"
                      autoComplete="name"
                      placeholder="Jane Doe"
                      value={values.name}
                      onChange={update("name")}
                      onBlur={onBlur("name")}
                      aria-invalid={!!errors.name}
                      aria-describedby={errors.name ? "name-error" : undefined}
                    />
                  </Field>
                )}

                <Field id="email" label="Email" error={errors.email}>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={values.email}
                    onChange={update("email")}
                    onBlur={onBlur("email")}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                  />
                </Field>

                <Field
                  id="password"
                  label="Password"
                  error={errors.password}
                  labelAside={
                    mode === "login" ? (
                      <Link
                        href="#"
                        className="rounded-sm text-xs font-medium text-brand-secondary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-blue-400"
                      >
                        Forgot password?
                      </Link>
                    ) : undefined
                  }
                >
                  <PasswordInput
                    id="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "signup" ? "At least 8 characters" : "••••••••"
                    }
                    value={values.password}
                    onChange={update("password")}
                    onBlur={onBlur("password")}
                    invalid={!!errors.password}
                    show={showPassword}
                    onToggle={() => setShowPassword((s) => !s)}
                    describedBy={errors.password ? "password-error" : undefined}
                  />
                </Field>

                {mode === "signup" && (
                  <Field
                    id="confirm"
                    label="Confirm password"
                    error={errors.confirm}
                  >
                    <PasswordInput
                      id="confirm"
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      value={values.confirm}
                      onChange={update("confirm")}
                      onBlur={onBlur("confirm")}
                      invalid={!!errors.confirm}
                      show={showConfirm}
                      onToggle={() => setShowConfirm((s) => !s)}
                      describedBy={errors.confirm ? "confirm-error" : undefined}
                    />
                  </Field>
                )}

                {/* Submit — gradient reveal on hover */}
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
                        Please wait…
                      </>
                    ) : (
                      copy.submit
                    )}
                  </span>
                </button>
              </form>

              {mode === "signup" && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  By creating an account you agree to our{" "}
                  <Link href="#" className="underline hover:text-foreground">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>
                  .
                </p>
              )}
            </>
          )}
        </div>

        {/* Switch */}
        {status !== "success" && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {copy.switchText}{" "}
            <Link
              href={copy.switchHref}
              className="rounded-sm font-medium text-brand-secondary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-blue-400"
            >
              {copy.switchCta}
            </Link>
          </p>
        )}
      </motion.div>
    </section>
  );
}

function SuccessState({ mode, reduce }: { mode: Mode; reduce: boolean }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <motion.span
        initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: reduce ? "tween" : "spring", stiffness: 200, damping: 15 }}
        className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-brand-secondary to-accent-cyan text-white shadow-lg"
      >
        <CheckCircle2 className="size-8" />
      </motion.span>
      <h1 className="mt-6 font-heading text-xl font-semibold">
        {COPY[mode].successTitle}
      </h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Taking you to your portal…
      </p>
      <span className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Redirecting
      </span>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  labelAside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  labelAside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAside}
      </div>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  show,
  onToggle,
  placeholder,
  autoComplete,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  invalid: boolean;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  autoComplete?: string;
  describedBy?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="pr-10"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className={cn(
          "absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        )}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
