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

/** Round icon: Listen, plus/minus, microphone. Give it an aria-label. */
export const btnIcon = `${base} h-10 w-10 shrink-0 bg-challenge text-lg text-white shadow-[0_2px_6px_rgba(45,156,219,0.4)] hover:brightness-110`;
