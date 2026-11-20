import type { Metadata } from "next";
import { SecuritySettings } from "@/components/admin/security-settings";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Security — Axonill Admin" };

export default async function Page() {
  const { user } = await requireAdmin("/admin/settings/security");
  return <SecuritySettings initialEnabled={user.twoFactorEnabled === true} />;
}
