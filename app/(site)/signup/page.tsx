import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Create your account — Axonill",
  description: "Create an Axonill account to get started.",
};

export default function SignupPage() {
  // AuthForm reads the `next` search param, which needs a Suspense boundary.
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
