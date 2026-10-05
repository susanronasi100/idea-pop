/**
 * The one button kit for every challenge page (TEMP rule 18). Four kinds, all
 * round, Challenge blue, the body font, with the same hover/press/focus/disabled
 * states. Pass extra layout classes (w-full, self-center…) after these.
 */
const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-body font-bold transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2';

/** Main action: Next, Let's go, Submit, Check. */
export const btnPrimary = `${base} border-2 border-challenge bg-challenge px-6 py-2.5 text-sm text-white hover:brightness-110`;

/** Second action: Back, Show hint, Try again. */
export const btnSecondary = `${base} border-2 border-challenge bg-white px-6 py-2.5 text-sm text-challenge hover:bg-challenge/10`;

/** Small text action: Skip, I don't know. */
export const btnText = `${base} px-2 py-2 text-sm text-challenge underline-offset-2 hover:underline`;

/** Round icon: Listen, plus/minus, microphone. Give it an aria-label. A raised 3D
 *  button: a lighter top, a darker edge underneath, and it sinks onto the edge when pressed. */
export const btnIcon = `${base} h-11 w-11 shrink-0 bg-gradient-to-b from-[#6CC4F2] to-challenge text-lg text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_4px_0_#1B6FA3,0_7px_12px_rgba(27,111,163,0.35)] hover:brightness-110 active:translate-y-[3px] active:scale-100 active:shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_1px_0_#1B6FA3,0_2px_4px_rgba(27,111,163,0.3)]`;
