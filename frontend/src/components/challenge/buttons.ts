/**
 * The one button kit for every challenge page (TEMP rules 18, 25, 26). Four kinds, all
 * round and in Challenge blue, with the same type as every other CTA on the site (the
 * display face, bold). Built for readability and accessibility:
 * - 16px text with a little letter-spacing, and no arrow icons: the words say where it goes.
 * - At least 48px tall (icon buttons 48×48): an easy target for small fingers (WCAG 2.5.5).
 * - Colours pass WCAG AA: white on Challenge blue is 5.0:1, blue on white the same.
 * - A thick dark focus ring for keyboard users, visible on white and on the blue page.
 * - Disabled is a solid grey with readable text, not a faded copy that looks broken.
 * - A raised 3D edge that sinks when pressed, so a tap visibly "clicks".
 * Pass extra layout classes (w-full, self-center…) after these.
 */
const base =
  'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-pill text-center font-display text-base font-bold leading-tight tracking-[0.02em] transition-[transform,box-shadow,background-color,filter] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1B3A6B] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed';

const raised =
  'active:translate-y-[3px] active:shadow-none disabled:translate-y-0 disabled:border-[#C9D3DE] disabled:bg-[#C9D3DE] disabled:text-[#3F4E61] disabled:shadow-none disabled:hover:brightness-100';

/** Main action: Next, Let's go, Submit, Check. */
export const btnPrimary = `${base} ${raised} border-2 border-challenge bg-challenge px-7 py-2.5 text-white shadow-[0_3px_0_#0F4F7A] hover:brightness-110`;

/** Second action: Back, Show hint, Try again. */
export const btnSecondary = `${base} ${raised} border-2 border-challenge bg-white px-7 py-2.5 text-challenge shadow-[0_3px_0_#1a6fa6] hover:bg-[#EAF5FC]`;

/** Small text action: Skip, I don't know. Underlined, so it reads as a link without relying on colour. */
export const btnText = `${base} !font-body px-3 py-2 text-challenge underline decoration-2 underline-offset-4 hover:decoration-[3px] disabled:text-[#5B6878] disabled:no-underline`;

/** Round icon: Listen, plus/minus, microphone. Give it an aria-label. A raised 3D
 *  button: a lighter top, a darker edge underneath, and it sinks onto the edge when pressed. */
export const btnIcon = `${base} h-12 w-12 shrink-0 bg-gradient-to-b from-[#3E95CC] to-challenge text-lg text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_4px_0_#0F4F7A,0_7px_12px_rgba(15,79,122,0.3)] hover:brightness-110 active:translate-y-[3px] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_1px_0_#0F4F7A]`;
