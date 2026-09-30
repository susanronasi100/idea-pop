"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { SignUpPanel } from "@/components/auth/SignUpOverlay";

/* The persona step as its own page, for a direct visit, a new tab or a browser without JavaScript. Everywhere else a
   link to /sign-up opens the same panel as an overlay (SignUpOverlay), so nobody loses the page they were on. */
export default function PersonaSelectPage() {
  const t = useTranslations("auth.persona_select");
  const router = useRouter();

  return (
    <div
      data-testid="persona-select"
      className="relative rounded-[32px] bg-[#F3FFC2] px-4 py-10 shadow-lg md:px-10"
    >
      <SignUpPanel onClose={() => router.push("/")} closeLabel={t("close")} />
    </div>
  );
}
