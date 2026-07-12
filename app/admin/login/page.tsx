import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth";
import { AdminLoginForm } from "@/components/auth/admin-login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in — Axonill",
  description: "Staff access.",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // Already an admin? Skip the form.
  const session = await getServerSession();
  if (session?.user?.role === "admin") {
    redirect("/admin");
  }

  // AdminLoginForm reads the `next` search param.
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  );
}
