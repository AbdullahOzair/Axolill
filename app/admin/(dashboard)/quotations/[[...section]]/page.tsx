import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { QuoteBuilder } from "@/components/admin/quotes/quote-builder";
import { QuoteConfig } from "@/components/admin/quotes/quote-config";
import { QuoteDashboard } from "@/components/admin/quotes/quote-dashboard";
import { QuoteDetail } from "@/components/admin/quotes/quote-detail";

export const metadata = { title: "Quotations | Axonill Admin" };

export default async function Page({ params, searchParams }: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ source?: string; preview?: string }>;
}) {
  const [route,query] = await Promise.all([params,searchParams]);
  const [screen,sub,...rest] = route.section ?? [];
  if (rest.length) notFound();
  if (!sub) {
    if (screen === "clients") redirect("/admin/clients");
    if (screen === "new") return <QuoteBuilder source={typeof query.source==="string"?query.source:undefined}/>;
    if (!screen || screen === "overview" || screen === "all") return <QuoteDashboard key={screen??"overview"} overview={screen!=="all"}/>;
    if (screen === "catalogue" || screen === "templates" || screen === "settings") return <QuoteConfig key={screen} mode={screen}/>;
    if (z.uuid().safeParse(screen).success) return <QuoteDetail id={screen} preview={query.preview==="1"}/>;
  }
  if (sub==="edit" && z.uuid().safeParse(screen).success) return <QuoteBuilder id={screen}/>;
  notFound();
}
