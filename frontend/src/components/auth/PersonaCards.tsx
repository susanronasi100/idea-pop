"use client";

import { useEffect, useState } from "react";
import Image, { type StaticImageData } from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { setPersona, type Persona } from "@/lib/auth/persona";

import kidDefault from "../../../public/auth/persona/kid-default.webp";
import kidHover from "../../../public/auth/persona/kid-hover.webp";
import parentDefault from "../../../public/auth/persona/parent-default.webp";
import parentHover from "../../../public/auth/persona/parent-hover.webp";
import teacherDefault from "../../../public/auth/persona/teacher-default.webp";
import teacherHover from "../../../public/auth/persona/teacher-hover.webp";

/* The designer's persona cards: a 321×158 card in #4F4F4F with its character standing on the card's bottom edge and
   rising above its top, and the text on the other side. Pointing at a card — or tabbing to it — brings in the second
   character on the opposite side and turns the line under the heading into a Start button. The sides are written with
   start/end, so the whole card mirrors on the Persian pages. */

type Card = {
  key: Persona;
  label: string;
  sub: string;
  /* the picture and where it sits (its height, and its distance from the card's side) */
  restImg: StaticImageData;
  restImgClass: string;
  overImg: StaticImageData;
  overImgClass: string;
  /* which side the words are on, opposite the picture */
  restTextClass: string;
  overTextClass: string;
  /* how wide the line under the heading may run before it wraps, so it stays clear of the picture */
  lineClass: string;
};

// The words sit 30px in from the card's side and 34px down from its top, as in the frame; the block reaches across
// two thirds of the card, so a line like "I use this in the classroom" stays on one line.
const TEXT_START = "inset-y-0 start-0 w-[70%] ps-[30px] pe-0 pt-[34px] items-start";
const TEXT_END = "inset-y-0 end-0 w-[70%] pe-[30px] ps-0 pt-[34px] text-end items-end";

/* onPick is the overlay's: it keeps the visitor on the page they were reading and shows the next step in
   place, rather than loading the page that step lives on. */
export default function PersonaCards({ onChosen, onPick }: { onChosen?: () => void; onPick?: (persona: Persona) => void }) {
  const t = useTranslations("auth.persona_select");
  const router = useRouter();
  /* A touch screen has no pointer, so nothing can be hovered: a first tap picks a card out -- it swaps to its second
     character, shows Start and keeps a lime edge -- and a second tap on it starts. Where there is a pointer, the card
     goes on the first press as before. Read after mounting, since the server cannot know which kind of screen it is. */
  const [pointer, setPointer] = useState(true);
  const [picked, setPicked] = useState<Persona | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const read = () => setPointer(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  function choose(persona: Persona) {
    setPersona(persona);
    if (onPick) {
      onPick(persona);
      return;
    }
    onChosen?.();
    if (persona === "kid") router.push("/onboarding/kid");
    else if (persona === "parent") router.push("/sign-up/parent");
    else if (persona === "teacher") router.push("/sign-up/teacher");
    else router.push("/");
  }

  function press(persona: Persona) {
    if (pointer || picked === persona) choose(persona);
    else setPicked(persona);
  }

  const cards: Card[] = [
    {
      key: "kid",
      label: t("kid_label"),
      sub: t("kid_sub"),
      restImg: kidDefault,
      restImgClass: "h-[175px] -end-[5px]",
      overImg: kidHover,
      overImgClass: "h-[170px] start-[17px]",
      restTextClass: TEXT_START,
      overTextClass: TEXT_END,
      lineClass: "max-w-[155px]",
    },
    {
      key: "parent",
      label: t("parent_label"),
      sub: t("parent_sub"),
      restImg: parentDefault,
      restImgClass: "h-[196px] start-0",
      overImg: parentHover,
      overImgClass: "h-[190px] end-[16px]",
      restTextClass: TEXT_END,
      overTextClass: TEXT_START,
      lineClass: "max-w-[145px]",
    },
    {
      key: "teacher",
      label: t("teacher_label"),
      sub: t("teacher_sub"),
      restImg: teacherDefault,
      restImgClass: "h-[179px] -end-[14px] md:-end-[35px]",
      overImg: teacherHover,
      overImgClass: "h-[193px] -start-[12px] md:-start-[19px]",
      restTextClass: TEXT_START,
      overTextClass: TEXT_END,
      lineClass: "max-w-[158px]",
    },
  ];

  /* Pointing at a card swaps it on a computer; on a touch screen, where there is no pointer, pressing it does. */
  const swap = "transition-opacity duration-[900ms] ease-in-out motion-reduce:transition-none";
  const heading = "[font-family:var(--font-cherry)] font-normal text-[24px] leading-[1.2] text-[#F3FFC2]";

  return (
    // Two cards a row from 720px with the third centred under them, as in the frame; one column on phones.
    <div className="flex flex-wrap justify-center gap-x-[43px] gap-y-[44px]">
      {cards.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => press(c.key)}
          data-persona={c.key}
          data-picked={picked === c.key}
          aria-pressed={pointer ? undefined : picked === c.key}
          className="group relative h-[158px] w-full max-w-[321px] rounded-[20px] bg-[#4F4F4F] text-start transition-[transform,box-shadow] duration-[800ms] ease-out hover:scale-[1.03] hover:shadow-[0_10px_24px_rgba(0,0,0,0.22)] active:scale-[0.99] active:duration-150 data-[picked=true]:scale-[1.02] data-[picked=true]:shadow-[inset_0_0_0_3px_#D1EF5A,0_6px_14px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#18785A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F3FFC2] motion-reduce:transition-none"
        >
          <Image
            unoptimized
            src={c.restImg}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-0 w-auto ${swap} group-hover:opacity-0 group-focus-visible:opacity-0 group-active:opacity-0 group-data-[picked=true]:opacity-0 ${c.restImgClass}`}
          />
          <Image
            unoptimized
            src={c.overImg}
            alt=""
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-0 w-auto opacity-0 ${swap} group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 group-data-[picked=true]:opacity-100 ${c.overImgClass}`}
          />
          <span className={`absolute flex flex-col ${swap} group-hover:opacity-0 group-focus-visible:opacity-0 group-active:opacity-0 group-data-[picked=true]:opacity-0 ${c.restTextClass}`}>
            <span className={heading}>{c.label}</span>
            <span className={`[font-family:var(--font-adlam)] font-normal text-[15px] leading-[1.35] text-[#F3FFC2] mt-1 text-balance ${c.lineClass}`}>{c.sub}</span>
          </span>
          {/* The same heading with the Start button. On a computer it is decoration, since pointing at a card and
              pressing it are the same gesture; on a touch screen it is what the second tap is aimed at. */}
          <span aria-hidden="true" className={`absolute flex flex-col opacity-0 ${swap} group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 group-data-[picked=true]:opacity-100 ${c.overTextClass}`}>
            <span className={heading}>{c.label}</span>
            <span className="mt-6 inline-flex items-center justify-center rounded-pill bg-[#D1EF5A] px-6 py-2 [font-family:var(--font-montserrat)] text-[15px] font-extrabold text-[#1F4D33] shadow-[inset_0_0_0_1px_#18785A,0_4px_4px_rgba(0,0,0,0.25)]">
              {t("start")}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
