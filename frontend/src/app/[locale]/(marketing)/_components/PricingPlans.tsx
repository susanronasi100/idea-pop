"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";

export interface PricingLabels {
  monthly: string;
  annual: string;
  freeName: string;
  freePrice: string;
  freeFeatures: string[];
  ctaFree: string;
  plusName: string;
  // The big price follows the Monthly / Annual switch, like the billing line under it (annual = the yearly bill / 12).
  plusPriceAnnual: string;
  plusPriceMonthly: string;
  plusBillingAnnual: string;
  plusBillingMonthly: string;
  plusIntro: string;
  plusFeatures: string[];
  ctaPlus: string;
  badgePopular: string;
  familyName: string;
  familyPriceAnnual: string;
  familyPriceMonthly: string;
  familyBillingAnnual: string;
  familyBillingMonthly: string;
  familyIntro: string;
  familyFeatures: string[];
  ctaFamily: string;
  badgeValue: string;
  // Launch offer: the paid plans' prices are shown struck through with this line under them ("Free until Nowruz").
  freeUntil: string;
  // Read by screen readers before a struck-through price, which they otherwise read as a plain price.
  wasPrice: string;
}

function Check() {
  return (
    <span className="text-[#2E5F4B] font-bold me-1.5" aria-hidden="true">
      ✓
    </span>
  );
}

const outlineCta =
  "border border-[#18785A] text-[#146047] bg-white hover:bg-[#F4FADD] hover:border-2 active:bg-[#E3EFC4] active:text-[#0F4C39] active:border-2 active:border-[#0F4C39] focus-visible:ring-[#18785A] shadow-[0_4px_4px_rgba(0,0,0,0.25)]";
const filledCta =
  "bg-[#D1EF5A] text-[#1F4D33] hover:brightness-105 hover:shadow-[inset_0_0_0_2px_#18785A,0_4px_4px_rgba(0,0,0,0.25)] active:bg-[#B8D24F] focus-visible:ring-[#1F4D33] shadow-[inset_0_0_0_1px_#18785A,0_4px_4px_rgba(0,0,0,0.25)]";

// One price style for all three plans: Free's "0 Toman" and the paid plans' "Free until Nowruz" look the same.
const priceText = "font-display font-bold text-[1.5rem] leading-tight text-ink";

interface PlanCardProps {
  name: string;
  badge?: { text: string; filled: boolean };
  featured?: boolean;
  /** Free plan: the price itself. */
  price?: string;
  /** Paid plans during the launch offer: the regular price, shown struck through above the offer line. */
  regularPrice?: string;
  billing?: string;
  intro?: string;
  features: string[];
  cta: string;
  labels: PricingLabels;
  reveal: "grow" | "pop";
}

/* One anatomy for all three plans, top to bottom: name, price block, billing note, a rule, what's included, and the
   button pinned to the bottom so the three buttons line up. The launch offer sits in the price slot in the same style as
   Free's price (not a filled pill, which read as a second button), with the regular price struck through above it. */
function PlanCard({ name, badge, featured, price, regularPrice, billing, intro, features, cta, labels, reveal }: PlanCardProps) {
  return (
    <div
      className={`relative rounded-card bg-white p-6 pt-8 flex flex-col h-full border-[3px] ${
        featured ? "border-[#CDEB5A] shadow-lg" : "border-[#18785A]"
      }`}
      data-reveal={reveal}
      style={reveal === "grow" ? ({ "--motion-delay": "300ms" } as React.CSSProperties) : undefined}
    >
      {badge && (
        <span
          className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-pill px-4 py-[6px] [font-family:var(--font-montserrat)] text-[14px] font-bold whitespace-nowrap ${
            badge.filled ? "bg-[#D1EF5A] text-[#146047]" : "bg-white border border-[#18785A] text-[#18785A]"
          }`}
        >
          {badge.text}
        </span>
      )}

      <p className="font-display font-bold text-xl text-ink">{name}</p>

      {/* Price block: a fixed height so the rules and lists start at the same line in all three cards. */}
      <div className="mt-3 min-h-[7rem]">
        {regularPrice ? (
          <>
            <p className="font-body text-base font-semibold text-ink/50">
              <span className="sr-only">{labels.wasPrice}: </span>
              <s className="decoration-2">{regularPrice}</s>
            </p>
            <p className={priceText}>{labels.freeUntil}</p>
          </>
        ) : (
          <>
            {/* An empty line where the paid plans show their struck-through price, so all three prices sit level. */}
            <p className="font-body text-base font-semibold invisible" aria-hidden="true">
              &nbsp;
            </p>
            <p className={priceText}>{price}</p>
          </>
        )}
        {billing && <p className="mt-1 font-body text-sm font-semibold text-ink/60">{billing}</p>}
      </div>

      <hr className="my-4 border-t border-[#18785A]/20" />

      {intro && <p className="font-body text-sm font-bold text-ink mb-2">{intro}</p>}
      <ul className="space-y-2 mb-6 flex-1" role="list">
        {features.map((f) => (
          <li key={f} className="font-body text-sm font-semibold text-ink">
            <Check />
            {f}
          </li>
        ))}
      </ul>

      <Link
        href="/sign-up"
        className={`mt-auto inline-flex items-center justify-center rounded-pill [font-family:var(--font-montserrat)] font-extrabold px-6 py-3 text-[16px] transition-all duration-150 hover:scale-[1.05] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          featured ? filledCta : outlineCta
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

export default function PricingPlans({ labels }: { labels: PricingLabels }) {
  // Opens on Monthly: the monthly prices are the ones the plans are named by (200,000 / 500,000 Toman).
  const [annual, setAnnual] = useState(false);

  const toggleBase =
    "rounded-pill px-5 py-2.5 [font-family:var(--font-montserrat)] text-[16px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E5F4B] focus-visible:ring-offset-2";

  return (
    <div data-testid="landing-pricing">
      {/* Billing period toggle. Motion (landing motion.css): the switch grows in, Plus pops out in the middle, then Free and
          Family grow in on either side. */}
      <div className="flex justify-center mb-10" data-reveal="grow">
        <div
          className="inline-flex items-center rounded-pill bg-[#EEFFA9] border border-[#18785A] p-1"
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            className={`${toggleBase} ${
              !annual ? "bg-[#2E5F4B] text-white" : "text-[#18785A]"
            }`}
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
          >
            {labels.monthly}
          </button>
          <button
            type="button"
            className={`${toggleBase} ${
              annual ? "bg-[#2E5F4B] text-white" : "text-[#18785A]"
            }`}
            aria-pressed={annual}
            onClick={() => setAnnual(true)}
          >
            {labels.annual}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">
        <PlanCard
          name={labels.freeName}
          price={labels.freePrice}
          features={labels.freeFeatures}
          cta={labels.ctaFree}
          labels={labels}
          reveal="grow"
        />
        <PlanCard
          name={labels.plusName}
          badge={{ text: labels.badgePopular, filled: true }}
          featured
          regularPrice={annual ? labels.plusPriceAnnual : labels.plusPriceMonthly}
          billing={annual ? labels.plusBillingAnnual : labels.plusBillingMonthly}
          intro={labels.plusIntro}
          features={labels.plusFeatures}
          cta={labels.ctaPlus}
          labels={labels}
          reveal="pop"
        />
        <PlanCard
          name={labels.familyName}
          badge={{ text: labels.badgeValue, filled: false }}
          regularPrice={annual ? labels.familyPriceAnnual : labels.familyPriceMonthly}
          billing={annual ? labels.familyBillingAnnual : labels.familyBillingMonthly}
          intro={labels.familyIntro}
          features={labels.familyFeatures}
          cta={labels.ctaFamily}
          labels={labels}
          reveal="grow"
        />
      </div>
    </div>
  );
}
