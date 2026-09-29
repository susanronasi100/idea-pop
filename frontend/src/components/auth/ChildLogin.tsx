"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { childLoginSchema, type ChildLoginFormData } from "@/lib/schemas/auth";
import { childLogin } from "@/lib/api/client";
import { setPersona } from "@/lib/auth/persona";
import { btnLime } from "@/components/ui/kit";

/* The child's way back in. A child never sets a password — they choose four digits when they sign up — so this asks
   for the three things they know: a grown-up's email, their own name, and that number. It is the twin of the class
   door, which asks a class code, a name and a PIN; only the first answer differs.

   Two hosts render it: its own page, and the sign-up overlay, which passes onDone so it closes itself as the app
   moves on. */
export default function ChildLogin({ onDone }: { onDone?: () => void } = {}) {
  const t = useTranslations("auth.login");
  const tk = useTranslations("onboarding.kid");
  const router = useRouter();
  const [failed, setFailed] = useState<"wrong" | "locked" | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChildLoginFormData>({ resolver: zodResolver(childLoginSchema) });

  // The messages are catalogue keys, the way the wizard's are.
  const errMsg = (m?: string) => (m && tk.has(m) ? tk(m) : (m ?? ""));

  async function onSubmit(data: ChildLoginFormData) {
    setFailed(null);
    try {
      const child = await childLogin(data.parent_email, data.nickname, data.pin);
      try {
        localStorage.setItem("ideapop_nickname", child.nickname);
      } catch {
        /* private mode — the greeting falls back to the generic name */
      }
      setPersona("kid");
      onDone?.();
      router.push("/dashboard/kid");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setFailed(message.includes("429") ? "locked" : "wrong");
    }
  }

  const field =
    "w-full rounded-xl border border-ink/15 bg-white px-4 py-3 font-body text-ink placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-[#18785A]";

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-lg" data-testid="child-login">
      <h1 className="mb-1 text-center font-display text-2xl font-bold text-ink">{t("kid_heading")}</h1>
      <p className="mb-6 text-center font-body text-sm text-ink/60">{t("kid_sub")}</p>

      {failed && (
        <div
          role="alert"
          data-testid="child-login-error"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {failed === "locked" ? t("kid_locked") : t("kid_error")}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label htmlFor="child-parent-email" className="mb-1 block font-body text-sm font-semibold text-ink">
            {t("kid_parent_email")}
          </label>
          <input
            id="child-parent-email"
            type="email"
            autoComplete="email"
            className={field}
            aria-invalid={!!errors.parent_email}
            {...register("parent_email")}
          />
          {errors.parent_email && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errMsg(errors.parent_email.message)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="child-nickname" className="mb-1 block font-body text-sm font-semibold text-ink">
            {t("kid_nickname")}
          </label>
          <input
            id="child-nickname"
            type="text"
            autoComplete="off"
            className={field}
            aria-invalid={!!errors.nickname}
            {...register("nickname")}
          />
          {errors.nickname && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errMsg(errors.nickname.message)}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="child-pin" className="mb-1 block font-body text-sm font-semibold text-ink">
            {t("kid_pin")}
          </label>
          <input
            id="child-pin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            dir="ltr"
            className={`${field} text-center tracking-[0.5em]`}
            aria-invalid={!!errors.pin}
            {...register("pin")}
          />
          {errors.pin && (
            <p role="alert" className="mt-1 text-xs text-red-600">
              {errMsg(errors.pin.message)}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`${btnLime} mt-2 w-full disabled:pointer-events-none disabled:opacity-40`}
        >
          {isSubmitting ? "…" : t("kid_submit")}
        </button>
      </form>
    </div>
  );
}
