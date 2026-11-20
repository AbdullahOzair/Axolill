"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { BookingDialog } from "@/components/portal/booking-dialog";
import { authClient } from "@/lib/auth-client";
import { BOOK_CALL_CALLBACK, BOOK_CALL_LOGIN, BOOK_CALL_PARAM } from "@/lib/booking-intent";

const RequestBooking = React.createContext<((fromCallback?: boolean) => void) | null>(null);

function BookingCallback({ request }: { request: (fromCallback: boolean) => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const hasBookingIntent = pathname === "/" && search.get(BOOK_CALL_PARAM) === "1";

  React.useEffect(() => {
    if (hasBookingIntent) request(true);
  }, [hasBookingIntent, request]);

  return null;
}

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const checking = React.useRef(false);

  const request = React.useCallback(async (fromCallback = false) => {
    if (checking.current) return;
    checking.current = true;
    try {
      const { data, error } = await authClient.getSession();
      if (error) throw new Error(error.message);
      if (!data?.user) {
        if (fromCallback) router.replace(BOOK_CALL_LOGIN);
        else router.push(BOOK_CALL_LOGIN);
        return;
      }

      if (fromCallback) {
        const url = new URL(window.location.href);
        if (url.pathname !== "/" || url.searchParams.get(BOOK_CALL_PARAM) !== "1") return;
        url.searchParams.delete(BOOK_CALL_PARAM);
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
      setOpen(true);
    } catch {
      toast.error("Could not check your session. Please try again.");
    } finally {
      checking.current = false;
    }
  }, [router]);

  return (
    <RequestBooking.Provider value={request}>
      {children}
      <React.Suspense>
        <BookingCallback request={request} />
      </React.Suspense>
      <BookingDialog
        open={open}
        onOpenChange={setOpen}
        onSent={() => toast.success("Booking request sent.")}
      />
    </RequestBooking.Provider>
  );
}

export function BookingLink({ className, children, onNavigate }: {
  className?: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  const request = React.useContext(RequestBooking);

  return (
    <Link
      href={BOOK_CALL_CALLBACK}
      prefetch={false}
      className={className}
      onNavigate={(event) => {
        onNavigate?.();
        if (!request) return;
        event.preventDefault();
        request();
      }}
    >
      {children}
    </Link>
  );
}
