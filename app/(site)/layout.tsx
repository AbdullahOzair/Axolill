import { PageLoader } from "@/components/page-loader";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BackToTop } from "@/components/back-to-top";

/**
 * Marketing + client chrome: navbar, footer, page loader, back-to-top.
 *
 * Covers /, /login, /signup, /portal, /portal/book. The admin dashboard is
 * deliberately NOT in this group — it has its own sidebar + top bar.
 */
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PageLoader />
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <BackToTop />
    </>
  );
}
