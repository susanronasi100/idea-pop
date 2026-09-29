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
  // Launch offer: the paid plans' prices are shown struck through with this line under them ("Free until December").
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

/** A paid plan's price, struck through, over the launch offer that replaces it for now. */
function OfferPrice({ price, labels }: { price: string; labels: PricingLabels }) {
  return (
    <>
      <span className="block font-display text-ink/50 line-through decoration-2">
        <span className="sr-only">{labels.wasPrice}: </span>
        {price}
      </span>
      <span className="mt-1 block w-fit rounded-pill bg-[#D1EF5A] px-3 py-1 [font-family:var(--font-montserrat)] text-[15px] font-extrabold text-[#146047]">
        {labels.freeUntil}
      </span>
    </>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto items-start">
        {/* Free */}
        <div className="rounded-card bg-white border-[3px] border-[#18785A] p-6 flex flex-col" data-reveal="grow" style={{ "--motion-delay": "300ms" } as React.CSSProperties}>
          <p className="font-display font-bold text-xl text-ink mb-4">
            {labels.freeName}{" "}
            <span className="font-display">{labels.freePrice}</span>
          </p>
          <ul className="space-y-2 mb-6 flex-1" role="list">
            {labels.freeFeatures.map((f) => (
              <li key={f} className="font-body text-sm font-semibold text-ink">
                <Check />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-pill [font-family:var(--font-montserrat)] font-extrabold px-6 py-3 text-[16px] border border-[#18785A] text-[#146047] bg-white transition-all duration-150 hover:bg-[#F4FADD] hover:border-2 hover:scale-[1.11] active:scale-[0.97] active:bg-[#E3EFC4] active:text-[#0F4C39] active:border-2 active:border-[#0F4C39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18785A] focus-visible:ring-offset-2 shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          >
            {labels.ctaFree}
          </Link>
        </div>

        {/* Plus */}
        <div className="relative rounded-card bg-white border-[3px] border-[#CDEB5A] shadow-lg p-6 flex flex-col" data-reveal="pop">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-pill bg-[#D1EF5A] px-4 py-[6px] [font-family:var(--font-montserrat)] text-[14px] font-bold text-[#146047] whitespace-nowrap">
            {labels.badgePopular}
          </span>
          <p className="font-display font-bold text-xl text-ink">
            {labels.plusName}{" "}
            <OfferPrice price={annual ? labels.plusPriceAnnual : labels.plusPriceMonthly} labels={labels} />
          </p>
          <p className="font-body text-sm font-semibold text-ink/50 mb-4">
            {annual ? labels.plusBillingAnnual : labels.plusBillingMonthly}
          </p>
          <p className="font-body text-sm font-bold text-ink mb-2">
            {labels.plusIntro}
          </p>
          <ul className="space-y-2 mb-6 flex-1" role="list">
            {labels.plusFeatures.map((f) => (
              <li key={f} className="font-body text-sm font-semibold text-ink">
                <Check />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-pill [font-family:var(--font-montserrat)] font-extrabold px-6 py-3 text-[16px] bg-[#D1EF5A] text-[#1F4D33] transition-all duration-150 hover:brightness-105 hover:scale-[1.11] hover:shadow-[inset_0_0_0_2px_#18785A,0_4px_4px_rgba(0,0,0,0.25)] active:scale-[0.97] active:bg-[#B8D24F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D33] focus-visible:ring-offset-2 shadow-[inset_0_0_0_1px_#18785A,0_4px_4px_rgba(0,0,0,0.25)]"
          >
            {labels.ctaPlus}
          </Link>
        </div>

        {/* Family */}
        <div className="relative rounded-card bg-white border-[3px] border-[#18785A] p-6 flex flex-col" data-reveal="grow" style={{ "--motion-delay": "300ms" } as React.CSSProperties}>
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-pill bg-white border border-[#18785A] px-4 py-[6px] [font-family:var(--font-montserrat)] text-[14px] font-bold text-[#18785A] whitespace-nowrap">
            {labels.badgeValue}
          </span>
          <p className="font-display font-bold text-xl text-ink">
            {labels.familyName}{" "}
            <OfferPrice price={annual ? labels.familyPriceAnnual : labels.familyPriceMonthly} labels={labels} />
          </p>
          <p className="font-body text-sm font-semibold text-ink/50 mb-4">
            {annual ? labels.familyBillingAnnual : labels.familyBillingMonthly}
          </p>
          <p className="font-body text-sm font-bold text-ink mb-2">
            {labels.familyIntro}
          </p>
          <ul className="space-y-2 mb-6 flex-1" role="list">
            {labels.familyFeatures.map((f) => (
              <li key={f} className="font-body text-sm font-semibold text-ink">
                <Check />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-pill [font-family:var(--font-montserrat)] font-extrabold px-6 py-3 text-[16px] border border-[#18785A] text-[#146047] bg-white transition-all duration-150 hover:bg-[#F4FADD] hover:border-2 hover:scale-[1.11] active:scale-[0.97] active:bg-[#E3EFC4] active:text-[#0F4C39] active:border-2 active:border-[#0F4C39] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18785A] focus-visible:ring-offset-2 shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          >
            {labels.ctaFamily}
          </Link>
        </div>
      </div>
    </div>
  );
}
