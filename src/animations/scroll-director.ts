// Turns the page scroll into the journey.
//
// The HTML sections stay in normal document flow (accessible, crawlable,
// keyboard-scrollable). This module measures them and maps the scroll
// position onto a camera-path parameter `u`:
//
//   scroll ─────────[ section 0 ]──┬──[ section 1 ]──┬── …
//   u       0 ── parked ── 1  flight  2 ── parked ── 3  flight …
//
// While a section's content fills the viewport the camera is "parked" on its
// station (slow cinematic dolly). The flight to the next object happens while
// the gap between two sections crosses the middle of the screen, so text
// never moves at the same time the camera is racing past it.

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { frame, SECTION_COUNT } from '../lib/store';
import { SECTIONS } from '../data/site';

gsap.registerPlugin(ScrollTrigger);

interface Key { a: number; b: number }

export interface DirectorOptions {
  reducedMotion: boolean;
  onSection?: (index: number) => void;
  onProgress?: (progress: number) => void;
}

export function initScrollDirector({ reducedMotion, onSection, onProgress }: DirectorOptions) {
  const sections = SECTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  if (sections.length !== SECTION_COUNT) {
    console.warn('[scroll-director] expected', SECTION_COUNT, 'sections, found', sections.length);
  }

  // --- Smooth scrolling -----------------------------------------------------
  // Lenis gives the wheel inertia that makes the flight feel like a camera
  // move instead of a page jump. It is skipped for reduced motion, where the
  // browser's native, immediate scrolling is the respectful default.
  let lenis: Lenis | null = null;
  if (!reducedMotion) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis!.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // --- Scroll → camera parameter -------------------------------------------
  let keys: Key[] = [];
  let currentSection = -1;

  function measure() {
    const vh = window.innerHeight;
    const last = sections.length - 1;
    keys = sections.map((el, i) => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bottom = top + el.offsetHeight;
      return {
        a: i === 0 ? 0 : top - vh * 0.3,
        b: i === last ? Math.max(top, document.documentElement.scrollHeight - vh) : bottom - vh * 0.7,
      };
    });
  }

  function scrollToU(y: number): number {
    for (let i = 0; i < keys.length; i++) {
      const { a, b } = keys[i];
      if (y < a) {
        const prevB = keys[i - 1].b;
        return 2 * (i - 1) + 1 + gsap.utils.clamp(0, 1, (y - prevB) / Math.max(1, a - prevB));
      }
      if (y <= b) return 2 * i + (b > a ? (y - a) / (b - a) : 0);
    }
    return 2 * keys.length - 1;
  }

  function update(y: number) {
    frame.targetU = scrollToU(y);
    const section = Math.min(SECTION_COUNT - 1, Math.floor((frame.targetU + 0.5) / 2));
    if (section !== currentSection) {
      currentSection = section;
      onSection?.(section);
    }
    const max = ScrollTrigger.maxScroll(window);
    onProgress?.(max > 0 ? y / max : 0);
  }

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => update(self.scroll()),
    onRefresh: (self) => { measure(); update(self.scroll()); },
  });

  // --- Steps: which planet is in focus -------------------------------------
  // Steps are contiguous blocks; a step is active while it crosses the
  // viewport centre, so exactly one is active at a time with no gaps.
  document.querySelectorAll<HTMLElement>('[data-step-group]').forEach((group) => {
    const kind = group.dataset.stepGroup as 'skills' | 'projects';
    const key = kind === 'skills' ? 'activeSkill' : 'activeProject';
    const steps = group.querySelectorAll<HTMLElement>('[data-step]');
    steps.forEach((step, index) => {
      ScrollTrigger.create({
        trigger: step,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => {
          step.classList.toggle('is-active', self.isActive);
          if (self.isActive) frame[key] = index;
          else if (frame[key] === index) frame[key] = -1;
        },
      });
    });
  });

  // --- Content choreography ------------------------------------------------
  if (!reducedMotion) {
    // gsap.from() only hides elements once JS has run, so content is never
    // invisible if scripts fail to load.
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((group) => {
      const items = group.querySelectorAll<HTMLElement>('[data-reveal-item]');
      gsap.from(items.length ? items : group, {
        autoAlpha: 0,
        y: 48,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.08,
        scrollTrigger: { trigger: group, start: 'top 82%', toggleActions: 'play none none reverse' },
      });
    });

    const heroContent = document.querySelector('[data-hero-content]');
    if (heroContent) {
      gsap.to(heroContent, {
        autoAlpha: 0,
        y: -90,
        scale: 0.96,
        ease: 'none',
        scrollTrigger: { trigger: sections[0], start: 'top top', end: 'bottom 40%', scrub: true },
      });
    }
  }

  // --- Anchor navigation ---------------------------------------------------
  // In-page links fly the camera there. Focus moves to the target so keyboard
  // and screen-reader users land where the eye does.
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest?.('a[href^="#"]');
    if (!(link instanceof HTMLAnchorElement)) return;
    const id = link.hash.slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', `#${id}`);
    const focus = () => {
      const heading = target.querySelector<HTMLElement>('[data-focus-target]') ?? target;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    };
    if (lenis) {
      lenis.scrollTo(target, { duration: 2.4, easing: (t) => 1 - Math.pow(1 - t, 4), onComplete: focus });
    } else {
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
      focus();
    }
  });

  // --- Pointer parallax ----------------------------------------------------
  if (window.matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      frame.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      frame.pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  // Fonts and lazy images change section heights after first layout.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  measure();
  update(window.scrollY);
  return { lenis };
}
