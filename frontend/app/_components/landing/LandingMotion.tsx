"use client";

import { useEffect } from "react";

/*
 * Scroll motion for the landing page. Renders nothing.
 *
 * - gsap, ScrollTrigger and lenis load only here, after hydration, through
 *   dynamic import(), so no other page (and no server HTML) carries them.
 * - Every scene's HTML is its finished end state. Animations are gsap.from()
 *   tweens, so without JavaScript, before this runs, or under
 *   prefers-reduced-motion: reduce, the visitor sees the complete still scene.
 * - Wide and tall screens: Lenis smooth scroll and pinned, scroll-scrubbed scenes.
 * - Phones and short screens: no pins and no Lenis; each group appears once as
 *   it enters the viewport.
 * - Nothing loops. gsap.matchMedia reverts everything when a query stops
 *   matching (for example when reduced motion is switched on).
 */

const HEADER = 64; // h-16 sticky header

const NO_PREF = "(prefers-reduced-motion: no-preference)";
const WIDE = `(min-width: 768px) and (min-height: 640px) and ${NO_PREF}`;
const NARROW = `(max-width: 767.98px) and ${NO_PREF}, (max-height: 639.98px) and ${NO_PREF}`;

type Gsap = typeof import("gsap").gsap;

function all(root: ParentNode, sel: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(sel));
}

function one(root: ParentNode, sel: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(sel);
}

function claimPinned(gsap: Gsap) {
  const root = one(document, '[data-scene="claim"]');
  const stage = root && one(root, "[data-stage]");
  if (!root || !stage) return;
  const scan = one(root, "[data-scan]");
  const img = one(root, '[data-step="receipt"] img');
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: stage,
      start: `top ${HEADER}px`,
      end: "+=1800",
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });
  if (scan && img) {
    tl.fromTo(scan, { y: 0, opacity: 1 }, { y: () => img.offsetHeight - 2, duration: 2 }, 0).to(scan, {
      opacity: 0,
      duration: 0.3,
    });
  }
  tl.from(all(root, '[data-step="read"] dd'), { opacity: 0, x: 12, stagger: 0.35, duration: 0.4 }, 0.5)
    .from(one(root, '[data-step="checks"]'), { opacity: 0.25, duration: 0.3 }, 2.2)
    .from(all(root, "[data-tick]"), { opacity: 0, scale: 0, stagger: 0.3, duration: 0.3 }, 2.4)
    .from(one(root, '[data-step="lane"]'), { opacity: 0.25, duration: 0.4 }, 4.4)
    .from(one(root, '[data-step="paid"]'), { opacity: 0.25, y: 16, duration: 0.6 }, 5.2)
    .to({}, { duration: 0.6 });
}

function liedPinned(gsap: Gsap) {
  const root = one(document, '[data-scene="lied"]');
  const stage = root && one(root, "[data-stage]");
  if (!root || !stage) return;
  gsap
    .timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: stage,
        start: `top ${HEADER}px`,
        end: "+=1400",
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
      },
    })
    .to({}, { duration: 0.6 })
    .from(one(root, "[data-mark]"), { opacity: 0, scale: 1.25, duration: 0.6 })
    .fromTo(one(root, '[data-step="found"]'), { opacity: 0.2 }, { opacity: 1, duration: 0.5 }, "<0.2")
    .fromTo(one(root, '[data-step="route"]'), { opacity: 0.2 }, { opacity: 1, duration: 0.5 }, "+=0.5")
    .from(all(root, "[data-reviewer]"), { opacity: 0, x: -16, stagger: 0.3, duration: 0.5 }, "<")
    .fromTo(one(root, '[data-step="employee"]'), { opacity: 0.2 }, { opacity: 1, duration: 0.5 }, "+=0.5")
    .to({}, { duration: 0.6 });
}

function diagramScrub(gsap: Gsap) {
  const svg = one(document, "[data-diagram]");
  if (!svg) return;
  const nodes = all(svg, "[data-node]");
  const edges = all(svg, "[data-edge]");
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: svg, start: "top 80%", end: "bottom 45%", scrub: 0.5 },
  });
  edges.forEach((edge, i) => {
    tl.from(one(edge, "path"), { strokeDashoffset: 1, duration: 1 }).from(all(edge, "[data-head]"), {
      opacity: 0,
      duration: 0.2,
    });
    const next = nodes[i + 1];
    if (next) tl.fromTo(next, { opacity: 0.25 }, { opacity: 1, duration: 0.3 }, "<");
  });
}

// Short stacked sequences: each group appears once as it scrolls in.
function revealOnce(gsap: Gsap, targets: (HTMLElement | null)[]) {
  targets.forEach((el) => {
    if (!el) return;
    gsap.from(el, {
      opacity: 0,
      y: 16,
      duration: 0.5,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%", once: true },
    });
  });
}

function sequences(gsap: Gsap) {
  const claim = one(document, '[data-scene="claim"]');
  if (claim) {
    revealOnce(gsap, ["receipt", "read", "checks", "lane", "paid"].map((s) => one(claim, `[data-step="${s}"]`)));
  }
  const lied = one(document, '[data-scene="lied"]');
  if (lied) {
    revealOnce(gsap, ["found", "route", "employee"].map((s) => one(lied, `[data-step="${s}"]`)));
    const mark = one(lied, "[data-mark]");
    if (mark) {
      gsap.from(mark, {
        opacity: 0,
        scale: 1.25,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: { trigger: mark, start: "top 75%", once: true },
      });
    }
  }
}

function stopsList(gsap: Gsap) {
  const stops = one(document, '[data-scene="stops"]');
  if (stops) revealOnce(gsap, all(stops, "ol [data-row]"));
}

export default function LandingMotion() {
  useEffect(() => {
    let disposed = false;
    let teardown: (() => void) | undefined;

    (async () => {
      // Under reduced motion nothing is loaded at all: the page is already in its end state.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);

      const mm = gsap.matchMedia();

      mm.add(WIDE, () => {
        const lenis = new Lenis({ anchors: { offset: -HEADER } });
        lenis.on("scroll", ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        claimPinned(gsap);
        liedPinned(gsap);
        diagramScrub(gsap);
        stopsList(gsap);

        return () => {
          gsap.ticker.remove(tick);
          gsap.ticker.lagSmoothing(500, 33);
          lenis.destroy();
        };
      });

      mm.add(NARROW, () => {
        sequences(gsap);
        stopsList(gsap);
      });

      // Web fonts can change text heights after load; re-measure pins once.
      document.fonts?.ready.then(() => {
        if (!disposed) ScrollTrigger.refresh();
      });

      teardown = () => mm.revert();
    })();

    return () => {
      disposed = true;
      teardown?.();
    };
  }, []);

  return null;
}
