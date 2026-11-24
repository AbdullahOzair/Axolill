import { PageLoader } from "@/components/page-loader";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { BackToTop } from "@/components/back-to-top";
import { BookingProvider } from "@/components/booking-provider";
import { CursorSpotlightProvider } from "@/components/cursor-spotlight";

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
    <div className="flex min-h-dvh flex-col">
      <CursorSpotlightProvider />
      <PageLoader />
      <BookingProvider>
        <Navbar />
        <main className="min-w-0 flex-1">{children}</main>
      </BookingProvider>
      <Footer />
      <BackToTop />
    </div>
  );
}
