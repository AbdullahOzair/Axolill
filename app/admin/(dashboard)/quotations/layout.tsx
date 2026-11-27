import type { ReactNode } from "react";
import "@/components/admin/quotes/quotes.css";

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="quotation-admin">{children}</div>;
}
