import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign in — Axonill",
  description: "Sign in to your Axonill account.",
};

export default function LoginPage() {
  // AuthForm reads the `next` search param, which needs a Suspense boundary.
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
