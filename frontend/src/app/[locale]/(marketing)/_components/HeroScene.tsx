"use client";

/* eslint-disable @next/next/no-img-element -- full-canvas artwork layers inside one camera-transformed world; their
   native 1670×942 placement is the point, so next/image's resizing does not apply */
import { useEffect, useRef, useState } from "react";

/* The accepted IDEA POP hero animation (the designer's Engineering Specification, "shelf refinement 16 / caption
   refinement 15"), reproduced from her reference runtime in IDEA_POP_Final_Assets/04_Preview:
   a 650ms hold on full-screen nature, then a 3.96s camera pull-back into the classroom, then the subjects fade in
   (deer → sketching boy → middle group → girl → bird → question → papers and graphite marks), 23.45s in all,
   played once. Changed with susan on 2026-10-05: the zoom moves in log space, the landscape photo keeps its on-load size
   (no zoom), and the people, bird and question are lossless. Every layer is a full 1670×942 canvas placed at (0,0) inside one `world` that carries the single
   camera transform. The assets are her 04_Preview PNGs as WebP (same pixels and alpha, smaller files). */

const W = 1670;
const H = 942;
const HOLD_MS = 650;
const DURATION_MS = 22800;
const CAMERA_MS = 3960;
const AIM = { x: 1227, y: 496 };
// bump when the designer delivers corrected artwork, so no browser keeps an older cached copy
const REV = "final-2026-10-06";
const src = (name: string) => `/landing/hero-final/${name}.webp?v=${REV}`;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
const lerp = (a: number, b: number, amount: number) => a + (b - a) * amount;

// Timed opacity fades, in ms after the hold (spec section 5).
const FADES: ReadonlyArray<readonly [id: string, start: number, end: number]> = [
  ["deer", 4136, 6336],
  ["boy", 5280, 7480],
  ["kids", 6424, 8800],
  ["girl", 9000, 11200],
  ["birdBody", 11400, 13400],
  ["birdWing", 11400, 13800],
  ["question", 14000, 15800],
  ["paper1", 16200, 18100],
  ["marks1", 17100, 19200],
  ["paper2", 18300, 20200],
  ["marks2", 18900, 21100],
  ["paper3", 20400, 22300],
  ["marks3", 20400, 22800],
];

// Back to front (spec section 3). `fade` layers start hidden; the rest arrive with the camera.
const LAYERS: ReadonlyArray<{ id: string; file: string; z: number; fade?: boolean; className?: string }> = [
  { id: "classroom", file: "classroom-structure", z: 2 },
  { id: "plants", file: "classroom-plants", z: 3 },
  { id: "props", file: "classroom-props", z: 3 },
  { id: "tree", file: "tree-canopy", z: 3 },
  { id: "bushes", file: "foreground-bushes", z: 4 },
  { id: "deer", file: "deer", z: 4, fade: true },
  { id: "boy", file: "sketching-boy", z: 4, fade: true },
  { id: "kids", file: "kids-group", z: 4, fade: true },
  { id: "table", file: "foreground-table", z: 5 },
  { id: "girl", file: "main-girl", z: 6, fade: true },
  { id: "birdWing", file: "bird-wing-sketch", z: 7, fade: true, className: "hero-sky-art" },
  { id: "paper1", file: "observation-paper-01", z: 7, fade: true, className: "hero-sky-art" },
  { id: "paper2", file: "observation-paper-02", z: 7, fade: true, className: "hero-sky-art" },
  { id: "paper3", file: "observation-paper-03", z: 7, fade: true, className: "hero-sky-art" },
  { id: "birdBody", file: "bird-body", z: 8, fade: true, className: "hero-sky-art" },
  { id: "marks1", file: "motion-sketch-01", z: 9, fade: true, className: "hero-sky-art" },
  { id: "marks2", file: "motion-sketch-02", z: 9, fade: true, className: "hero-sky-art" },
  { id: "marks3", file: "motion-sketch-03", z: 9, fade: true, className: "hero-sky-art" },
  { id: "question", file: "question-text", z: 10, fade: true, className: "hero-question" },
];

export default function HeroScene() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const sceneryRef = useRef<HTMLImageElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const [state, setState] = useState<"preparing" | "ready" | "fallback">("preparing");

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    const scenery = sceneryRef.current;
    const floor = floorRef.current;
    if (!viewport || !world || !scenery || !floor) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // On wide screens the hero copy sits on the wall and fades in with the girl; narrower, it is above the picture.
    const copy = document.querySelector<HTMLElement>("[data-hero-copy]");
    const wide = window.matchMedia("(min-width: 1280px)");
    const showCopy = (opacity: number) => {
      if (!copy) return;
      copy.style.opacity = String(opacity);
      copy.style.visibility = opacity === 0 ? "hidden" : "visible";
    };

    let clock = 0; // accumulated playback time after readiness, ms
    let last: number | null = null;
    let playing = true;
    let ready = false;
    let frame = 0;
    let cancelled = false;

    // Draws every layer from one logical time t (ms after the hold), at the hero box's current size.
    const draw = () => {
      const t = Math.max(0, Math.min(clock - HOLD_MS, DURATION_MS));
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      if (!vw || !vh) return;
      const portrait = vw / vh < 1.1 && vw < 1000;
      const s = portrait ? vw / W : Math.min(vw / W, vh / H);
      const hx = (vw - W * s) / 2;
      const hy = portrait ? 0 : (vh - H * s) / 2;

      // The camera pulls back from deep inside the opening to the finished framing. The zoom moves evenly in log
      // space (a steady dolly, not a lurch at the start) and its target eases toward the artwork point (1227, 496),
      // so the walls and the roof slide past as one room.
      const startZoom = Math.max(3.6, vw / (700 * s), vh / (280 * s)) * 1.04;
      const camera = (e: number) => {
        const zoom = Math.pow(startZoom, 1 - e);
        const scale = s * zoom;
        const cx = lerp(vw / 2, hx + AIM.x * s, e);
        const cy = lerp(vh / 2, hy + AIM.y * s, e);
        return { scale, tx: cx - AIM.x * scale, ty: cy - AIM.y * scale };
      };
      const e = ease(clamp01(t / CAMERA_MS));
      const { scale, tx, ty } = camera(e);
      world.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      // The landscape photograph stays exactly as it is on load (susan, 2026-10-06): it covers the hero box, centred,
      // and never zooms; only the classroom pulls back around it. Covering the whole box also covers the rear opening
      // at every camera position. Its place is converted into world pixels because it lives inside the world.
      const cover = Math.max(vw / 1425, vh / 1104) + 2 / 1104;
      const pw = 1425 * cover;
      const ph = 1104 * cover;
      scenery.style.left = `${((vw - pw) / 2 - tx) / scale}px`;
      scenery.style.top = `${((vh - ph) / 2 - ty) / scale}px`;
      scenery.style.width = `${pw / scale}px`;
      scenery.style.height = `${ph / scale}px`;

      // The floor continues below the artwork only where a portrait box needs it.
      floor.style.height = `${portrait ? Math.max(103, vh / s - 839) : 103}px`;

      for (const [id, start, end] of FADES) {
        const el = layerRefs.current[id];
        if (!el) continue;
        const opacity = ease(clamp01((t - start) / (end - start)));
        el.style.opacity = String(opacity);
        el.style.visibility = opacity === 0 ? "hidden" : "visible";
      }
      showCopy(wide.matches ? ease(clamp01((t - 9000) / 2200)) : 1);
    };

    const finish = () => {
      clock = HOLD_MS + DURATION_MS;
      playing = false;
      draw();
    };

    // One requestAnimationFrame loop and one clock; a stalled frame never advances it by more than 100ms.
    const tick = (now: number) => {
      frame = 0;
      if (last !== null && playing) {
        clock += Math.min(now - last, 100);
        if (clock >= HOLD_MS + DURATION_MS) {
          clock = HOLD_MS + DURATION_MS;
          playing = false;
        }
      }
      last = now;
      draw();
      if (playing) frame = requestAnimationFrame(tick);
    };

    // Resizing or rotating redraws from the current time; it never restarts the playback.
    const resize = new ResizeObserver(() => {
      last = null;
      if (ready) draw();
    });
    resize.observe(viewport);
    const onVisibility = () => {
      last = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onReducedChange = (ev: MediaQueryListEvent) => {
      if (ev.matches && ready) finish();
    };
    reduced.addEventListener("change", onReducedChange);

    // Fetch and decode every layer together before the clock starts, so no partial scene ever flashes.
    const images = [...world.querySelectorAll("img")];
    Promise.all(images.map((img) => img.decode()))
      .then(() => {
        if (cancelled) return;
        ready = true;
        setState("ready");
        if (reduced.matches) finish();
        else {
          draw();
          frame = requestAnimationFrame(tick);
        }
      })
      .catch(() => {
        // An essential layer failed: show the completed Master Hero instead; the copy above stays usable.
        if (cancelled) return;
        setState("fallback");
        showCopy(1);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div ref={viewportRef} aria-hidden="true" className="hero-viewport" data-state={state}>
      <div ref={worldRef} className="hero-world">
        <img className="hero-layer" style={{ zIndex: 0 }} src={src("nature-continuous")} alt="" />
        <div className="hero-scenery">
          <img ref={sceneryRef} className="hero-scenery-image" src={src("nature-background")} alt="" />
        </div>
        {LAYERS.slice(0, 1).map((l) => (
          <img key={l.id} className="hero-layer" style={{ zIndex: l.z }} src={src(l.file)} alt="" />
        ))}
        <div ref={floorRef} className="hero-floor" style={{ backgroundImage: `linear-gradient(165deg, #ead9bc44, #ad956666), url(/landing/hero-final/floor-texture.png?v=${REV})` }} />
        {LAYERS.slice(1).map((l) => (
          <img
            key={l.id}
            ref={(el) => {
              layerRefs.current[l.id] = el;
            }}
            className={`hero-layer ${l.className ?? ""}`}
            style={{ zIndex: l.z, ...(l.fade ? { opacity: 0, visibility: "hidden" } : null) }}
            src={src(l.file)}
            alt=""
          />
        ))}
      </div>
      {state === "fallback" && <img className="hero-fallback" src={src("master-hero")} alt="" />}
    </div>
  );
}
