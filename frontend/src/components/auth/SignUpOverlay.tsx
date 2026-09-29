"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import type { Persona } from "@/lib/auth/persona";
import PersonaCards from "./PersonaCards";
import RegisterForm from "./RegisterForm";
import LoginForm from "./LoginForm";
import ClassLogin from "./ClassLogin";
import ChildLogin from "./ChildLogin";
import KidOnboarding from "@/components/onboarding/KidOnboarding";

/* The way in and out of an account, as an overlay: a link to the persona step, to logging in, or to signing in with
   a class code opens in place instead of loading a page, so a visitor never loses where they were, and every step
   that follows shows in the same panel. Each of those pages still exists and shows the same thing, for a direct
   visit, a new tab (ctrl-click) or a browser without JavaScript.
   It behaves like a dialog: Escape and the backdrop close it, focus moves in and cycles inside it, the page behind
   cannot scroll, and focus returns to whatever opened it. */

/* The pages this overlay stands in for, and the view each one opens. A link to any of them is answered here. */
const ENTRIES = {
  "/sign-up": "persona",
  "/login": "login",
  "/class-login": "class",
  "/child-login": "child",
} as const;
type View = "persona" | "login" | "class" | "child" | Persona;

export default function SignUpOverlay() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /* Which step is showing. "persona" is the choice of who you are, "login" and "class" the two ways back in, and a
     persona is that path's own steps -- all in this one panel, so the page behind never changes. */
  const [view, setView] = useState<View>("persona");
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const t = useTranslations("auth.persona_select");
  const tLogin = useTranslations("auth.login");
  const tClass = useTranslations("class_login");
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setOpen(false);
    setView("persona");
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus();
  }, []);

  // Catch clicks on any link to one of the pages this overlay stands in for, wherever it is -- including the links
  // inside the panel itself, which is how logging in reaches the persona step and the class code.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self")) return;
      let url: URL;
      try { url = new URL(link.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      const strip = (p: string) => p.replace(/^\/[a-z]{2}(?=\/|$)/, "").replace(/\/$/, "");
      const target = ENTRIES[strip(url.pathname) as keyof typeof ENTRIES];
      if (!target) return;
      // On that page itself the overlay would just repeat what is already on screen.
      if (strip(window.location.pathname) === strip(url.pathname)) return;
      // Caught while the click travels down, before the router's own handler runs, and stopped there so nothing
      // navigates: the overlay is the whole response to the click.
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      // A link inside the panel only changes the step, so the thing to give focus back to stays the one outside it.
      if (!panelRef.current?.contains(link)) openerRef.current = link;
      setView(target);
      setOpen(true);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Each of those steps has its own page; there the overlay would be a copy of what is already on screen.
  useEffect(() => { if (pathname in ENTRIES) setOpen(false); }, [pathname]);

  // While it is open: Escape closes, Tab stays inside, the page behind holds still, and focus starts in the panel.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')].filter((el) => !el.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    // Focus moves to the panel itself, so a reader announces the dialog -- and each step of it -- without a ring
    // landing on the close button.
    const frame = requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [open, close, view]);

  if (!mounted || !open) return null;

  /* Only the three cards need the full width; every other step is a form, so the panel follows the step rather than
     holding a card in the middle of an empty field of lime. */
  const wide = view === "persona";
  /* What a reader hears the dialog called: the heading of whichever step is showing. */
  const label =
    view === "login"
      ? tLogin("heading")
      : view === "child"
        ? tLogin("kid_heading")
        : view === "class"
          ? tClass("title")
          : view === "persona"
            ? undefined
            : t(`${view}_label`);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/45 p-4 py-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...(wide ? { "aria-labelledby": "sign-up-overlay-heading" } : { "aria-label": label })}
        data-testid="sign-up-overlay"
        data-step={view}
        tabIndex={-1}
        /* The cross keeps one margin from the panel's corner on every step. The steps that hold a card of their own
           start below it, so it never sits on top of one. */
        className={`relative w-full rounded-[32px] bg-[#F3FFC2] px-4 pb-10 shadow-[0_18px_50px_rgba(0,0,0,0.25)] outline-none md:px-10 ${wide ? "max-w-[930px] pt-10" : "max-w-[560px] pt-[72px]"}`}
      >
        {/* The way out is the same on every step: this cross, the backdrop, or Escape. */}
        <CloseButton onClose={close} label={t("close")} />
        {view === "persona" && <SignUpPanel onPick={setView} />}
        {view === "kid" && <KidOnboarding onExit={() => setView("persona")} onDone={close} />}
        {(view === "parent" || view === "teacher") && <RegisterForm role={view} onDone={close} />}
        {view === "login" && <LoginForm onDone={close} />}
        {view === "class" && <ClassLogin onDone={close} />}
        {view === "child" && <ChildLogin onDone={close} />}
      </div>
    </div>,
    document.body,
  );
}

/* The cross in the corner. The overlay keeps it above whichever step is showing, so cancelling is in the same place
   from the first card to the last field. */
function CloseButton({ onClose, label }: { onClose: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className="absolute end-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-[#194D3D] transition-colors hover:bg-[#D1EF5A] active:bg-[#B8D24F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18785A]"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

/* The first step: the designer's heading pair, the three cards, and the way back for people who already have an
   account. The /sign-up page renders the same thing without the backdrop, and there a card loads the next page
   rather than swapping the panel's contents. */
export function SignUpPanel({ onClose, closeLabel, onChosen, onPick }: { onClose?: () => void; closeLabel?: string; onChosen?: () => void; onPick?: (persona: Persona) => void }) {
  const t = useTranslations("auth.persona_select");
  const heading = "[font-family:var(--font-cherry)] font-normal text-[clamp(1.5rem,1.1rem+1.7vw,2.5rem)] leading-[1.28] text-[#194D3D] text-center";

  return (
    <>
      {onClose && <CloseButton onClose={onClose} label={closeLabel} />}
      <h1 id="sign-up-overlay-heading" className={heading}>
        {t("heading")}
      </h1>
      <p className={`${heading} mt-1 mb-9`}>{t("subhead")}</p>
      <PersonaCards onChosen={onChosen} onPick={onPick} />
      <p className="mt-8 text-center [font-family:var(--font-adlam)] font-normal text-[15px] text-[#4F4F4F]">
        {t("already")}{" "}
        {/* A finger needs more than the height of the word, so the link carries a 44px box around it. */}
        <Link
          href="/login"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-2 align-middle font-bold text-[#194D3D] underline underline-offset-2 hover:text-[#0F4C39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18785A]"
        >
          {t("log_in")}
        </Link>
      </p>
    </>
  );
}
