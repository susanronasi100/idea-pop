import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import PricingPlans from "./_components/PricingPlans";
import AskIdeaPop from "./_components/AskIdeaPop";
import ScrollReveal from "./_components/ScrollReveal";
import { btnGlass, btnLime, cardShape, cardShapeLime, fromCenter, keepTogether, motionDelay } from "./_components/ui";
import FaqList from "./_components/FaqList";
// The hero: the designer's accepted camera pull-back from nature into the classroom (IDEA_POP_Final_Assets spec).
import HeroScene from "./_components/HeroScene";
import "./motion.css";
import "./hero.css";

// The designer's Figma export (5760×3060) at 2880 wide. Its left ~42% is 49% opaque in the export; flattened on white,
// which matches the Figma frame (over the page's #F3FFC2 that side turned green).
import paintingGirl from "../../../../public/landing/paint-together.webp";
import thinkingToolsAvatar from "../../../../public/landing/thinking-tools-avatar.png";
import realMakesAvatar from "../../../../public/landing/real-makes-avatar.png";
import portfolioAvatar from "../../../../public/landing/portfolio-avatar.png";
import seeTheWorld from "../../../../public/landing/see-the-world.png";
import learnCircle from "../../../../public/landing/learn.png";
import solveAndMake from "../../../../public/landing/solve-and-make.png";
// The designer's river PNG, cropped past the generator sparkle in the corner and kept at the 1400:503 shape:
// 1320x474 WebP, 168 KB.
import tryMissionBg from "../../../../public/landing/try-mission-river.webp";
import startFreeGirl from "../../../../public/landing/start-free-girl.png";
// "Made by kids this month": the designer's photos of real makes, cropped to the tile with the make in the middle and
// given one shared colour finish so the six read as a set. The page promises "photos show the project, not faces", so
// the boy looking through his eyepiece (1) is blurred and the other crops leave faces and a school name out.
import kidMake1 from "../../../../public/landing/kids/kid-make-1.webp";
import kidMake2 from "../../../../public/landing/kids/kid-make-2.webp";
import kidMake3 from "../../../../public/landing/kids/kid-make-3.webp";
import kidMake4 from "../../../../public/landing/kids/kid-make-4.webp";
import kidMake5 from "../../../../public/landing/kids/kid-make-5.webp";
import kidMake6 from "../../../../public/landing/kids/kid-make-6.webp";
// The design-thinking tiles: the designer's six object pictures with their studio backgrounds cut away, one per step
// (the bulb and the scissors turned upright), at twice the size they are shown.
import dtFrame from "../../../../public/landing/design-thinking/frame.png";
import dtCamera from "../../../../public/landing/design-thinking/camera.png";
import dtBulb from "../../../../public/landing/design-thinking/bulb.png";
import dtScissors from "../../../../public/landing/design-thinking/scissors.png";
import dtClipboard from "../../../../public/landing/design-thinking/clipboard.png";
import dtMicrophone from "../../../../public/landing/design-thinking/microphone.png";
// "Real experts": the designer's 3D teachers, head and shoulders cut from her sheet with its grey panels removed.
import expertScience from "../../../../public/landing/experts/science.png";
import expertHistory from "../../../../public/landing/experts/history.png";
import expertArt from "../../../../public/landing/experts/art.png";
import expertMath from "../../../../public/landing/experts/math.png";
const kidMakes = [kidMake1, kidMake2, kidMake3, kidMake4, kidMake5, kidMake6];

const DEEP = "#2E5F4B";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing.hero" });
  return {
    title: "Idea Pop — Ask nature. Build with your hands.",
    description: t("subhead"),
    openGraph: {
      title: "Idea Pop",
      description: t("subhead"),
      type: "website",
    },
  };
}


export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });

  const faqItems = t.raw("faq.items") as Array<{ q: string; a: string }>;
  const kidMakeAlts = t.raw("kids_made.alts") as string[];

  // The two notes under the experts: the designer set the Persian ones 8px larger than the English.
  const expertNoteSize = locale === "fa" ? "text-[23px] md:text-[28px]" : "text-[15px] md:text-[20px]";

  const yearCards = [
    {
      img: thinkingToolsAvatar,
      title: t("year.card1_title"),
      sub: t("year.card1_sub"),
    },
    {
      img: realMakesAvatar,
      title: t("year.card2_title"),
      sub: t("year.card2_sub"),
    },
    {
      img: portfolioAvatar,
      title: t("year.card3_title"),
      sub: t("year.card3_sub"),
    },
  ];

  const cycleCards = [
    {
      img: seeTheWorld,
      label: t("cycle.see_label"),
      desc: t("cycle.see_desc"),
      // The Figma green and blue, a shade darker so the labels reach 4.5:1 on the lime card (3.9 and 4.3 before).
      color: "text-[#296E2C]",
    },
    {
      img: learnCircle,
      label: t("cycle.learn_label"),
      desc: t("cycle.learn_desc"),
      color: "text-[#B3271E]",
    },
    {
      img: solveAndMake,
      label: t("cycle.solve_label"),
      desc: t("cycle.solve_desc"),
      color: "text-[#1460B7]",
    },
  ];

  /* The design-thinking tiles, each with the designer's picture for its step. Colours: each tile keeps the colour family
     of the Figma graphic (blue, coral, yellow, purple, teal, green) as a soft pastel like The Method's cycle cards, so
     the row sits calmly on the lime page; one dark label on all six reads at over 9:1 on every tile. */
  const spineTiles = [
    { label: t("curriculum.spine_1"), bg: "bg-[#CAD6E6]", img: dtFrame },
    { label: t("curriculum.spine_2"), bg: "bg-[#F1CAC5]", img: dtCamera },
    { label: t("curriculum.spine_3"), bg: "bg-[#F5E6B8]", img: dtBulb },
    { label: t("curriculum.spine_4"), bg: "bg-[#DECDE9]", img: dtScissors },
    { label: t("curriculum.spine_5"), bg: "bg-[#C7E2E6]", img: dtClipboard },
    { label: t("curriculum.spine_6"), bg: "bg-[#D7E9D5]", img: dtMicrophone },
  ];

  // The 3-year path: three year cards, then the ranks in order. The icons are decorative (hidden from screen readers).
  const pathYears = [
    { label: t("curriculum.path_year_1"), title: t("curriculum.path_year_1_title"), icon: "🧰" },
    { label: t("curriculum.path_year_2"), title: t("curriculum.path_year_2_title"), icon: "🎓" },
    { label: t("curriculum.path_year_3"), title: t("curriculum.path_year_3_title"), icon: "🌍" },
  ];
  const pathRanks = [
    { label: t("curriculum.path_rank_1"), icon: "🤠" },
    { label: t("curriculum.path_rank_2"), icon: "🛠️" },
    { label: t("curriculum.path_rank_3"), icon: "💡" },
    { label: t("curriculum.path_rank_4"), icon: "🚀" },
    { label: t("curriculum.path_rank_5"), icon: "🥇" },
    { label: t("curriculum.path_rank_6"), icon: "🧑‍🏫" },
  ];
  // Arrow between path steps; it points the other way on the Persian (right-to-left) page.
  const pathArrow = (className: string) => (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 rtl:-scale-x-100 ${className}`}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );

  // The designer's four 3D teachers, head and shoulders on the circles' pastels, in the order of her sheet.
  const experts = [
    { name: t("experts.e1_name"), role: t("experts.e1_role"), bg: "bg-[#F7E3DC]", img: expertScience },
    { name: t("experts.e2_name"), role: t("experts.e2_role"), bg: "bg-[#E2E7FA]", img: expertHistory },
    { name: t("experts.e3_name"), role: t("experts.e3_role"), bg: "bg-[#DFE9E0]", img: expertArt },
    { name: t("experts.e4_name"), role: t("experts.e4_role"), bg: "bg-[#E9DEF5]", img: expertMath },
  ];

  return (
    // overflow-x-clip: things sliding in from the side or overshooting as they pop (the tiles, a full-width pricing
    // card) would otherwise make the page scroll sideways for a moment. clip, unlike hidden, isn't a scroll container,
    // so the scroll-linked motion still follows the page.
    <div className="bg-[#F3FFC2] overflow-x-clip">
      <ScrollReveal />
      {/* 1. Hero — the animated nature-to-classroom scene (HeroScene.tsx), the copy layered above it */}
      <section aria-label="hero" className="relative lg:pt-[5.5rem]" dir="ltr" data-scroll-timeline="hero">
        {/* The box has the artwork's own 1670:942 shape, so the designer's contain layout fills it edge to edge.
            Large screens: the copy sits on the empty pale-green wall at the left of the artwork (centred, it would cover
            the question paper above the bird). Below that the wall is too small for the copy, so it goes above.
            lg: the box starts under the fixed nav capsule, which would otherwise cover the question paper. */}
        <div className="relative flex w-full flex-col lg:block lg:aspect-[1670/942]">
          <div className="relative order-2 aspect-[1670/942] w-full lg:absolute lg:inset-0 lg:aspect-auto">
            <HeroScene />
          </div>

          {/* hero copy — fluid type per the designer's responsive spec
              (clamp() from a 375px mobile floor to the 1440px design size).
              Below lg: in the flow above the picture, 7rem down (clear of the nav).
              lg and up: on the wall, sized to the artwork so the buttons stay above the girl. */}
          <div
            className="relative z-10 order-1 pt-28 pb-8 px-[clamp(1rem,-1rem+8vw,6rem)] text-center lg:absolute lg:left-[7%] lg:top-[3%] lg:w-[35%] lg:p-0 lg:text-start"
            dir={locale === "fa" ? "rtl" : "ltr"}
            data-scroll="hero-copy"
          >
            {/* Cherry Bomb One ships a single 400 weight — the spec's Regular.
                Motion: the lines rise in one after another while the scene settles. */}
            <h1 className={`[font-family:var(--font-cherry)] font-normal leading-tight text-[clamp(2rem,1.16rem+4.2vw,4rem)] ${locale === "fa" ? "lg:text-[clamp(1.875rem,2.5vw,3.25rem)]" : "lg:text-[clamp(2.25rem,3.3vw,4rem)]"}`} data-intro="rise" style={motionDelay(350)}>
              <span className="text-[#194D3D]">
                {t("hero.headline_1_pre")}
                <span className="text-[#18785A]">
                  {t("hero.headline_1_word")}
                  {t("hero.headline_1_post")}
                </span>
              </span>{" "}
              <span className="text-[#194D3D]">{t("hero.headline_2")}</span>
            </h1>
            <p className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.375rem,0.87rem+2.5vw,2.5rem)] lg:text-[clamp(1.5rem,2.1vw,2.5rem)] mt-[clamp(0.125rem,0.1rem+0.25vw,0.375rem)]" data-intro="rise" style={motionDelay(560)}>
              <span className="text-[#194D3D]">{t("hero.sub_1")}</span>{" "}
              <span className="text-[#F2994A]">{t("hero.sub_2")}</span>
            </p>
            <p className="[font-family:var(--font-adlam)] font-normal text-[#4F4F4F] text-[clamp(0.9375rem,0.79rem+0.68vw,1.25rem)] leading-[normal] [text-shadow:0_4px_4px_rgba(0,0,0,0.25)] max-w-[680px] mx-auto lg:mx-0 mt-3" data-intro="rise" style={motionDelay(770)}>
              {t("hero.body_1_pre")}
              <span className="text-[#18785A]">{t("hero.body_1_word")}</span>
              {t("hero.body_1_post")}
              {/* Desktop: one sentence per line (the designer's break); phones wrap naturally. */}
              <br className="hidden md:block" />{" "}
              {t("hero.body_2")}
            </p>
            {/* A hovered button grows 11% (up to ~19px a side), so the pair needs 32px side by side and 16px stacked to
                keep a grown button clear of its neighbour. */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-8 lg:gap-5 lg:w-max lg:whitespace-nowrap mt-[clamp(0.5rem,0.3rem+0.6vw,0.75rem)]" data-intro="rise" style={motionDelay(980)}>
              <Link
                href="/exploring"
                className={btnLime}
              >
                {t("hero.cta_explore")}
              </Link>
              <Link href="/challenges" prefetch={false} className={btnGlass}>
                {t("hero.cta_challenge")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. What a year looks like */}
      <section aria-label="what a year looks like" className="pt-8 md:pt-10">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.875rem,1.435rem+1.878vw,3rem)] leading-[normal] text-[#4F4F4F] text-center mb-[76px]" data-reveal="grow">
            {keepTogether(t("year.heading"))}
          </h2>
          {/* Figma cards: 281×325, radius 20, #EEFFA9 fill, 1px inside #D1EF5A stroke (an inset shadow, so it adds no size)
              plus the default drop shadow. One row from ~923px wide, the gap growing to the design's 130px at 1440;
              narrower screens wrap and phones stack. Each bust is 232px tall and rises 60px above its card, so
              wrapped rows get a 92px gap. Gray 1 is Figma's default #333333; the subtitle takes Gray 3 (#828282) a
              shade darker, at #707070, so 15px text reaches 4.5:1 on the card (3.6:1 before). */}
          <div className="flex flex-wrap justify-center gap-x-[clamp(1.5rem,calc(20.5vw_-_165px),8.125rem)] gap-y-[92px]">
            {/* Motion: the middle card grows in first, then the outer two, and each bust pops out of its card. */}
            {yearCards.map((card, i) => (
              <div key={card.title} className="relative w-[281px] h-[325px] shrink-0" data-reveal="grow" style={motionDelay(fromCenter(i, yearCards.length) * 220)}>
                <div className={`h-full ${cardShapeLime} bg-[#EEFFA9] px-1.5 pt-[183px] text-center`}>
                  <p className="[font-family:var(--font-adlam)] font-normal text-[24px] leading-[normal] text-[#333333]">
                    {card.title}
                  </p>
                  <p className="[font-family:var(--font-adlam)] font-normal text-[15px] leading-[normal] text-[#707070] mt-2">
                    {card.sub}
                  </p>
                </div>
                <Image
                  unoptimized
                  src={card.img}
                  alt=""
                  aria-hidden="true"
                  className="absolute -top-[60px] left-1/2 -translate-x-1/2 h-[232px] w-auto"
                  data-reveal="pop"
                  style={motionDelay(350 + fromCenter(i, yearCards.length) * 220)}
                />
              </div>
            ))}
          </div>
          {/* Figma: the pill straddles the top edge of the green "how it works" panel — 79px under the cards, with half
              its 35px height (the section below starts 17px up) laid over the panel. The 1px #D1EF5A edge is an inset shadow. */}
          <div className="relative z-10 flex justify-center mt-[79px] -mb-[17px]">
            <p className="rounded-pill bg-[#EEFFA9] shadow-[inset_0_0_0_1px_#D1EF5A] px-5 py-[7px] text-center [font-family:var(--font-adlam)] font-normal text-[16px] leading-[normal] text-[#2E574D]" data-reveal="grow">
              <span>{t("year.steps_label")}</span>{" "}
              {/* The messages separate the steps with em spaces (no dots, per the designer). Each step stays whole, so
                  "5 Re-ask" never splits at its space or hyphen and lines only break between steps. */}
              {t("year.steps").split("\u2003").map((step, i) => (
                <Fragment key={step}>
                  {i > 0 && "\u2003"}
                  <span className="whitespace-nowrap">{step}</span>
                </Fragment>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* 3. How it works — creative cycle */}
      <section aria-label="how it works">
        {/* Figma: full-width panel with 130px top corners and a square bottom that runs straight into the paint banner.
            Motion: the panel opens out of a rounded shape in its middle as it comes up. */}
        <div
          className="rounded-t-[clamp(3rem,9vw,130px)] px-4 pt-[49px] pb-[66px]"
          style={{ backgroundColor: DEEP, "--expand-radius": "clamp(3rem,9vw,130px)" } as React.CSSProperties}
          data-scroll="expand"
        >
          <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.875rem,1.435rem+1.878vw,3rem)] leading-[normal] text-[#F3FFC2] text-center" data-reveal="grow">
            {keepTogether(t("cycle.heading"))}
          </h2>
          {/* Cards 260×204, radius 30, #CFEC5A with the default drop shadow; 200px circles rise 137px above each card
              (63px overlap). One row from ~860px wide with the gap growing to the design's 114px at 1440; below that
              the cards wrap/stack, with room for the circle above every row. Descriptions wrap at 180px, as in Figma.
              204px is a minimum: a longer description (Persian runs to 4–5 lines) grows its card, keeping the 21px under
              the text that English has, and cards on one row stretch to the tallest so they stay equal.
              Phones get 32px between the heading and the first circle (desktop keeps the Figma's none). */}
          <div className="flex flex-wrap justify-center gap-x-[clamp(1.5rem,calc(15.5vw_-_109px),114px)] gap-y-[161px] pt-[169px] md:pt-[137px]">
            {/* Motion: the middle card grows in first, then the outer two, and each circle pops out of its card. */}
            {cycleCards.map((card, i) => (
              <div key={card.label} className="relative w-[260px] min-h-[204px] shrink-0" data-reveal="grow" style={motionDelay(fromCenter(i, cycleCards.length) * 220)}>
                <div className={`h-full ${cardShape} bg-[#CFEC5A] px-3 pt-[87px] pb-[21px] text-center`}>
                  <p className={`[font-family:var(--font-adlam)] font-normal text-[20px] leading-[normal] ${card.color}`}>
                    {card.label}
                  </p>
                  <p className="[font-family:var(--font-adlam)] font-normal text-[17px] leading-[normal] text-[#4F4F4F] mt-1 mx-auto max-w-[180px]">
                    {card.desc}
                  </p>
                </div>
                <Image
                  unoptimized
                  src={card.img}
                  alt=""
                  aria-hidden="true"
                  className="absolute -top-[137px] left-1/2 -translate-x-1/2 w-[200px] h-[200px] rounded-full object-cover ring-[3px] ring-white/50"
                  data-reveal="pop"
                  style={motionDelay(300 + fromCenter(i, cycleCards.length) * 220)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Paint together banner — full-bleed image with overlaid copy */}
      <section
        aria-label="paint together"
        className="relative flex flex-col overflow-hidden md:block"
        data-zoom-frame
      >
        {/* Phones: below the copy (order-2), 260px tall and cropped at 90% across so the girl sits right of centre,
            larger, face clear and helmet in view — no scrim. md+: fills the section behind the copy, as in Figma. */}
        {/* Motion: the picture zooms out as it scrolls in (the section clips the overflow). */}
        <Image
          unoptimized
          src={paintingGirl}
          alt=""
          aria-hidden="true"
          className="order-2 h-[260px] w-full object-cover object-[90%_50%] md:absolute md:inset-0 md:h-full md:object-right"
          data-scroll="zoom-out"
        />
        {/* md+: the box takes the photo's own proportions, so the whole picture shows uncropped (1440×765 at 1440 wide).
            Heading box per Figma: 738px wide, 68px from the left and 73px from the top of the 1440 frame — kept as
            percentages with a vw font size, so the layout scales with the picture. The button sits 15px below it.
            Phones: the heading and button come first (order-1) on the page background, above the photo. */}
        <div className="relative order-1 mx-auto flex w-full max-w-6xl items-center px-4 pt-10 pb-8 md:block md:max-w-none md:p-0 md:aspect-[5760/3060]">
          <div className="mx-auto max-w-sm text-center md:absolute md:left-[4.722%] md:top-[9.54%] md:mx-0 md:w-[51.25%] md:max-w-none">
            <h2 className="[font-family:var(--font-cherry)] font-normal text-3xl md:text-[3.333vw] leading-[normal] text-[#4F4F4F]" data-reveal="grow">
              {keepTogether(t("paint.heading"))}
            </h2>
            <div className="mt-6 md:mt-[15px]" data-reveal="grow" style={motionDelay(220)}>
              <Link href="/explore" prefetch={false} className={btnGlass}>
                {t("paint.cta")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Curriculum — design-thinking spine */}
      {/* Figma (1440 frame): heading Cherry Bomb One 48 #18785A 57px under the painting banner; subheading ADLaM Display 32
          and paragraph ADLaM Display 20 in #4F4F4F (the paragraph fits one 1157px line, hence the wider container). */}
      <section aria-label="curriculum" className="pt-10 pb-12 md:pt-[57px] md:pb-16">
        <div className="max-w-[1240px] mx-auto px-4 text-center">
          <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.875rem,1.435rem+1.878vw,3rem)] leading-[1.15] md:leading-[48px] text-[#18785A] mb-3 md:mb-4" data-reveal="grow">
            {keepTogether(t("curriculum.heading"))}
          </h2>
          <p className="[font-family:var(--font-adlam)] font-normal text-[clamp(1.25rem,0.9rem+1.5vw,2rem)] leading-[normal] text-[#4F4F4F]" data-reveal="grow" style={motionDelay(140)}>
            {t("curriculum.sub")}
          </p>
          <p className="[font-family:var(--font-adlam)] font-normal text-[clamp(0.9375rem,0.8rem+0.55vw,1.25rem)] leading-[normal] text-[#4F4F4F] mt-1 md:mt-0" data-reveal="grow" style={motionDelay(280)}>
            {t("curriculum.note")}
          </p>

          {/* Tiles at the Figma graphic's size (162×279 with 13px gaps — a 1037px row at 1440): the step's picture in the
              upper half (84% wide, 52% tall, with a soft shadow), the label at the bottom. 108px under the paragraph on
              desktop; 3 columns on phones. The pictures are decoration: the label names the step. */}
          {/* Motion: the tiles grow out of their centres as you scroll, the middle pair first and the outer pair last. */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-[13px] max-w-[1037px] mx-auto mt-7 md:mt-[108px]">
            {spineTiles.map((tile, i) => (
              <div key={tile.label} className={`${tile.bg} relative aspect-[162/279] flex items-end justify-center px-1.5 pb-[13%]`} data-scroll="scale-in" style={{ "--wave": fromCenter(i, spineTiles.length) } as React.CSSProperties}>
                <Image
                  unoptimized
                  src={tile.img}
                  alt=""
                  aria-hidden="true"
                  className="absolute left-1/2 top-[9%] -translate-x-1/2 w-[84%] h-[52%] object-contain [object-position:50%_60%] drop-shadow-[0_6px_6px_rgba(0,0,0,0.18)]"
                />
                <span className="[font-family:var(--font-montserrat)] font-bold text-[#16302A] text-[clamp(0.875rem,0.6rem+1vw,1.25rem)] leading-[1.2]">
                  {tile.label}
                </span>
              </div>
            ))}
          </div>
          {/* Plain-text credit only — no IDEO artwork or logo. */}
          <p className="[font-family:var(--font-adlam)] font-normal text-[14px] text-[#4F4F4F] text-start max-w-[1037px] mx-auto mt-3 md:mt-4">
            {t("curriculum.spine_credit")}
          </p>

          {/* "The 3-year path" ADLaM Display 32, kept at the Figma position (130px under the tiles). */}
          <h3 className="[font-family:var(--font-adlam)] font-normal text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] leading-[normal] text-[#4F4F4F] mt-10 mb-4 md:mt-24 md:mb-6" data-reveal="grow">
            {t("curriculum.path_heading")}
          </h3>
          {/* Year cards in the year-card colours with arrows centred in the gaps: icon above the text below 1024px,
              beside it from 1024px. */}
          <ol className="flex justify-center gap-x-6 md:gap-x-12 lg:gap-x-16 max-w-[880px] mx-auto">
            {pathYears.map((year, i) => (
              <li key={year.label} className="relative flex flex-1 min-w-0 max-w-[250px]" data-reveal="grow" style={motionDelay(fromCenter(i, pathYears.length) * 220)}>
                <div className="flex flex-1 flex-col lg:flex-row items-center gap-1.5 lg:gap-3.5 rounded-[20px] bg-[#EEFFA9] px-1.5 py-3 md:px-2.5 md:py-3.5 lg:px-[18px] text-center lg:text-start shadow-[inset_0_0_0_1px_#D1EF5A,0_4px_4px_rgba(0,0,0,0.25)]">
                  <span aria-hidden="true" className="font-emoji shrink-0 text-[28px] md:text-[32px] lg:text-[34px] leading-none">
                    {year.icon}
                  </span>
                  <span className="flex min-w-0 flex-col items-center lg:items-start [font-family:var(--font-adlam)] font-normal leading-[normal]">
                    <span className="text-[14px] md:text-[15px] text-[#18785A]">{year.label}</span>
                    <span className="text-[15px] md:text-[18px] lg:text-[20px] text-[#4F4F4F]">{year.title}</span>
                  </span>
                </div>
                {i < pathYears.length - 1 && (
                  <span className="absolute top-1/2 start-full flex w-6 md:w-12 lg:w-16 -translate-y-1/2 justify-center text-[#18785A]">
                    {pathArrow("size-[18px] md:size-6 lg:size-[30px]")}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {/* Rank pills. Each arrow stays with the pill before it, so when the row wraps on phones no line starts with an arrow. */}
          <ol className="flex flex-wrap justify-center gap-y-2.5 lg:gap-y-3 max-w-[980px] mx-auto mt-5 md:mt-7 lg:mt-8">
            {/* Motion: the ranks pop out of their centres one by one, in path order (a sequence, so not middle-first). */}
            {pathRanks.map((rank, i) => (
              <li key={rank.label} className="flex items-center" data-reveal="pop" style={motionDelay(i * 130)}>
                <span className="inline-flex items-center gap-1 lg:gap-1.5 rounded-pill bg-white px-2.5 py-[5px] lg:px-3.5 lg:py-1.5 shadow-[inset_0_0_0_1px_#D1EF5A]">
                  <span aria-hidden="true" className="font-emoji text-[16px] lg:text-[20px] leading-none">
                    {rank.icon}
                  </span>
                  <span className="[font-family:var(--font-adlam)] font-normal text-[14px] lg:text-[16px] leading-[normal] text-[#4F4F4F]">{rank.label}</span>
                </span>
                {i < pathRanks.length - 1 && pathArrow("mx-[5px] lg:mx-2 size-3.5 lg:size-[18px] text-[#18785A]")}
              </li>
            ))}
          </ol>
          <div className="mt-8 md:mt-10" data-reveal="grow">
            <Link href="/method" className={btnGlass}>
              {t("curriculum.cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Try one mission */}
      <section aria-label="try a mission">
        {/* Figma: a lime band 194px tall at 1440 — heading box 26px from the top, the line right under it, the button 11px
            lower and 6px above the picture. */}
        <div className="bg-[#CFEC5A] px-4 pt-6 pb-4 md:pt-[26px] md:pb-[6px] text-center">
          <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.875rem,1.435rem+1.878vw,3rem)] leading-[normal] text-[#4F4F4F]" data-reveal="grow">
            {keepTogether(t("try_now.heading"))}
          </h2>
          <p className="[font-family:var(--font-adlam)] font-normal text-[clamp(1rem,0.85rem+0.6vw,1.25rem)] leading-[1.48] text-[#4F4F4F]" data-reveal="grow" style={motionDelay(140)}>
            {keepTogether(t("try_now.body"))}
          </p>
          <p className="[font-family:var(--font-adlam)] font-normal text-[clamp(1rem,0.85rem+0.6vw,1.25rem)] leading-[1.48] text-[#4F4F4F] mb-[11px]" data-reveal="grow" style={motionDelay(280)}>
            {keepTogether(t("try_now.body2"))}
          </p>
          {/* The kit's primary, as the one action of this band. Its fill matches the band, so the dark green outline
              (4.1:1 against the band) and the shadow are what mark it out. */}
          <Link href="/challenges" prefetch={false} className={btnLime} data-reveal="pop" style={motionDelay(420)}>
            {t("try_now.cta")}
          </Link>
        </div>
        {/* The picture opens the mission too: the same link, kept away from screen readers and the keyboard so they
            only meet the labelled button above. Motion: the river zooms out as it scrolls in, clipped to its box. */}
        <Link href="/challenges" prefetch={false} aria-hidden="true" tabIndex={-1} className="block overflow-hidden" data-zoom-frame>
          <Image
            unoptimized
            src={tryMissionBg}
            alt=""
            aria-hidden="true"
            className="w-full h-auto"
            sizes="100vw"
            data-scroll="zoom-out"
          />
        </Link>
      </section>

      {/* 7. Made by kids this month */}
      <section aria-label="made by kids" className="pt-8 pb-7 md:pt-[35px] md:pb-[49px]">
        {/* Figma: six 200×178 tiles with 20px gaps (a 1300px row at 1440), 33px under the heading; 3 columns on phones. */}
        <div className="max-w-[1332px] mx-auto px-4">
          <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.875rem,1.435rem+1.878vw,3rem)] leading-[normal] text-[#4F4F4F] text-center mb-6 md:mb-[33px]" data-reveal="grow">
            {keepTogether(t("kids_made.heading"))}
          </h2>
          {/* Motion: the tiles pop out of their centres, the middle pair first. */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-5">
            {kidMakes.map((src, i) => (
              <div
                key={src.src}
                className="relative aspect-[200/178] overflow-hidden rounded-card bg-[#F3EDE4]"
                data-reveal="pop"
                style={motionDelay(fromCenter(i, kidMakes.length) * 160)}
              >
                <Image src={src} alt={kidMakeAlts[i]} fill sizes="(min-width: 768px) 200px, 33vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Real experts */}
      <section aria-label="experts" className="pt-7 md:pt-12">
        {/* Figma: 104px circles 210px apart, each name and role one ADLaM Display 20 text in a 200px box; 2 columns on phones. */}
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.875rem,1.435rem+1.878vw,3rem)] leading-[normal] text-[#4F4F4F] mb-5 md:mb-[17px]" data-reveal="grow">
            {keepTogether(t("experts.heading"))}
          </h2>
          {/* Motion: each circle grows out with a jelly squash and stretch and its name grows in under it, the middle two first. */}
          <div className="grid grid-cols-2 md:grid-cols-[repeat(4,minmax(0,210px))] justify-center gap-x-4 gap-y-6 md:gap-0 max-w-[480px] md:max-w-none mx-auto">
            {experts.map((e, i) => (
              <div key={e.name} className="flex flex-col items-center">
                {/* The avatar is decoration: the name and role under it say who it is. */}
                <div
                  className={`size-[88px] md:size-[104px] rounded-full overflow-hidden ${e.bg}`}
                  aria-hidden="true"
                  data-reveal="squash"
                  style={motionDelay(fromCenter(i, experts.length) * 220)}
                >
                  <Image unoptimized src={e.img} alt="" className="size-full object-cover" />
                </div>
                {/* Name, then the role on its own line: no dot between them (the designer's call). */}
                <p className="[font-family:var(--font-adlam)] font-normal text-[16px] md:text-[20px] leading-[1.2] text-[#4F4F4F] max-w-[200px] mt-3 md:mt-[17px]" data-reveal="grow" style={motionDelay(300 + fromCenter(i, experts.length) * 220)}>
                  <span className="block">{e.name}</span>
                  <span className="block">{e.role}</span>
                </p>
              </div>
            ))}
          </div>
          <p className={`[font-family:var(--font-adlam)] font-normal ${expertNoteSize} leading-[1.48] text-[#4F4F4F] mt-6 md:mt-[23px]`} data-reveal="grow">
            {keepTogether(t("experts.note1"))}
          </p>
          <p className={`[font-family:var(--font-adlam)] font-normal ${expertNoteSize} leading-[1.48] text-[#4F4F4F] mt-0.5`} data-reveal="grow" style={motionDelay(140)}>
            {keepTogether(t("experts.note2"))}
          </p>
        </div>
      </section>

      {/* 9. Pricing */}
      <section aria-label="pricing" className="pt-12 pb-16 md:pt-[70px] md:pb-20">
        {/* Figma: the heading only (the plan cards are unchanged) — 70px under the experts note, 17px above the plan switch. */}
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.875rem,1.435rem+1.878vw,3rem)] leading-[normal] text-[#4F4F4F] text-center mb-5 md:mb-[17px]" data-reveal="grow">
            {keepTogether(t("pricing_teaser.heading"))}
          </h2>
          <PricingPlans
            labels={{
              monthly: t("pricing_teaser.monthly"),
              annual: t("pricing_teaser.annual"),
              freeName: t("pricing_teaser.free_name"),
              freePrice: t("pricing_teaser.free_price"),
              freeFeatures: [
                t("pricing_teaser.free_f1"),
                t("pricing_teaser.free_f2"),
                t("pricing_teaser.free_f3"),
                t("pricing_teaser.free_f4"),
                t("pricing_teaser.free_f5"),
              ],
              ctaFree: t("pricing_teaser.cta_free"),
              plusName: t("pricing_teaser.plus_name"),
              plusPriceAnnual: t("pricing_teaser.plus_price_annual"),
              plusPriceMonthly: t("pricing_teaser.plus_price_monthly"),
              plusBillingAnnual: t("pricing_teaser.plus_billing_annual"),
              plusBillingMonthly: t("pricing_teaser.plus_billing_monthly"),
              plusIntro: t("pricing_teaser.plus_intro"),
              plusFeatures: [
                t("pricing_teaser.plus_f1"),
                t("pricing_teaser.plus_f2"),
                t("pricing_teaser.plus_f3"),
                t("pricing_teaser.plus_f4"),
              ],
              ctaPlus: t("pricing_teaser.cta_plus"),
              badgePopular: t("pricing_teaser.badge_popular"),
              familyName: t("pricing_teaser.family_name"),
              familyPriceAnnual: t("pricing_teaser.family_price_annual"),
              familyPriceMonthly: t("pricing_teaser.family_price_monthly"),
              familyBillingAnnual: t("pricing_teaser.family_billing_annual"),
              familyBillingMonthly: t("pricing_teaser.family_billing_monthly"),
              familyIntro: t("pricing_teaser.family_intro"),
              familyFeatures: [
                t("pricing_teaser.family_f1"),
                t("pricing_teaser.family_f2"),
                t("pricing_teaser.family_f3"),
              ],
              ctaFamily: t("pricing_teaser.cta_family"),
              badgeValue: t("pricing_teaser.badge_value"),
              freeUntil: t("pricing_teaser.free_until"),
              wasPrice: t("pricing_teaser.was_price"),
            }}
          />
        </div>
      </section>

      {/* 10. FAQ: the heading in the landing's heading face, the rows in the marketing pages' one FAQ design */}
      <section aria-label="questions parents ask" className="py-8 md:py-12">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.875rem,1.435rem+1.878vw,3rem)] leading-[normal] text-[#4F4F4F] text-center mb-6 md:mb-8" data-reveal="grow">
            {keepTogether(t("faq.heading"))}
          </h2>
          <FaqList items={faqItems} />
        </div>
      </section>

      {/* 11. Ask Idea Pop */}
      <AskIdeaPop
        heading={t("ask.heading")}
        sub={t("ask.sub")}
        placeholder={t("ask.placeholder")}
        inputLabel={t("ask.input_label")}
        sendLabel={t("ask.send_label")}
        micLabel={t("ask.mic_label")}
      />

      {/* 12. CTA band — Figma: a 1336-wide #18785A panel with radius 112 that straddles the footer (its bottom 105px sit
          on the footer green, 40px on phones), a Cherry Bomb 40 heading in #EEFFA9, and the girl rising 136px above it. */}
      <section
        aria-label="start for free"
        className="px-3 md:px-6 pb-0 bg-[linear-gradient(to_bottom,transparent_calc(100%_-_40px),#2E574D_calc(100%_-_40px))] md:bg-[linear-gradient(to_bottom,transparent_calc(100%_-_105px),#2E574D_calc(100%_-_105px))]"
      >
        {/* Motion: the panel grows to full size as it comes up, then the heading, button and girl come in. */}
        <div className="max-w-[1336px] mx-auto rounded-[40px] md:rounded-[112px] bg-[#18785A] px-6 md:px-14 pt-10 md:pt-0 relative overflow-visible" data-scroll="scale-in">
          <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-6">
            <div className="py-6 md:py-16 text-center md:text-start">
              <h2 className="[font-family:var(--font-cherry)] font-normal text-[clamp(1.625rem,1.15rem+2vw,2.5rem)] leading-[1.35] text-[#EEFFA9] mb-8" data-reveal="grow">
                {keepTogether(t("cta_band.heading"))}
              </h2>
              <Link href="/sign-up" className={btnLime} data-reveal="pop" style={motionDelay(220)}>
                {t("cta_band.cta")}
              </Link>
            </div>
            <div className="relative flex justify-center md:justify-end">
              <Image
                unoptimized
                src={startFreeGirl}
                alt=""
                aria-hidden="true"
                className="w-64 md:w-[450px] h-auto md:-mt-[136px] drop-shadow-xl"
                sizes="(min-width: 768px) 450px, 16rem"
                data-reveal="pop"
                style={motionDelay(350)}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
