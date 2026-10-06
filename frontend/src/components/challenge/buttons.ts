/**
 * The one button kit for every challenge page (TEMP rules 18, 25-28). The buttons have the
 * landing page's CTA shape (extra-bold pill, thin outline, soft drop shadow, grow on hover,
 * press on tap) in the Challenge section's blue: a blue pill with white text, and a white
 * pill with blue text.
 *
 * Kept for readability and accessibility:
 * - 16px extra-bold text, no arrow icons: the words say where it goes.
 * - At least 48px tall (icon buttons 48×48): an easy target for small fingers (WCAG 2.5.5).
 * - Colours pass WCAG AA: white on #1A6FA6 and #1A6FA6 on white are both 5.0:1.
 * - A thick dark focus ring for keyboard users.
 * - Disabled is a solid grey with readable text, not a faded copy that looks broken.
 * The body font is Montserrat in English and Playpen Sans Arabic in Persian.
 * Pass extra layout classes (w-full, self-center…) after these.
 */
const base =
  'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-pill text-center font-body text-base font-extrabold leading-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0F3F63] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-[#D5DCD8] disabled:text-[#3F4E47] disabled:shadow-none disabled:hover:scale-100 disabled:active:scale-100';

/** The landing page's outline + drop shadow, and its stronger outline on hover and press. */
const landing =
  'shadow-[inset_0_0_0_1px_#0F4F7A,0_4px_4px_rgba(0,0,0,0.25)] hover:scale-[1.06] hover:shadow-[inset_0_0_0_2px_#0F4F7A,0_4px_4px_rgba(0,0,0,0.25)] active:scale-[0.97] active:shadow-[inset_0_0_0_2px_#0F4F7A,0_2px_2px_rgba(0,0,0,0.25)]';

/** Main action: Next, Let's go, Submit, Check. */
export const btnPrimary = `${base} ${landing} bg-[#1A6FA6] px-8 py-3 text-white hover:brightness-110 active:bg-[#155B88]`;

/** Second action: Back, Show hint, Try again. */
export const btnSecondary = `${base} ${landing} bg-white px-8 py-3 text-[#1A6FA6] hover:bg-[#EAF5FC] active:bg-[#D6ECF8] active:text-[#0F4F7A]`;

/** Small text action: Skip, I don't know. Underlined, so it reads as a link without relying on colour. */
export const btnText = `${base} px-3 py-2 font-bold text-[#1A6FA6] underline decoration-2 underline-offset-4 hover:decoration-[3px] disabled:bg-transparent disabled:text-[#5B6878] disabled:no-underline`;

/** Round icon: Listen, plus/minus, microphone. Give it an aria-label. Same blue and outline as the main button. */
export const btnIcon = `${base} ${landing} h-12 w-12 shrink-0 bg-[#1A6FA6] text-lg text-white hover:brightness-110 active:bg-[#155B88]`;
