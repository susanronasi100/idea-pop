/* The UI kit's two buttons, in one place so every screen wears the same ones: the marketing pages, signing up, and
   logging in. The marketing pages' own kit re-exports them, so there is still a single definition to change.

   Primary is the lime fill with #1F4D33 text (7.3:1 — #18785A only reached 4.2:1, which fails at the 15px phone
   size), secondary is the see-through fill. Both rest on a 1px inset stroke, thicken to 2px and scale to 1.11 on
   hover (the label then reads 20px without the box moving anything), and darken when pressed. */
export const btnLime =
  "inline-flex items-center justify-center rounded-pill [font-family:var(--font-montserrat)] font-extrabold px-8 md:px-[53px] py-3 text-[clamp(0.9375rem,0.79rem+0.68vw,1.125rem)] bg-[#D1EF5A] text-[#1F4D33] transition-all duration-150 hover:brightness-105 hover:scale-[1.11] hover:shadow-[inset_0_0_0_2px_#18785A,0_4px_4px_rgba(0,0,0,0.25)] active:scale-[0.97] active:bg-[#B8D24F] active:shadow-[inset_0_0_0_2px_#18785A,0_2px_2px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F4D33] focus-visible:ring-offset-2 select-none shadow-[inset_0_0_0_1px_#18785A,0_4px_4px_rgba(0,0,0,0.25)]";

/* Glass button: the fill is 46% white so what's behind shows through (the hero scene); the stroke is an inset
   shadow like the lime button's. */
export const btnGlass =
  "inline-flex items-center justify-center rounded-pill [font-family:var(--font-montserrat)] font-extrabold px-8 md:px-[53px] py-3 text-[clamp(0.9375rem,0.79rem+0.68vw,1.125rem)] bg-white/[.46] text-[#146047] transition-all duration-150 hover:bg-[#F4FADD] hover:scale-[1.11] hover:shadow-[inset_0_0_0_2px_#18785A,0_4px_4px_rgba(0,0,0,0.25)] active:scale-[0.97] active:bg-[#E3EFC4] active:text-[#0F4C39] active:shadow-[inset_0_0_0_2px_#0F4C39,0_2px_2px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18785A] focus-visible:ring-offset-2 select-none shadow-[inset_0_0_0_1px_#18785A,0_4px_4px_rgba(0,0,0,0.25)]";

/* The glass button was drawn for light backgrounds. On a dark card its 46% white fill leaves the #146047 label
   unreadable, so there the fill goes opaque and everything else stays the same button. Written as a replace so
   there is still only one glass button to change; the literal class is what Tailwind reads. */
export const btnGlassOnCard = btnGlass.replace("bg-white/[.46]", "bg-white").replace("hover:bg-[#F4FADD]", "hover:bg-[#F4FADD]");

/* The steps inside the sign-up and log-in panel are narrower than a marketing page, so their buttons keep the kit's
   shape and manners on a tighter pair of shoulders. */
export const tighten = (button: string) => button.replace("px-8 md:px-[53px]", "px-7 md:px-9");
