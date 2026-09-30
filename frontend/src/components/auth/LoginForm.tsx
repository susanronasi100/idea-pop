'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { loginSchema, type LoginFormData } from "@/lib/schemas/auth";
import { login } from "@/lib/api/client";
import { dashboardHref, reconcilePersona } from "@/lib/auth/persona";
import { btnLime, btnGlass } from "@/components/ui/kit";
import { Input } from "@/components/ui/Input";

/* onDone is the overlay's: it closes itself as the app moves on. */
export default function LoginForm({ onDone }: { onDone?: () => void } = {}) {
  const t = useTranslations("auth.login");
  const ta = useTranslations("auth");
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setServerError(null);
    try {
      const { role } = await login(data.email, data.password);
      // The account's role is the source of truth — never the stale persona
      // cookie (a parent logging in on a kid-onboarded browser must land on
      // the parent dashboard, not in the kid UI).
      const persona = reconcilePersona(role);
      onDone?.();
      router.push(dashboardHref(persona));
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("401") || message.toLowerCase().includes("login failed")) {
        setServerError(t("error_invalid"));
      } else {
        setServerError(t("error_generic"));
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8" data-testid="login-form">
      <h1 className="font-display text-2xl font-bold text-ink text-center mb-6">
        {t("heading")}
      </h1>

      {serverError && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-5"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Input
          label={t("email_label")}
          type="email"
          placeholder={t("email_placeholder")}
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          label={t("password_label")}
          type="password"
          passwordToggleLabels={{ show: ta("show_password"), hide: ta("hide_password") }}
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        <div className="-mt-2 text-right">
          <Link
            href="/forgot-password"
            className="font-body text-sm font-semibold text-explore underline-offset-2 hover:underline"
          >
            {t("forgot_password")}
          </Link>
        </div>

        <button type="submit" disabled={isSubmitting} className={`${btnLime} w-full disabled:opacity-40 disabled:pointer-events-none`}>
          {isSubmitting ? "…" : t("submit")}
        </button>
      </form>

      <p className="mt-6 text-center font-body text-sm text-ink/60">
        {t("no_account")}{" "}
        <Link
          href="/sign-up"
          className="font-semibold text-explore underline-offset-2 hover:underline"
        >
          {t("sign_up")}
        </Link>
      </p>

      {/* The other way in, for a student with a code from their teacher: a way of its own rather than a line of
          small print under the one for grown-ups. */}
      <div className="mt-7 border-t border-ink/10 pt-6">
        <p className="text-center font-body text-sm text-ink/70">{t("class_code_hint")}</p>
        <Link
          href="/class-login"
          data-testid="class-code-link"
          className={`${btnGlass} mt-3 w-full`}
        >
          {t("class_code_button")}
        </Link>
      </div>
    </div>
  );
}
