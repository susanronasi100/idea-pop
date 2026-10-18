"use client";

/* eslint-disable @next/next/no-img-element -- the four registered 1659×1348 bird parts share one origin; the wing
   renderer textures them straight from these elements */
import { useEffect, useRef } from "react";

/* The one flying bird of the landing page (susan's "complete bird motion implementation specification", revision
   "quarter-speed bilateral wings, fixed heading, final left slide and looping hover", IDEA_POP_Motion_Developer_Handoff).
   It starts in the hero, gets smaller past the year and creative-cycle sections, grows into the girl's painting and
   crossfades into the painted bird, leaves again, keeps to the left through curriculum and the mission, crosses right
   before Made by kids, stays right through the lime sections, returns left above the footer, slides a little farther
   left and keeps hovering. Scroll drives the route; the wings flap in time.

   The reference is laid out on a captured 1920×8988 page. Here the native route milestones are mapped onto the real
   sections (section 11 of the spec): each section's top is measured in the document and native Y is converted
   piecewise-linearly between those landmarks. The hero pose is placed on the finished hero artwork and the canvas
   pose on the displayed painting image, so the bird lands exactly on the art at every breakpoint. The articulated wing
   renderer is the handoff's own wing-flight.js, unchanged. */

const BIRD = "/landing/bird/";
const REV = "bird-2026-10-15c";
const ANCHOR = { x: 738, y: 644 };
const WING_SPEED_MULTIPLIER = 0.25;
const ARRIVAL_AT = 8120;
const HOVER = { x: 140, slideMs: 1200, amplitude: 0.85 };
// how far right of the final "Start free" button the bird settles (native px; it arrives 70 further right)
const HOVER_GAP = 180;

// Effective route (spec section 5): focus `at`, native X/Y, sprite scale. Heading and pitch are always zero.
const ROUTE = [
  { at: 387, x: 1418, y: 387, scale: 0.369 },
  { at: 1450, x: 1780, y: 1450, scale: 0.17 },
  { at: 1990, x: 1680, y: 1990, scale: 0.2 },
  { at: 2450, x: 815, y: 2595, scale: 0.7 },
  { at: 2600, x: 815, y: 2595, scale: 0.7 },
  { at: 3000, x: 815, y: 2595, scale: 0.7 },
  { at: 3150, x: 350, y: 3140, scale: 0.3 },
  { at: 3360, x: 180, y: 3360, scale: 0.18 },
  { at: 3880, x: 160, y: 3880, scale: 0.17 },
  // susan, 2026-10-18: in the mission the bird flies into the kingfisher sketch on the boy's paper in the "Try one
  // mission" photo, fades into it like the painting, rests, then flies out right to Made by kids. Positions and the
  // exact focus window are measured from the photo (MISSION_ART); these rows are placeholders in route order.
  { at: 4400, x: 0, y: 0, scale: 0, mission: "land" },
  { at: 4500, x: 0, y: 0, scale: 0, mission: "slid" },
  { at: 4700, x: 0, y: 0, scale: 0, mission: "leave" },
  { at: 5217, x: 1740, y: 5217, scale: 0.17 },
  { at: 5950, x: 1750, y: 5950, scale: 0.17 },
  { at: 6500, x: 1740, y: 6500, scale: 0.16 },
  { at: 7050, x: 1760, y: 7050, scale: 0.16 },
  { at: 7550, x: 1740, y: 7550, scale: 0.16 },
  { at: 7780, x: 1740, y: 7780, scale: 0.16 },
  { at: ARRIVAL_AT, x: 210, y: ARRIVAL_AT, scale: 0.17 },
];

// Where each real section starts on the captured reference page (native Y), and how to find it in the real DOM.
const LANDMARKS: ReadonlyArray<readonly [nativeY: number, selector: string]> = [
  [0, '[data-scroll-timeline="hero"]'],
  [1083, 'section[aria-label="what a year looks like"]'],
  [1674, 'section[aria-label="how it works"]'],
  [2217, 'section[aria-label="paint together"]'],
  [3237, 'section[aria-label="curriculum"]'],
  [4190, 'section[aria-label="try a mission"]'],
  [5220, 'section[aria-label="made by kids"]'],
  [5602, 'section[aria-label="experts"]'],
  [6007, 'section[aria-label="pricing"]'],
  [6750, 'section[aria-label="questions parents ask"]'],
  [7866, 'section[aria-label="start for free"]'],
  [8254, "footer"],
];
const NATIVE_HEIGHT = 8988;

// The hero pose on the 1670×942 hero artwork: the reference hero is that artwork stretched to 1920×1083 (×1.14970),
// lowered 40 artwork px as susan asked for the bird and papers.
const HERO_ART = { x: 1418 / 1.1497, y: 387 / 1.1497 + 40, scale: 0.369 / 1.1497 };
// The canvas docking pose on the 1720×914 painting image (the reference shows it at 1920×1020, ×1.11628).
// The roof of the cardboard kingfisher train in the "Try one mission" photo (1670×942): the bird lands on it.
const MISSION_ART = { x: 1121, y: 470, scale: 0.3, w: 1670 };
// susan, 2026-10-18: after landing (lower on the train) the bird slides left along it, then disappears there
const MISSION_SLIDE = { x: 930, y: 505 };
const CANVAS_ART = { x: 815 / 1.11628, y: (2595 - 2217) / 1.11628, scale: 0.7 / 1.11628 };
const PAINT = { w: 1720, h: 914 };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function paintRevealFor(f: number) {
  if (f <= 2350 || f >= 3300) return 0;
  if (f < 2500) return smoothstep(2350, 2500, f);
  if (f <= 3000) return 1;
  return 1 - smoothstep(3000, 3300, f);
}

type Wings = {
  ready: Promise<unknown>;
  update: (o: { timeSeconds: number; amplitude: number; resting: boolean; pixelScale: number; flapRateHz: number }) => {
    phase?: number;
  };
  destroy: () => void;
};
declare global {
  interface Window {
    IdeaPopWingFlight?: new (host: HTMLElement) => Wings;
  }
}

// Loads the handoff's wing renderer once (a plain script that defines window.IdeaPopWingFlight).
let wingScript: Promise<void> | null = null;
function loadWingScript() {
  if (window.IdeaPopWingFlight) return Promise.resolve();
  wingScript ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${BIRD}wing-flight.js?v=${REV}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("wing renderer did not load"));
    document.head.appendChild(s);
  });
  return wingScript;
}

// The displayed rectangle of an object-fit: cover image (scale and top-left of the full picture), in document px.
function coverRect(img: HTMLImageElement, w: number, h: number) {
  const r = img.getBoundingClientRect();
  const k = Math.max(r.width / w, r.height / h);
  const [px, py] = getComputedStyle(img)
    .objectPosition.split(" ")
    .map((v) => (v.endsWith("%") ? parseFloat(v) / 100 : 0.5));
  return {
    k,
    left: r.left + window.scrollX + (r.width - w * k) * (px ?? 0.5),
    top: r.top + window.scrollY + (r.height - h * k) * (py ?? 0.5),
  };
}

export default function FlyingBird() {
  const birdRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bird = birdRef.current;
    if (!bird) return;
    const tail = bird.querySelector<HTMLElement>(".tail");
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQuery.matches;

    type Point = { at: number; X: number; Y: number; S: number };
    let geo: {
      g: number;
      lead: number;
      maxScroll: number;
      native: number[];
      doc: number[];
      route: Point[];
      mission: { land: number; leave: number };
      arrivalY: number;
      arrivalX: number;
      settleX: number;
    } | null = null;
    let needsMeasure = true;
    let frame = 0;
    let lastTime = 0;
    let lastFocus = ROUTE[0].at;
    let amplitude = 0.65;
    let hoverStartedAt: number | null = null;
    let wings: Wings | null = null;
    let cancelled = false;

    // native page Y → document Y and back, piecewise-linear between the measured section tops
    const toDoc = (y: number) => {
      const { native, doc } = geo!;
      let i = 0;
      while (i < native.length - 2 && y > native[i + 1]) i++;
      return mix(doc[i], doc[i + 1], (y - native[i]) / (native[i + 1] - native[i]));
    };
    const toNative = (y: number) => {
      const { native, doc } = geo!;
      let i = 0;
      while (i < doc.length - 2 && y > doc[i + 1]) i++;
      return mix(native[i], native[i + 1], (y - doc[i]) / Math.max(1e-6, doc[i + 1] - doc[i]));
    };

    const measure = () => {
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      const g = vw / 1920;
      const native: number[] = [];
      const doc: number[] = [];
      for (const [n, sel] of LANDMARKS) {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (doc.length && top <= doc[doc.length - 1]) continue; // keep the map monotonic
        native.push(n);
        doc.push(top);
      }
      native.push(NATIVE_HEIGHT);
      doc.push(Math.max(document.documentElement.scrollHeight, (doc[doc.length - 1] ?? 0) + 1));
      if (native.length < 2) return false;
      geo = { g, lead: Math.min(vh * 0.38, 300 * g), maxScroll: Math.max(0, document.documentElement.scrollHeight - vh), native, doc, route: [], mission: { land: 4400, leave: 4700 }, arrivalY: 0, arrivalX: 0, settleX: 0 };

      // the hero pose on the finished hero artwork
      const heroVp = document.querySelector<HTMLElement>(".hero-viewport");
      const heroPose = (() => {
        if (!heroVp?.dataset.artS) return null;
        const r = heroVp.getBoundingClientRect();
        const s = Number(heroVp.dataset.artS);
        const left = r.left + window.scrollX + Number(heroVp.dataset.artHx);
        const top = r.top + window.scrollY + Number(heroVp.dataset.artHy);
        return { X: left + HERO_ART.x * s, Y: top + HERO_ART.y * s, S: HERO_ART.scale * s };
      })();
      // the mission docking pose on the displayed photo, and the focus window while that spot is mid-screen
      const missionImg = document.querySelector<HTMLImageElement>("[data-bird-mission]");
      const missionPose = (() => {
        if (!missionImg) return null;
        const r = missionImg.getBoundingClientRect();
        const k = r.width / MISSION_ART.w;
        const X = r.left + window.scrollX + MISSION_ART.x * k;
        const Y = r.top + window.scrollY + MISSION_ART.y * k;
        // land when the spot sits at 55% of the screen; the bird rests for ~30% of a screen of scrolling
        const land = clamp(toNative(Y - vh * 0.55 + geo!.lead), 4100, 5000);
        // the bird arrives on the spot 140 focus units early and fades out there, so it melts into it in place
        const leave = clamp(toNative(Y - vh * 0.25 + geo!.lead), land + 40, 5000);
        const SX = r.left + window.scrollX + MISSION_SLIDE.x * k;
        const SY = r.top + window.scrollY + MISSION_SLIDE.y * k;
        return { X, Y, SX, SY, S: MISSION_ART.scale * k, land, leave };
      })();
      geo.mission = missionPose ? { land: missionPose.land, leave: missionPose.leave } : { land: 4400, leave: 4700 };
      // the canvas docking pose on the displayed painting image
      const paintImg = document.querySelector<HTMLImageElement>("[data-bird-canvas]");
      const canvasPose = (() => {
        if (!paintImg) return null;
        const c = coverRect(paintImg, PAINT.w, PAINT.h);
        return { X: c.left + CANVAS_ART.x * c.k, Y: c.top + CANVAS_ART.y * c.k, S: CANVAS_ART.scale * c.k };
      })();
      geo.route = ROUTE.map((p) => {
        if (p.at === 387 && heroPose) return { at: p.at, ...heroPose };
        if (p.at >= 2450 && p.at <= 3000 && canvasPose) return { at: p.at, ...canvasPose };
        if ("mission" in p && missionPose) {
          // land at the first spot, slide left to the second, fade out there (and back in, and away, from there)
          if (p.mission === "land") return { at: missionPose.land - 200, X: missionPose.X, Y: missionPose.Y, S: missionPose.S };
          if (p.mission === "slid") return { at: missionPose.land - 70, X: missionPose.SX, Y: missionPose.SY, S: missionPose.S };
          return { at: missionPose.leave + 140, X: missionPose.SX, Y: missionPose.SY, S: missionPose.S };
        }
        if ("mission" in p) return { at: p.at, X: 180 * g, Y: toDoc(p.at), S: 0.17 * g };
        return { at: p.at, X: p.x * g, Y: toDoc(p.y), S: p.scale * g };
      });
      // The ending. On the real page the final lime is not on screen at the bottom (the CTA panel straddles the
      // footer), so the bird hovers in the open green beside the "Start free" button instead of on top of it: it
      // arrives 250 native px right of the button and slides the spec's 70 native px left, at the button's height.
      const cta = document.querySelector<HTMLElement>('section[aria-label="start for free"] a');
      if (cta) {
        const c = cta.getBoundingClientRect();
        // keep the hover on screen at the bottom of the page (on phones the button scrolls away above the footer)
        geo.arrivalY = clamp(c.top + window.scrollY + c.height / 2, geo.maxScroll + vh * 0.2, geo.maxScroll + vh * 0.8);
        geo.arrivalX = c.right + window.scrollX + (HOVER_GAP + 70) * g;
        geo.settleX = c.right + window.scrollX + HOVER_GAP * g;
      } else {
        geo.arrivalY = toDoc(ARRIVAL_AT);
        geo.arrivalX = ROUTE[ROUTE.length - 1].x * g;
        geo.settleX = HOVER.x * g;
      }
      geo.route[geo.route.length - 1] = { ...geo.route[geo.route.length - 1], X: geo.arrivalX, Y: geo.arrivalY };
      needsMeasure = false;
      return true;
    };

    const poseAt = (focus: number) => {
      const r = geo!.route;
      if (focus <= r[0].at) return r[0];
      if (focus >= r[r.length - 1].at) return r[r.length - 1];
      let i = 0;
      while (r[i + 1].at < focus) i++;
      const a = r[i];
      const b = r[i + 1];
      const t = smoothstep(a.at, b.at, focus);
      const vt = focus >= 3360 ? clamp((focus - a.at) / (b.at - a.at), 0, 1) : t;
      return { at: focus, X: mix(a.X, b.X, t), Y: mix(a.Y, b.Y, vt), S: mix(a.S, b.S, t) };
    };

    const render = (now: number) => {
      if (needsMeasure && !measure()) return;
      const G = geo!;
      const dt = lastTime ? clamp((now - lastTime) / 1000, 0, 0.05) : 0;
      lastTime = now;
      const scroll = window.scrollY;

      // scroll focus in native units, with the spec's intro blend and final-pixel correction
      const cameraFocus = toNative(scroll + G.lead);
      const introDistance = Math.min(240, Math.max(80, window.innerHeight * 0.2));
      const raw = mix(ROUTE[0].at, cameraFocus, smoothstep(0, introDistance, scroll));
      const finalFocus = toNative(G.maxScroll + G.lead);
      const correctionStart = Math.max(G.maxScroll * 0.8, Math.min(G.maxScroll - 1, toDoc(3300) - G.lead));
      const correction =
        G.maxScroll > 0 ? smoothstep(correctionStart, G.maxScroll, scroll) * Math.max(0, ARRIVAL_AT - finalFocus) : 0;
      const f = G.maxScroll > 0 && scroll >= G.maxScroll - 1 ? Math.max(ARRIVAL_AT, raw + correction) : raw + correction;

      const pose = poseAt(f);
      const canvasHold = f >= 2500 && f <= 3000;
      const M = G.mission;
      const missionHold = f >= M.land && f <= M.leave;
      const missionFade = missionHold ? 1 : f > M.land - 70 && f < M.land ? smoothstep(M.land - 70, M.land, f) : f > M.leave && f < M.leave + 120 ? 1 - smoothstep(M.leave, M.leave + 120, f) : 0;
      const reveal = paintRevealFor(f);
      // the bird first appears with the hero animation's bird; past the hero it is always on its route
      const heroVp = document.querySelector<HTMLElement>(".hero-viewport");
      const heroIn = Math.max(Number(heroVp?.dataset.birdIn ?? 1), smoothstep(400, 900, f));
      const opacity = (1 - missionFade) * (canvasHold ? 0 : f > 2350 && f < 2500 ? 1 - reveal : f > 3000 && f < 3300 ? 1 - reveal : 1) * heroIn;

      const terminal = f >= ARRIVAL_AT;
      if (terminal && hoverStartedAt === null) hoverStartedAt = now;
      if (!terminal) hoverStartedAt = null;
      const hoverElapsed = terminal ? now - hoverStartedAt! : 0;
      const slide = terminal ? (reduced ? 1 : smoothstep(0, HOVER.slideMs, hoverElapsed)) : 0;

      const resting = reduced || canvasHold || missionHold;
      const speed = dt && Math.abs(f - lastFocus) < 650 ? Math.abs(f - lastFocus) / dt : 0;
      const rate = (f < 900 ? 7.2 : 7.8 + clamp(speed / 1800, 0, 1) * 0.8) * WING_SPEED_MULTIPLIER;
      let target = f < 900 ? 0.65 : 1;
      if (f > 2200 && f < 2500) target *= 1 - smoothstep(2200, 2500, f);
      if (f > 3000 && f < 3400) target *= smoothstep(3000, 3400, f);
      if (f > 7850) target *= mix(1, HOVER.amplitude, smoothstep(7850, ARRIVAL_AT, f));
      amplitude = resting ? 0 : mix(amplitude, target, 1 - Math.exp(-dt / 0.13));
      const bob = terminal ? Math.sin((hoverElapsed / 1000) * 1.65) * 8 * smoothstep(0, 600, hoverElapsed) : 0;
      const drift = resting ? 0 : (Math.sin((now / 1000) * 1.45) * 3 + Math.sin((now / 1000) * 2.13 + 0.8) + bob) * amplitude;

      const X = terminal ? mix(G.arrivalX, G.settleX, slide) : pose.X;
      const Y = (terminal ? G.arrivalY : pose.Y) + drift * G.g;
      const S = pose.S;
      bird.style.transform = `translate3d(${(X - window.scrollX).toFixed(2)}px,${(Y - scroll).toFixed(2)}px,0) scale(${S.toFixed(5)}) translate(${-ANCHOR.x}px,${-ANCHOR.y}px)`;
      bird.style.opacity = opacity.toFixed(4);
      bird.style.visibility = opacity < 0.001 ? "hidden" : "visible";

      const state = wings?.update({ timeSeconds: now / 1000, amplitude, resting, pixelScale: S, flapRateHz: rate });
      if (tail) {
        const deg = resting ? 0 : Math.sin((state?.phase ?? 0) * Math.PI * 2 - 0.65) * 3 * amplitude;
        tail.style.transform = `rotateZ(${deg.toFixed(3)}deg)`;
      }
      document.documentElement.style.setProperty("--painted-reveal", reveal.toFixed(4));
      lastFocus = f;
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      render(now);
    };
    const remeasure = () => {
      needsMeasure = true;
    };

    // Draw once the wing renderer is ready (its images are decoded); without it the bird still flies, unflapped.
    loadWingScript()
      .then(() => {
        if (cancelled || !window.IdeaPopWingFlight) return;
        wings = new window.IdeaPopWingFlight(bird);
        return wings.ready;
      })
      .catch(() => {
        wings = null;
      })
      .finally(() => {
        if (cancelled) return;
        bird.dataset.ready = "";
        frame = requestAnimationFrame(tick);
      });

    const ro = new ResizeObserver(remeasure);
    ro.observe(document.body);
    window.addEventListener("resize", remeasure, { passive: true });
    window.addEventListener("load", remeasure);
    document.fonts?.ready.then(remeasure);
    const onReduced = () => {
      reduced = reducedQuery.matches;
    };
    reducedQuery.addEventListener("change", onReduced);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("load", remeasure);
      reducedQuery.removeEventListener("change", onReduced);
      wings?.destroy();
      document.documentElement.style.removeProperty("--painted-reveal");
    };
  }, []);

  const part = (cls: string, file: string) => (
    <img className={`part ${cls}`} src={`${BIRD}${file}.webp?v=${REV}`} width={1659} height={1348} alt="" />
  );
  return (
    <div ref={birdRef} className="flying-bird" aria-hidden="true">
      {part("far-wing", "bird-wing-far")}
      {part("tail", "bird-tail")}
      {part("body", "bird-body")}
      {part("near-wing", "bird-wing-near")}
    </div>
  );
}
