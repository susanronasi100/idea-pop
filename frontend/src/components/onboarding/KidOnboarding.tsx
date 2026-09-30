"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useFormatter } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { kidProfileSchema, type KidProfileFormData } from "@/lib/schemas/auth";
import { AVATARS } from "@/lib/avatars";
import { addChild, createChild, fetchMe } from "@/lib/api/client";
import { getPersona, setPersona } from "@/lib/auth/persona";
import { btnLime, btnGlassOnCard, tighten } from "@/components/ui/kit";

const BIRTH_YEARS = Array.from({ length: 17 }, (_, i) => 2022 - i);

const CARD = "#2A2A2A";
const LIME = "#CDEB5A";

/* The kit's two buttons, tightened for the panel: lime carries the step forward, the see-through one goes back.
   On this dark card the see-through fill goes opaque, or its green label would not read. */
const nextBtn = `${tighten(btnLime)} disabled:opacity-40 disabled:pointer-events-none focus-visible:ring-offset-[#2A2A2A]`;
const backBtn = `${tighten(btnGlassOnCard)} focus-visible:ring-offset-[#2A2A2A]`;
/* A name, an age and a parent's email each ask one thing, so they stand at one height with their buttons on its
   floor; the panel then holds still as the kid moves from one to the next. The tallest of the three sets it. */
const askStep = "flex min-h-[174px] flex-col";

const darkInput =
  "w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-body text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#CDEB5A]";

/* The four steps a kid fills in. Two hosts render it: its own page, and the sign-up overlay, which passes onExit so
   the first step's "before" returns to the choice of who you are rather than loading a page, and onDone so the
   overlay closes itself the moment the account is made and the app moves on. */
export default function KidOnboarding({ onExit, onDone }: { onExit?: () => void; onDone?: () => void } = {}) {
  const t = useTranslations("onboarding.kid");
  const format = useFormatter();
  const router = useRouter();
  const [step, setStep] = useState(1);

  // A signed-in parent adding a child (dashboard → "Invite your child") vs. a
  // kid self-signing up. Parents skip the parent-email step — we already know
  // their email — and stay in their OWN session afterward instead of being
  // dropped into the new kid's app.
  const [isParent, setIsParent] = useState(false);
  const [parentEmailReady, setParentEmailReady] = useState(false);
  const totalSteps = isParent ? 3 : 4;
  const exitHref = isParent ? "/dashboard/parent" : "/sign-up";

  // Validation messages are catalog keys; fall back to any raw zod default
  // (e.g. an invalid_type message) that isn't a known key.
  const errMsg = (m?: string) => (m && t.has(m) ? t(m) : (m ?? ""));
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<KidProfileFormData>({
    resolver: zodResolver(kidProfileSchema),
    mode: "onBlur",
    defaultValues: {
      avatar_id: "",
      nickname: "",
      birth_year: undefined,
      parent_email: "",
    },
  });

  // Parent flow: resolve the parent's own email server-side and pre-fill it, so
  // there's no reason to ask for it again. If we can't (e.g. session expired),
  // fall back to the full kid flow that asks for a parent email.
  useEffect(() => {
    if (getPersona() !== "parent") return;
    setIsParent(true);
    fetchMe()
      .then((me) => {
        const email = (me as { email?: string })?.email;
        if (email) {
          setValue("parent_email", email, { shouldValidate: true });
          setParentEmailReady(true);
        } else {
          setIsParent(false);
        }
      })
      .catch(() => setIsParent(false));
  }, [setValue]);

  const selectedAvatar = watch("avatar_id");

  const stepTitle: Record<number, string> = {
    1: t("step_avatar"),
    2: t("step_nickname"),
    3: t("step_birth_year"),
    4: t("step_parent_email"),
  };

  async function advanceStep() {
    const fieldsByStep: Record<number, (keyof KidProfileFormData)[]> = {
      1: ["avatar_id"],
      2: ["nickname"],
      3: ["birth_year"],
    };
    const fields = fieldsByStep[step];
    if (fields) {
      const valid = await trigger(fields);
      if (!valid) return;
    }
    setStep((s) => s + 1);
  }

  async function onSubmit(data: KidProfileFormData) {
    setApiError(null);
    const payload = {
      nickname: data.nickname,
      avatar_id: data.avatar_id,
      birth_year: data.birth_year,
      parent_email: data.parent_email,
    };
    try {
      if (isParent) {
        // Keep the parent's session; the child appears in "Your children".
        await addChild(payload);
        onDone?.();
        router.push("/dashboard/parent");
        return;
      }
      await createChild(payload);
      // Persist identity so the shell/dashboard greet the kid by name.
      try {
        localStorage.setItem(
          "kidProfile",
          JSON.stringify({ nickname: data.nickname, avatar_id: data.avatar_id }),
        );
        localStorage.setItem("ideapop_nickname", data.nickname);
      } catch {
        /* private mode — greeting falls back to the generic name */
      }
      setPersona("kid");
      onDone?.();
      router.push("/dashboard/kid");
    } catch {
      setApiError(t("error_generic"));
    }
  }

  return (
    <div data-testid="kid-wizard" className="flex w-full flex-col items-center">
      <div
        className="mt-6 w-full max-w-md rounded-[1.75rem] p-7 shadow-xl"
        style={{ backgroundColor: CARD }}
      >
        <p className="mb-5 text-center font-display text-lg font-bold text-[#CDEB5A]">
          {format.number(step)} · {stepTitle[step]}
        </p>

        {isParent && (
          <p className="-mt-3 mb-5 text-center font-body text-sm text-white/60">
            {t("parent_add_note")}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {step === 1 && (
            <section data-testid="step-1">
              <Controller
                name="avatar_id"
                control={control}
                render={({ field }) => (
                  <div
                    data-testid="avatar-grid"
                    className="mx-auto grid max-w-xs grid-cols-3 gap-4"
                    role="group"
                    aria-label={t("step_avatar")}
                  >
                    {AVATARS.slice(0, 5).map((avatar) => {
                      const isSelected = field.value === avatar.id;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={avatar.label}
                          onClick={() => field.onChange(avatar.id)}
                          className={[
                            "mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full transition-transform duration-150",
                            isSelected
                              ? "ring-4 ring-[#CDEB5A] scale-105"
                              : "hover:scale-105",
                          ].join(" ")}
                          style={{ backgroundColor: avatar.bg }}
                        >
                          {avatar.img ? (
                            <Image
                              src={avatar.img}
                              alt=""
                              width={80}
                              height={80}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <span className="select-none text-5xl leading-none">
                              {avatar.emoji}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {/* Make-your-own-with-AI (coming soon) */}
                    <button
                      type="button"
                      aria-label={t("ai_make")}
                      onClick={() => router.push(exitHref)}
                      className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white text-3xl text-[#2A2A2A] transition-transform duration-150 hover:scale-105"
                    >
                      +
                    </button>
                  </div>
                )}
              />

              {errors.avatar_id && (
                <p role="alert" className="mt-3 text-center text-xs text-red-300">
                  {errMsg(errors.avatar_id.message)}
                </p>
              )}

              <p className="mt-5 whitespace-pre-line text-center font-body text-sm text-white/60">
                {t("pick_look_note")}
              </p>

              <div className="mt-6 flex justify-center gap-3">
                <button type="button" className={backBtn} onClick={() => (onExit ? onExit() : router.push(exitHref))}>
                  {t("before")}
                </button>
                <button
                  type="button"
                  className={nextBtn}
                  onClick={advanceStep}
                  disabled={!selectedAvatar}
                >
                  {t("next")}
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section data-testid="step-2" className={askStep}>
              <p className="mb-4 text-center font-body text-sm text-white/60">
                {t("step_nickname_sub")}
              </p>
              <label htmlFor="nickname" className="sr-only">
                {t("step_nickname")}
              </label>
              <input
                id="nickname"
                type="text"
                autoFocus
                autoComplete="off"
                placeholder={t("step_nickname_placeholder")}
                aria-invalid={!!errors.nickname}
                className={darkInput}
                {...register("nickname")}
              />
              {errors.nickname && (
                <p role="alert" className="mt-2 text-xs text-red-300">
                  {errMsg(errors.nickname.message)}
                </p>
              )}
              <div className="mt-auto flex justify-center gap-3 pt-6">
                <button type="button" className={backBtn} onClick={() => setStep((s) => s - 1)}>
                  {t("before")}
                </button>
                <button type="button" className={nextBtn} onClick={advanceStep}>
                  {t("next")}
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section data-testid="step-3" className={askStep}>
              <p className="mb-4 text-center font-body text-sm text-white/60">
                {t("step_birth_year_sub")}
              </p>
              <label htmlFor="birth-year-select" className="sr-only">
                {t("step_birth_year")}
              </label>
              <select
                id="birth-year-select"
                aria-invalid={!!errors.birth_year}
                className={darkInput}
                {...register("birth_year", { valueAsNumber: true })}
              >
                <option value="">—</option>
                {BIRTH_YEARS.map((year) => (
                  <option key={year} value={year} className="text-ink">
                    {year}
                  </option>
                ))}
              </select>
              {errors.birth_year && (
                <p role="alert" className="mt-2 text-xs text-red-300">
                  {errMsg(errors.birth_year.message)}
                </p>
              )}
              {isParent && apiError && (
                <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-200">
                  {apiError}
                </div>
              )}
              <div className="mt-auto flex justify-center gap-3 pt-6">
                <button type="button" className={backBtn} onClick={() => setStep((s) => s - 1)}>
                  {t("before")}
                </button>
                {isParent ? (
                  <button
                    type="submit"
                    className={nextBtn}
                    disabled={isSubmitting || !parentEmailReady}
                  >
                    {isSubmitting ? t("add_submitting") : t("add_submit")}
                  </button>
                ) : (
                  <button type="button" className={nextBtn} onClick={advanceStep}>
                    {t("next")}
                  </button>
                )}
              </div>
            </section>
          )}

          {step === 4 && !isParent && (
            <section data-testid="step-4" className={askStep}>
              <p className="mb-4 text-center font-body text-sm text-white/60">
                {t("step_parent_email_sub")}
              </p>
              <label htmlFor="parent-email" className="sr-only">
                {t("step_parent_email")}
              </label>
              <input
                id="parent-email"
                type="email"
                autoFocus
                autoComplete="email"
                placeholder={t("step_parent_email_placeholder")}
                aria-invalid={!!errors.parent_email}
                className={darkInput}
                {...register("parent_email")}
              />
              {errors.parent_email && (
                <p role="alert" className="mt-2 text-xs text-red-300">
                  {errMsg(errors.parent_email.message)}
                </p>
              )}
              {apiError && (
                <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-200">
                  {apiError}
                </div>
              )}
              <div className="mt-auto flex justify-center gap-3 pt-6">
                <button type="button" className={backBtn} onClick={() => setStep((s) => s - 1)}>
                  {t("before")}
                </button>
                <button type="submit" className={nextBtn} disabled={isSubmitting}>
                  {isSubmitting ? t("submitting") : t("submit")}
                </button>
              </div>
            </section>
          )}
        </form>

        {/* progress dots */}
        <div className="mt-6 flex justify-center gap-2" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className="h-2 rounded-full transition-all"
              style={{
                width: i + 1 === step ? "1.5rem" : "0.5rem",
                backgroundColor: i + 1 <= step ? LIME : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
