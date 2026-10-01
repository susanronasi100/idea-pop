/**
 * How a line of story is spoken: the browser's speech ignores SSML, so a storyteller's
 * rhythm comes from reading the text in breath-sized phrases, with a short rest after
 * each one and small, deliberate changes of pace and tone.
 *
 * - Commas: a light breath. Sentences: a fuller rest.
 * - "…": the story leans in (a slower phrase, a longer rest before what comes next).
 * - Questions: a little brighter and slower, then room for the child to think.
 * - Exclamations: a touch quicker and brighter, never shouted.
 * - A tiny, fixed wobble in pace from phrase to phrase, so it never sounds metronomic.
 * Words are never changed, only how they are delivered.
 */

export interface NarrationPhrase {
  text: string;
  /** Speech rate (1 = the voice's normal speed). */
  rate: number;
  /** Speech pitch (1 = the voice's normal pitch). */
  pitch: number;
  /** Silence after this phrase, in ms. */
  pauseAfter: number;
}

/** The storyteller's resting pace: about the voice's normal speed, so it never drags. */
const BASE_RATE = 0.97;
const BASE_PITCH = 1.03;

// Rests, in ms, after each kind of boundary.
const PAUSE = {
  comma: 170,
  breath: 140,
  colon: 300,
  sentence: 380,
  ellipsis: 520,
  question: 700,
  exclaim: 420,
  end: 0,
} as const;

/** Phrases shorter than this (in characters) are joined with the next one rather than read alone. */
const MIN_PHRASE = 14;

/** A phrase longer than this gets one quiet breath at a natural joint near its middle. */
const LONG_PHRASE = 70;
// Words a storyteller naturally breathes before (English and Persian).
const JOINTS = /\s(who|which|because|and|but|so|when|while|at the|right at|که|چون|و|اما|وقتی)\s/gi;

/** Splits one long phrase into two at the joint closest to its middle; short ones stay whole. */
function breathe(p: { text: string; boundary: Boundary }): { text: string; boundary: Boundary }[] {
  if (p.text.length <= LONG_PHRASE) return [p];
  const mid = p.text.length / 2;
  let best = -1;
  for (const m of p.text.matchAll(JOINTS)) {
    const at = m.index ?? -1;
    if (at > 20 && p.text.length - at > 20 && (best < 0 || Math.abs(at - mid) < Math.abs(best - mid))) best = at;
  }
  if (best < 0) return [p];
  return [
    { text: p.text.slice(0, best).trim(), boundary: 'breath' },
    { text: p.text.slice(best).trim(), boundary: p.boundary },
  ];
}

// A small, fixed variation in pace, cycled across phrases (no randomness: the same line
// always sounds the same).
const WOBBLE = [0, 0.02, -0.015, 0.01, -0.02, 0.015];

type Boundary = keyof typeof PAUSE;

/** Splits a line into phrases, each ending at a natural boundary (Latin and Persian punctuation). */
function split(text: string): { text: string; boundary: Boundary }[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  const parts: { text: string; boundary: Boundary }[] = [];
  // Ellipses (… or ...), sentence ends, question marks (? ؟), colons, semicolons, dashes, commas (, ،).
  const re = /(…|\.\.\.|[.!?؟]+["»”']?|[:;]|\s[—–]\s|[,،])\s*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const end = m.index + m[0].length;
    const piece = clean.slice(last, end).trim();
    last = end;
    if (!piece) continue;
    const mark = m[1].trim();
    const boundary: Boundary =
      mark === '…' || mark === '...'
        ? 'ellipsis'
        : /[?؟]/.test(mark)
          ? 'question'
          : /!/.test(mark)
            ? 'exclaim'
            : /[.]/.test(mark)
              ? 'sentence'
              : /[:;—–]/.test(mark)
                ? 'colon'
                : 'comma';
    parts.push({ text: piece, boundary });
  }
  const rest = clean.slice(last).trim();
  if (rest) parts.push({ text: rest, boundary: 'end' });

  // Join very short phrases onto the next, but only across light (comma) boundaries,
  // so "Max, a student" is not chopped into two breaths.
  const merged: { text: string; boundary: Boundary }[] = [];
  for (const p of parts) {
    const prev = merged[merged.length - 1];
    if (prev && prev.boundary === 'comma' && prev.text.length < MIN_PHRASE) {
      prev.text = `${prev.text} ${p.text}`;
      prev.boundary = p.boundary;
    } else {
      merged.push({ ...p });
    }
  }
  return merged.flatMap(breathe);
}

/** Turns a line of narration into phrases with their pace, tone and following rest. */
export function planNarration(text: string): NarrationPhrase[] {
  const phrases = split(text);
  return phrases.map((p, i) => {
    let rate = BASE_RATE + WOBBLE[i % WOBBLE.length];
    let pitch = BASE_PITCH;
    switch (p.boundary) {
      case 'ellipsis':
        rate -= 0.06; // leaning in
        pitch -= 0.02;
        break;
      case 'question':
        rate -= 0.03; // genuinely curious
        pitch += 0.07;
        break;
      case 'exclaim':
        rate += 0.05; // a little lift, not a shout
        pitch += 0.06;
        break;
    }
    // The very last phrase settles down softly.
    const isLast = i === phrases.length - 1;
    if (isLast && p.boundary !== 'question' && p.boundary !== 'exclaim') rate -= 0.02;
    return {
      text: p.text,
      rate: Math.round(rate * 100) / 100,
      pitch: Math.round(pitch * 100) / 100,
      pauseAfter: isLast ? 0 : PAUSE[p.boundary],
    };
  });
}

/** Joins narration segments (e.g. a story beat and its sentence) with a breath between them. */
export function joinSegments(segments: (string | null | undefined)[]): string {
  return segments
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .map((s) => (/[.!?…؟:]["»”']?$/.test(s) ? s : `${s}.`))
    .join(' ');
}
