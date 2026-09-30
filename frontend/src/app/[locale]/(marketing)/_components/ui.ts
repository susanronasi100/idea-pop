/* The marketing pages' shared kit: the two buttons from the UI kit and the small text and motion helpers.
   Kept in one place so the landing page and The Method (and later pages) stay identical. */

// Headings never end on a lone word on narrow screens: the last two words are joined with a no-break space,
// and the brand name never splits either.
export const keepTogether = (text: string) =>
  text.replace(/Idea Pop/g, "Idea Pop").replace(/\s+(\S+)\s*$/, " $1");

/* Motion (motion.css): data-intro plays on load, data-reveal the first time a block scrolls into view, data-scroll moves
   with the scrollbar. motionDelay staggers an entrance; fromCenter orders a row from its middle outward (0 for the
   centre item or pair, then 1, 2 …), so rows open from the centre. */
export const motionDelay = (ms: number) => ({ "--motion-delay": `${ms}ms` }) as React.CSSProperties;
export const fromCenter = (i: number, count: number) => Math.floor(Math.abs(i - (count - 1) / 2));

/* Where a page's heading starts: clear of the nav's circle, which hangs below the pill, and one line shared by the
   pages that open on a heading (The Method, Pricing, For Teachers) so their headings sit at the same height. */
export const pageTop = "pt-[clamp(8.5rem,6rem+5vw,11rem)]";

// The big photo under a page's heading (The Method, For Teachers): rounded corners and a soft shadow.
/* One card style for the marketing pages, from the landing's "What a year looks like" cards: 20px corners and the
   Figma default drop shadow; a lime card also carries a 1px #D1EF5A edge (an inset shadow, so it adds no size). */
export const cardShape = "rounded-[20px] shadow-[0_4px_4px_rgba(0,0,0,0.25)]";
export const cardShapeLime = "rounded-[20px] shadow-[inset_0_0_0_1px_#D1EF5A,0_4px_4px_rgba(0,0,0,0.25)]";

export const pagePhoto = "rounded-[20px] md:rounded-[28px] shadow-[0_6px_18px_rgba(0,0,0,0.18)]";

/* The button kit lives with the rest of the shared UI now, so signing up and logging in wear the same two
   buttons as the marketing pages. Re-exported here so every page that already imports them is unchanged. */
export { btnLime, btnGlass } from "@/components/ui/kit";
import { btnGlass } from "@/components/ui/kit";
export const btnGlassOnDark = btnGlass.replace("text-[#146047]", "text-[#0E3B2C]");
