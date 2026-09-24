// Scroll runtime: turns native scroll into the journey coordinate `s`.
//
// Lenis smooths wheel scrolling (touch stays native — forcing it on phones
// reintroduces the jank fixed earlier). Every GSAP tick we map the scroll
// position to `s` through the hold/travel track, publish it for the 3D scene
// and scrub each panel's GSAP timeline by how close the camera is to its stop.

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildTrack, scrollToS, stopToScroll, type Track } from '../data/journey';
import { frame, ui } from './store';

interface PanelState {
  el: HTMLElement;
  tl: gsap.core.Timeline;
  v: number;
}

export function initJourney(): void {
  const root = document.documentElement;
  if (!root.classList.contains('journey')) return;

  gsap.registerPlugin(ScrollTrigger);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  frame.reducedMotion = reduced;

  const panelEls = [...document.querySelectorAll<HTMLElement>('[data-stop]')].sort(
    (a, b) => Number(a.dataset.stop) - Number(b.dataset.stop),
  );
  const slots = panelEls.map((el) => Number(el.dataset.slot));
  const sections = [...document.querySelectorAll<HTMLElement>('[data-chapter]')];
  const navLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-goto]')];
  const chapterLabel = document.querySelector<HTMLElement>('[data-hud-chapter]');
  const last = panelEls.length - 1;

  // ─── Panel timelines ──────────────────────────────────────────────────────
  const panels: PanelState[] = panelEls.map((el) => {
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'none' }, 0);
    const parts = el.querySelectorAll('[data-anim]');
    if (parts.length && !reduced) {
      tl.from(parts, { y: 28, opacity: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out' }, 0.05);
    }
    tl.progress(0);
    return { el, tl, v: -1 };
  });

  // ─── Layout ───────────────────────────────────────────────────────────────
  // One scroll unit = the viewport height when laid out. It is only re-measured
  // on width changes or big height changes, so the mobile URL bar showing and
  // hiding does not shift every stop.
  let track: Track;
  let unit = 0;
  let lastWidth = 0;

  function layout() {
    unit = window.innerHeight;
    lastWidth = window.innerWidth;
    track = buildTrack(slots, unit);
    for (const sec of sections) {
      const first = Number(sec.dataset.first);
      const lastStop = Number(sec.dataset.last);
      let h = 0;
      for (let k = first; k <= lastStop; k++) h += slots[k] * unit;
      if (lastStop === last) h += window.innerHeight;
      sec.style.height = `${h}px`;
    }
  }
  layout();

  // ─── Lenis ────────────────────────────────────────────────────────────────
  const lenis = reduced
    ? null
    : new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, smoothWheel: true, syncTouch: false, autoRaf: false });

  if (lenis) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
  }
  gsap.ticker.lagSmoothing(0);

  const currentScroll = () => (lenis ? lenis.animatedScroll : window.scrollY);

  function goTo(stop: number, immediate = false) {
    const k = Math.min(Math.max(stop, 0), last);
    const y = stopToScroll(k, track);
    if (lenis) {
      const distance = Math.abs(k - frame.s);
      lenis.scrollTo(y, {
        immediate,
        duration: Math.min(1.2 + distance * 0.35, 4),
        easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      });
    } else {
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    }
  }
  ui.setState({ goTo });

  // ─── Per-frame update ─────────────────────────────────────────────────────
  let activeChapter = '';

  function tick() {
    const s = scrollToS(currentScroll(), track);
    frame.s = s;

    const stop = Math.round(s);
    if (stop !== ui.getState().stop) ui.setState({ stop });

    const chapter = panelEls[stop].dataset.chapterId ?? '';
    if (chapter !== activeChapter) {
      activeChapter = chapter;
      for (const a of navLinks) a.classList.toggle('is-active', a.dataset.goto === chapter);
      if (chapterLabel) chapterLabel.textContent = panelEls[stop].dataset.label ?? '';
    }

    // Panel k is fully visible while parked on it and fades out during the
    // first half of the travel to its neighbours.
    for (let k = 0; k < panels.length; k++) {
      const p = panels[k];
      const d = Math.abs(s - k);
      const v = d >= 0.5 ? 0 : 1 - smooth(0.12, 0.5, d);
      if (Math.abs(v - p.v) < 0.002) continue;
      p.v = v;
      p.tl.progress(v);
      p.el.inert = v < 0.6;
    }
  }
  gsap.ticker.add(tick);

  // ─── ScrollTrigger-driven HUD ─────────────────────────────────────────────
  gsap.to('[data-hud-progress]', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { start: 0, end: 'max', scrub: true },
  });
  gsap.to('[data-scroll-hint]', {
    autoAlpha: 0,
    ease: 'none',
    scrollTrigger: { start: 0, end: () => unit * 0.35, scrub: true },
  });

  // ─── Inputs ───────────────────────────────────────────────────────────────
  for (const a of navLinks) {
    a.addEventListener('click', (e) => {
      const target = document.getElementById(a.dataset.goto ?? '');
      if (!target) return;
      e.preventDefault();
      goTo(Number(target.dataset.first));
      history.replaceState(null, '', `#${a.dataset.goto}`);
    });
  }

  for (const b of document.querySelectorAll<HTMLElement>('[data-goto-stop]')) {
    b.addEventListener('click', () => goTo(Number(b.dataset.gotoStop)));
  }

  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener(
      'pointermove',
      (e) => {
        frame.px = (e.clientX / window.innerWidth) * 2 - 1;
        frame.py = (e.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true },
    );
  }

  window.addEventListener('resize', () => {
    const widthChanged = window.innerWidth !== lastWidth;
    const heightJump = Math.abs(window.innerHeight - unit) / unit > 0.2;
    if (!widthChanged && !heightJump) return;
    const s = frame.s;
    layout();
    ScrollTrigger.refresh();
    // Keep the camera where it was instead of wherever the new layout lands
    const k = Math.round(s);
    if (Math.abs(s - k) < 0.01) goTo(k, true);
  });

  // Deep links (#projects …) land parked on the chapter's first stop
  const hashTarget = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  if (hashTarget?.dataset.first) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    goTo(Number(hashTarget.dataset.first), true);
  }

  root.classList.add('journey-live');
  tick();
}

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
}
