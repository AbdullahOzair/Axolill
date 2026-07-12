import { requireAdmin } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Session is per-request — never prerender any admin page.
export const dynamic = "force-dynamic";

/**
 * Guards the ENTIRE /admin tree.
 *
 * This lives in a `(dashboard)` route group on purpose: /admin/login is a
 * sibling *outside* the group, so it stays unguarded. Putting the guard in
 * app/admin/layout.tsx would also cover the login page and bounce it to itself
 * forever.
 *
 * requireAdmin():
 *   signed out        -> /admin/login?next=…
 *   signed in, client -> /portal
 */
export default async function AdminDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdmin("/admin");
  const user = session.user;

  return (
    <SidebarProvider>
      <AdminSidebar />
      {/*
        The canvas sits BEHIND the chrome (see CLAUDE.md → Admin Design System).
        Without this the inset renders on --background, level with the sidebar,
        which is what made both read as one flat surface.
      */}
      <SidebarInset className="bg-(--admin-canvas)">
        <AdminTopbar
          name={user.name}
          email={user.email}
          image={user.image ?? null}
        />
        {/* No padding here — AdminPage owns the gutters (--admin-pad-x). */}
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
