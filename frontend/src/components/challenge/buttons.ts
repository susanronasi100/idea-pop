/**
 * The one button kit for every challenge page (TEMP rules 18, 25, 26, 27). The buttons look
 * like the landing page's CTAs: a lime pill with dark green extra-bold text, a thin green
 * outline and a soft drop shadow; the second kind is a white pill with green text. They grow
 * on hover and press down on tap, the same as on the landing page.
 *
 * Kept for readability and accessibility:
 * - 16px extra-bold text, no arrow icons: the words say where it goes.
 * - At least 48px tall (icon buttons 48×48): an easy target for small fingers (WCAG 2.5.5).
 * - Colours pass WCAG AA: dark green on lime and green on white are both above 7:1.
 * - A thick dark focus ring for keyboard users.
 * - Disabled is a solid grey with readable text, not a faded copy that looks broken.
 * The body font is Montserrat in English and Playpen Sans Arabic in Persian.
 * Pass extra layout classes (w-full, self-center…) after these.
 */
const base =
  'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-pill text-center font-body text-base font-extrabold leading-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1F4D33] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-[#D5DCD8] disabled:text-[#3F4E47] disabled:shadow-none disabled:hover:scale-100 disabled:active:scale-100';

/** The landing page's outline + drop shadow, and its stronger outline on hover and press. */
const landing =
  'shadow-[inset_0_0_0_1px_#18785A,0_4px_4px_rgba(0,0,0,0.25)] hover:scale-[1.06] hover:shadow-[inset_0_0_0_2px_#18785A,0_4px_4px_rgba(0,0,0,0.25)] active:scale-[0.97] active:shadow-[inset_0_0_0_2px_#18785A,0_2px_2px_rgba(0,0,0,0.25)]';

/** Main action: Next, Let's go, Submit, Check. */
export const btnPrimary = `${base} ${landing} bg-[#D1EF5A] px-8 py-3 text-[#1F4D33] hover:brightness-105 active:bg-[#B8D24F]`;

/** Second action: Back, Show hint, Try again. */
export const btnSecondary = `${base} ${landing} bg-white px-8 py-3 text-[#146047] hover:bg-[#F4FADD] active:bg-[#E3EFC4] active:text-[#0F4C39]`;

/** Small text action: Skip, I don't know. Underlined, so it reads as a link without relying on colour. */
export const btnText = `${base} px-3 py-2 font-bold text-[#146047] underline decoration-2 underline-offset-4 hover:decoration-[3px] disabled:bg-transparent disabled:text-[#5B6878] disabled:no-underline`;

/** Round icon: Listen, plus/minus, microphone. Give it an aria-label. Same lime and outline as the main button. */
export const btnIcon = `${base} ${landing} h-12 w-12 shrink-0 bg-[#D1EF5A] text-lg text-[#1F4D33] hover:brightness-105 active:bg-[#B8D24F]`;
