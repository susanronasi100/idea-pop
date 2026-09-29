import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import ChildLogin from "@/components/auth/ChildLogin";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: `${t("kid_heading")} — Idea Pop` };
}

/* The same door the overlay shows, on a page of its own: a direct visit, a new tab, or a browser without
   JavaScript all land here. */
export default function ChildLoginPage() {
  return <ChildLogin />;
}
