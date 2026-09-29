import { getTranslations } from "next-intl/server";
import PricingPlans from "../_components/PricingPlans";
import ClosingBand from "../_components/ClosingBand";
import ScrollReveal from "../_components/ScrollReveal";
import FaqList from "../_components/FaqList";
import { keepTogether, motionDelay, pageTop } from "../_components/ui";
import "../motion.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Idea Pop",
  description:
    "Start free, upgrade when your family loves it. Simple, honest pricing for Idea Pop.",
};

/* The landing page's system throughout: the heading in Cherry Bomb One, everything else in ADLaM Display (the page had
   been on the old Baloo 2 / Nunito pair), and the landing's own plan cards and closing band. In Persian both faces
   become Playpen Sans Arabic through the :lang(fa) rules in globals.css. */
const body = "[font-family:var(--font-adlam)] font-normal";

/** Table cells: the landing's accessible green for included or unlimited, its red for excluded, grey otherwise. */
const GREEN = new Set(["all", "full", "✓", "همه", "کامل"]);
function cellClass(v: string) {
  if (v === "—") return "text-[#B3271E]";
  if (GREEN.has(v) || v.startsWith("∞")) return "text-[#296E2C]";
  return "text-[#4F4F4F]";
}

type Row = { feature: string; free: string; plus: string; family: string };
type Faq = { q: string; a: string };

type Props = { params: Promise<{ locale: string }> };

export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  const tm = await getTranslations({ locale, namespace: "marketing.pricing_teaser" });

  const rows = t.raw("rows") as Row[];
  const faq = t.raw("faq") as Faq[];
  const cell = `${body} px-4 py-3 text-center text-[clamp(0.875rem,0.8rem+0.25vw,0.9375rem)]`;

  return (
    // overflow-x-clip for the same reason as the landing page: nothing that pops or slides may scroll the page sideways.
    <div className="bg-[#F3FFC2] overflow-x-clip">
      <ScrollReveal />

      {/* 1. The heading — the landing's pricing heading, same words and size — over the landing's own plan cards.
             It sits clear of the nav's circle, which hangs below the pill. */}
      <section aria-label="Pricing plans" className={`px-4 ${pageTop} pb-12 md:pb-16`}>
        <div className="mx-auto max-w-6xl">
          <h1
            className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.75rem,1.4rem+1.5vw,2.5rem)] leading-[1.15] md:leading-[40px] text-[#4F4F4F] text-center mb-5 md:mb-[17px]"
            data-reveal="grow"
          >
            {keepTogether(t("heading"))}
          </h1>
          <PricingPlans
            labels={{
              monthly: tm("monthly"),
              annual: tm("annual"),
              freeName: tm("free_name"),
              freePrice: tm("free_price"),
              freeFeatures: [
                tm("free_f1"),
                tm("free_f2"),
                tm("free_f3"),
                tm("free_f4"),
                tm("free_f5"),
              ],
              ctaFree: tm("cta_free"),
              plusName: tm("plus_name"),
              plusPriceAnnual: tm("plus_price_annual"),
              plusPriceMonthly: tm("plus_price_monthly"),
              plusBillingAnnual: tm("plus_billing_annual"),
              plusBillingMonthly: tm("plus_billing_monthly"),
              plusIntro: tm("plus_intro"),
              plusFeatures: [
                tm("plus_f1"),
                tm("plus_f2"),
                tm("plus_f3"),
                tm("plus_f4"),
              ],
              ctaPlus: tm("cta_plus"),
              badgePopular: tm("badge_popular"),
              familyName: tm("family_name"),
              familyPriceAnnual: tm("family_price_annual"),
              familyPriceMonthly: tm("family_price_monthly"),
              familyBillingAnnual: tm("family_billing_annual"),
              familyBillingMonthly: tm("family_billing_monthly"),
              familyIntro: tm("family_intro"),
              familyFeatures: [
                tm("family_f1"),
                tm("family_f2"),
                tm("family_f3"),
              ],
              ctaFamily: tm("cta_family"),
              badgeValue: tm("badge_value"),
              freeUntil: tm("free_until"),
              wasPrice: tm("was_price"),
            }}
          />
        </div>
      </section>

      {/* 1b. Special expert courses: bought one by one, outside every plan. A course gets its own price through
             courses.price_toman (NULL = included in Plus / Family); the Library shows that price on the course. */}
      <section aria-label={t("special_heading")} className="px-4 pb-8 md:pb-12">
        <div
          className="mx-auto max-w-4xl rounded-[20px] border-[3px] border-[#18785A] bg-white p-6 md:p-8"
          data-reveal="grow"
        >
          <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
            <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.5rem,1.25rem+1vw,2rem)] leading-[1.15] text-[#4F4F4F] text-center">
              {keepTogether(t("special_heading"))}
            </h2>
            <span className="rounded-pill bg-[#F1D8FB] px-3 py-1 [font-family:var(--font-montserrat)] text-[14px] font-bold text-[#7A3D8A] whitespace-nowrap">
              {t("special_tag")}
            </span>
          </div>
          <p className={`${body} text-center text-[#4F4F4F] max-w-2xl mx-auto mb-6`}>{t("special_intro")}</p>
          <ul className="grid gap-4 md:grid-cols-3" role="list">
            {(["p1", "p2", "p3"] as const).map((k) => (
              <li key={k} className="rounded-[16px] bg-[#FBFDF0] p-4">
                <p className="font-display font-bold text-lg text-ink mb-1">{t(`special_${k}_title`)}</p>
                <p className={`${body} text-sm text-[#4F4F4F]`}>{t(`special_${k}`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 2. Compare everything */}
      <section aria-label="Compare plans" className="px-4 py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <h2
            className={`[font-family:var(--font-cherry)] font-normal text-[clamp(1.625rem,1.3rem+1.4vw,2.25rem)] leading-[1.15] text-[#4F4F4F] text-center mb-6 md:mb-8`}
            data-reveal="grow"
          >
            {keepTogether(t("compare_heading"))}
          </h2>
          <div className="overflow-x-auto rounded-[20px]" data-reveal="grow" style={motionDelay(120)}>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#EEFFA9]">
                  <th scope="col" className={`${cell} px-5 text-start text-[#1F3D34]`}>
                    {t("col_feature")}
                  </th>
                  <th scope="col" className={`${cell} text-[#1F3D34]`}>
                    {t("col_free")}
                  </th>
                  <th scope="col" className={`${cell} text-[#1F3D34]`}>
                    {t("col_plus")}
                  </th>
                  <th scope="col" className={`${cell} text-[#1F3D34]`}>
                    {t("col_family")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.feature} className={i % 2 === 0 ? "bg-white" : "bg-[#FBFDF0]"}>
                    <th scope="row" className={`${cell} px-5 text-start text-[#1F3D34]`}>
                      {r.feature}
                    </th>
                    {(["free", "plus", "family"] as const).map((col) => {
                      // A screen reader reads "—" as nothing and "✓" as "check mark", so those two cells carry the
                      // word as well; the table looks the same.
                      const value = r[col];
                      const spoken = value === "✓" ? t("included") : value === "—" ? t("not_included") : null;
                      return (
                        <td key={col} className={`${cell} ${cellClass(value)}`}>
                          {spoken ? (
                            <>
                              <span aria-hidden="true">{value}</span>
                              <span className="sr-only">{spoken}</span>
                            </>
                          ) : (
                            value
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. Billing questions: the marketing pages' one FAQ design, each question and its answer on one row */}
      <section aria-label="Billing questions" className="px-4 pt-2 pb-12 md:pb-16">
        <div className="mx-auto max-w-4xl">
          <FaqList items={faq} />
        </div>
      </section>

      {/* 4. The landing page's closing band, with the sample link beside it — the same band as The Method */}
      <ClosingBand
        label="Every plan starts free"
        heading={
          <>
            {t("cta_1")}
            <br />
            {t("cta_2")}
          </>
        }
        primary={{ href: "/sign-up", text: t("cta_start") }}
        secondary={{ href: "/challenges", text: t("cta_watch") }}
      />
    </div>
  );
}
