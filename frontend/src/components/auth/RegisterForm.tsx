'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { registerSchema, type RegisterFormData } from "@/lib/schemas/auth";
import { register } from "@/lib/api/client";
import { setPersona, dashboardHref } from "@/lib/auth/persona";
import { btnLime } from "@/components/ui/kit";
import { Input } from "@/components/ui/Input";

interface RegisterFormProps {
  role: "parent" | "teacher";
  /* The sign-up overlay passes this so it can close itself as the app moves on. */
  onDone?: () => void;
}

export default function RegisterForm({ role, onDone }: RegisterFormProps) {
  const t = useTranslations("auth.register");
  const ta = useTranslations("auth");
  const router = useRouter();
  const [serverError, setServerError] = useState<"exists" | "generic" | null>(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const heading = role === "parent" ? t("heading_parent") : t("heading_teacher");

  async function onSubmit(data: RegisterFormData) {
    setServerError(null);
    try {
      await register(data.email, data.password, role);
      setPersona(role);
      onDone?.();
      router.push(dashboardHref(role));
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      setServerError(code === "email_exists" ? "exists" : "generic");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md bg-white rounded-2xl shadow-lg p-8" data-testid="register-form">
      <h1 className="font-display text-2xl font-bold text-ink text-center mb-6">
        {heading}
      </h1>

      {serverError && (
        <div
          role="alert"
          data-testid="register-error"
          className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-5"
        >
          {serverError === "exists" ? (
            <>
              {t("error_exists")}{" "}
              <Link href="/login" className="font-semibold underline">
                {t("error_exists_login")}
              </Link>
            </>
          ) : (
            t("error_generic")
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Input
          label={t("email_label")}
          type="email"
          placeholder={t("email_placeholder")}
          autoComplete="email"
          error={errors.email?.message}
          {...field("email")}
        />

        <Input
          label={t("password_label")}
          type="password"
          placeholder={t("password_placeholder")}
          autoComplete="new-password"
          error={errors.password?.message}
          passwordToggleLabels={{ show: ta("show_password"), hide: ta("hide_password") }}
          {...field("password")}
        />

        <Input
          label={t("confirm_label")}
          type="password"
          placeholder={t("confirm_placeholder")}
          autoComplete="new-password"
          error={errors.passwordConfirm?.message}
          passwordToggleLabels={{ show: ta("show_password"), hide: ta("hide_password") }}
          {...field("passwordConfirm")}
        />

        <button type="submit" disabled={isSubmitting} className={`${btnLime} w-full disabled:opacity-40 disabled:pointer-events-none`}>
          {isSubmitting ? "…" : t("submit")}
        </button>
      </form>

      <p className="mt-6 text-center font-body text-sm text-ink/60">
        {t("already")}{" "}
        {/* A finger needs more than the height of the word. */}
        <Link
          href="/login"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-2 align-middle font-semibold text-explore underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-explore"
        >
          {t("log_in")}
        </Link>
      </p>
    </div>
  );
}
