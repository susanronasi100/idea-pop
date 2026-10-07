"use client";

/* eslint-disable @next/next/no-img-element -- full-canvas artwork layers inside one camera-transformed world; their
   native 1670×942 placement is the point, so next/image's resizing does not apply */
import { useEffect, useRef, useState } from "react";
import { preload } from "react-dom";

/* The accepted IDEA POP hero animation, reproduced from the designer's reference runtime (IDEA_POP_Engineering_Handoff,
   "approved shared camera distance revision 17", 2026-10-06): a 650ms hold on nature at normal viewport cover, then
   one 3.96s camera pull-back in which the near classroom plane and the far landscape share the same camera distance
   and quintic easing (their depths make the parallax), then the subjects fade in (deer → sketching boy → middle group →
   girl → bird → question → papers and graphite marks), 23.45s in all, played once. Every artwork layer is a full
   1670×942 canvas at (0,0) inside one `world`; the landscape is susan's Nature_Damavand_Hero_Safe_v5 (2065×1616,
   reference region at 320,256), drawn in the fixed aperture and behind the room with one far-plane projection. Site tweaks kept from susan: smaller, lower question
   paper; bird and papers lower; the wall copy fades in with the girl; lossless people. */

const W = 1670;
const H = 942;
const HOLD_MS = 650;
const DURATION_MS = 22800;
const CAMERA_MS = 3960;
const AIM = { x: 1227, y: 496 };
// bump when the designer delivers corrected artwork, so no browser keeps an older cached copy
const REV = "damavand-v5";
const src = (name: string) => `/landing/hero-final/${name}.webp?v=${REV}`;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

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
  const natureRef = useRef<HTMLImageElement>(null);
  const layerRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const [state, setState] = useState<"preparing" | "ready" | "fallback">("preparing");
  // The landscape is the first thing on screen: fetch it first, and show it as a still poster while the rest loads.
  preload(src("nature-damavand"), { as: "image", fetchPriority: "high" });

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    const scenery = sceneryRef.current;
    const floor = floorRef.current;
    const nature = natureRef.current;
    if (!viewport || !world || !scenery || !floor || !nature) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // On wide screens the hero copy sits on the wall and fades in with the girl; narrower, it is above the picture.
    const copy = document.querySelector<HTMLElement>("[data-hero-copy]");
    const wide = window.matchMedia("(min-width: 1280px)");
    const showCopy = (opacity: number) => {
      if (!copy) return;
      copy.style.opacity = String(opacity);
      copy.style.visibility = opacity === 0 ? "hidden" : "visible";
    };
    // Wide screens: the nav bar and Sign up button come in once the camera has settled (susan, 2026-10-07).
    const nav = document.querySelector<HTMLElement>('[data-testid="marketing-nav"]');
    const showNav = (opacity: number) => {
      if (!nav) return;
      const o = String(opacity);
      if (nav.style.opacity !== o) nav.style.opacity = o;
      const v = opacity === 0 ? "hidden" : "visible";
      if (nav.style.visibility !== v) nav.style.visibility = v;
    };

    let clock = 0; // accumulated playback time after readiness, ms
    let last: number | null = null;
    let playing = true;
    let ready = false;
    let frame = 0;
    let cancelled = false;
    let lastQ: number | null = null;
    type Layout = {
      vw: number;
      vh: number;
      s: number;
      hx: number;
      hy: number;
      photoScale: number;
      nearStart: number;
      travel: number;
      farDepth: number;
    };
    let L: Layout | null = null;

    // Only write a style when it changes.
    const set = (el: HTMLElement, key: "transform" | "opacity" | "visibility" | "height", value: string) => {
      if (el.style[key] !== value) el.style[key] = value;
    };

    // Layout and camera constants for the hero box (spec section 4), recomputed only when the box resizes.
    const layout = () => {
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      if (!vw || !vh) return false;
      const narrow = vw / vh < W / H;
      const s = narrow ? vw / W : Math.min(vw / W, vh / H);
      const hx = (vw - W * s) / 2;
      const hy = narrow ? 0 : (vh - H * s) / 2;
      const photoScale = Math.max(894 / 1425, 772 / 1104) + 2 / (1104 * s);
      const nearStart = Math.max(4, (2 * vw) / (886 * s), (2 * vh) / (690 * s));
      const coverScale = Math.max(vw / 1425, vh / 1104);
      const farStart = coverScale / (photoScale * s);
      const travel = 1 - 1 / nearStart;
      const farDepth = (farStart * travel) / (farStart - 1);
      L = { vw, vh, s, hx, hy, photoScale, nearStart, travel, farDepth };
      set(floor, "height", `${narrow ? Math.max(103, vh / s - 839) : 103}px`);
      lastQ = null;
      return true;
    };

    // Draws every layer from one logical time t (ms after the hold).
    const draw = () => {
      if (!L) return;
      const t = Math.max(0, Math.min(clock - HOLD_MS, DURATION_MS));
      const q = clamp01(t / CAMERA_MS);
      if (q !== lastQ) {
        // One camera (spec section 5): the near classroom and the far landscape share its distance and easing.
        const e = ease(q);
        const cameraTravel = L.travel * e;
        const nearZoom = 1 / (1 / L.nearStart + cameraTravel);
        const farZoom = L.farDepth / (L.farDepth - L.travel + cameraTravel);
        const dx = L.hx + AIM.x * L.s - L.vw / 2;
        const dy = L.hy + AIM.y * L.s - L.vh / 2;
        const cx = L.vw / 2 + dx * e * nearZoom;
        const cy = L.vh / 2 + dy * e * nearZoom;
        const photoCx = L.vw / 2 + dx * e * farZoom;
        const photoCy = L.vh / 2 + dy * e * farZoom;
        const nearScale = L.s * nearZoom;
        set(world, "transform", `translate3d(${cx - AIM.x * nearScale}px, ${cy - AIM.y * nearScale}px, 0) scale(${nearScale})`);
        // The far plane: one landscape texture (the reference photo region's centre sits at 1032.5, 808), drawn both
        // inside the aperture and behind the room with the same projection, so the scenery around the opening matches.
        const textureScale = (L.photoScale * L.s * farZoom) / nearScale;
        const textureLeft = AIM.x + (photoCx - cx) / nearScale - 1032.5 * textureScale;
        const textureTop = AIM.y + (photoCy - cy) / nearScale - 808 * textureScale;
        set(scenery, "transform", `translate3d(${textureLeft - 780}px, ${textureTop - 110}px, 0) scale(${textureScale})`);
        set(nature, "transform", `translate3d(${textureLeft}px, ${textureTop}px, 0) scale(${textureScale})`);
        lastQ = q;
      }
      for (const [id, start, end] of FADES) {
        const el = layerRefs.current[id];
        if (!el) continue;
        const opacity = ease(clamp01((t - start) / (end - start)));
        set(el, "opacity", String(opacity));
        set(el, "visibility", opacity === 0 ? "hidden" : "visible");
      }
      showCopy(wide.matches ? ease(clamp01((t - 9000) / 2200)) : 1);
      showNav(wide.matches ? ease(clamp01((t - CAMERA_MS) / 600)) : 1);
    };

    const finish = () => {
      clock = HOLD_MS + DURATION_MS;
      playing = false;
      draw();
    };

    // One requestAnimationFrame clock that adds the real time between frames; it pauses while the page is hidden.
    const schedule = () => {
      if (ready && playing && !document.hidden && !frame) frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = null;
    };
    const tick = (now: number) => {
      frame = 0;
      if (!ready || !playing || document.hidden) {
        last = null;
        return;
      }
      if (last !== null) {
        clock += now - last;
        if (clock >= HOLD_MS + DURATION_MS) {
          clock = HOLD_MS + DURATION_MS;
          playing = false;
        }
      }
      last = now;
      draw();
      if (playing) schedule();
      else last = null;
    };

    // Resizing or rotating keeps the current time, recomputes the layout and redraws; it never restarts the entrance.
    const resize = new ResizeObserver(() => {
      last = null;
      if (layout()) draw();
    });
    resize.observe(viewport);
    const onVisibility = () => {
      stop();
      schedule();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onReducedChange = (ev: MediaQueryListEvent) => {
      if (ev.matches && ready) {
        stop();
        finish();
      }
    };
    reduced.addEventListener("change", onReducedChange);

    // Load every layer, then decode it; a decode that never settles gives up after 1.2s (the loaded image is valid).
    const prepare = (img: HTMLImageElement) =>
      (img.complete
        ? img.naturalWidth
          ? Promise.resolve()
          : Promise.reject(new Error(`Image failed: ${img.src}`))
        : new Promise<void>((resolve, reject) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", reject, { once: true });
          })
      ).then(
        () =>
          new Promise<void>((resolve) => {
            const deadline = setTimeout(resolve, 1200);
            const done = () => {
              clearTimeout(deadline);
              resolve();
            };
            img.decode().then(done, done);
          }),
      );
    layout();
    Promise.all([...world.querySelectorAll("img")].map(prepare))
      .then(() => {
        if (cancelled) return;
        ready = true;
        setState("ready");
        layout();
        if (reduced.matches) finish();
        else {
          draw();
          schedule();
        }
      })
      .catch(() => {
        // An essential layer failed: show the completed Master Hero instead; the copy stays usable.
        if (cancelled) return;
        setState("fallback");
        showCopy(1);
        showNav(1);
      });

    return () => {
      cancelled = true;
      stop();
      showNav(1);
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onReducedChange);
    };
  }, []);

  return (
    <div ref={viewportRef} aria-hidden="true" className="hero-viewport" data-state={state}>
      {/* the opening frame (the reference photo region at normal centred cover) until every layer is ready */}
      <div className="hero-poster" style={{ backgroundImage: `url(${src("nature-damavand")})` }} />
      <div ref={worldRef} className="hero-world">
        <img ref={natureRef} className="hero-nature" style={{ zIndex: 0 }} src={src("nature-damavand")} alt="" />
        {/* the fixed rear-opening aperture; the far-plane photograph moves inside it */}
        <div className="hero-scenery">
          <img ref={sceneryRef} className="hero-scenery-image" src={src("nature-damavand")} alt="" />
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
