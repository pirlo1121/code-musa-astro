// Autopilot: "Iniciar viaje" flies the whole journey on its own.
//
// It does not move the camera directly: it drives the page scroll, so the
// camera, the section reveals, the nav, the HUD and the progress bar all
// follow exactly as they do when the visitor scrolls by hand. Each station
// becomes three beats — flight in, a slow reading-paced dolly through the
// section, and the flight out to the next one.
//
// Any input from the visitor (wheel, touch, keys, a click) hands control back
// immediately. Lenis keeps running underneath so that hand-over is seamless.

import gsap from 'gsap';
import type Lenis from 'lenis';
import { SECTIONS } from '../data/site';
import type { Key } from './scroll-director';

interface Leg {
  to: number;
  duration: number;
  ease: string;
  /** Station shown while this leg plays (for the destination readout). */
  station: number;
  kind: 'launch' | 'flight' | 'explore';
}

interface AutopilotOptions {
  lenis: Lenis | null;
  getKeys: () => Key[];
  reducedMotion: boolean;
  onComplete?: () => void;
}

const LAUNCH = 2.6;           // s: leaving the hero star
const FLIGHT = 3.6;           // s: between two stations
const READ_SPEED = 120;       // px/s while exploring a section
const EXPLORE = [5, 13];      // s: clamp for the time spent at a station

function planLegs(keys: Key[], maxScroll: number): Leg[] {
  const legs: Leg[] = [{ to: keys[0].b, duration: LAUNCH, ease: 'power2.in', station: 0, kind: 'launch' }];
  for (let i = 1; i < keys.length; i++) {
    const { a } = keys[i];
    const b = i === keys.length - 1 ? maxScroll : keys[i].b;
    legs.push({ to: a, duration: FLIGHT, ease: 'sine.inOut', station: i, kind: 'flight' });
    const explore = gsap.utils.clamp(EXPLORE[0], EXPLORE[1], (b - a) / READ_SPEED);
    legs.push({ to: b, duration: explore, ease: 'sine.inOut', station: i, kind: 'explore' });
  }
  return legs;
}

export function initAutopilot({ lenis, getKeys, reducedMotion, onComplete }: AutopilotOptions) {
  const root = document.documentElement;
  const starters = document.querySelectorAll<HTMLElement>('[data-autopilot-start]');
  const stopButton = document.getElementById('autopilot-stop');
  const destination = document.getElementById('autopilot-destination');
  const phase = document.getElementById('autopilot-phase');
  if (!starters.length) return;

  let timeline: gsap.core.Timeline | null = null;
  const proxy = { y: 0 };

  function scrollTo(y: number) {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  }

  function announce(leg: Leg) {
    if (destination) destination.textContent = SECTIONS[leg.station].object;
    if (phase) {
      phase.textContent = leg.kind === 'launch' ? 'Despegando' : leg.kind === 'flight' ? 'Rumbo a' : 'Explorando';
    }
  }

  function stop(completed = false) {
    if (!timeline) return;
    timeline.kill();
    timeline = null;
    root.classList.remove('autopilot');
    removeInterrupts();
    if (completed) onComplete?.();
  }

  // --- Hand control back on any user input ---------------------------------
  const onInput = (e: Event) => {
    if (e instanceof KeyboardEvent && (e.key === 'Tab' || e.key === 'Shift')) return;
    if (e.target instanceof Element && e.target.closest('#autopilot-stop')) return;
    stop();
  };
  const INPUTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
  function addInterrupts() {
    INPUTS.forEach((type) => window.addEventListener(type, onInput, { passive: true, capture: true }));
  }
  function removeInterrupts() {
    INPUTS.forEach((type) => window.removeEventListener(type, onInput, { capture: true }));
  }

  function start() {
    stop();
    const keys = getKeys();
    if (!keys.length) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const current = lenis ? lenis.scroll : window.scrollY;

    // Resume from wherever the visitor is; at the very end, start over.
    const allLegs = planLegs(keys, maxScroll);
    const atEnd = current >= maxScroll - 4;
    let from = atEnd ? 0 : current;
    if (atEnd) scrollTo(0);
    const firstIndex = allLegs.findIndex((leg) => leg.to > from + 1);
    if (firstIndex < 0) return;
    const legs = allLegs.slice(firstIndex);

    root.classList.add('autopilot');

    proxy.y = from;
    timeline = gsap.timeline({
      delay: reducedMotion ? 0 : 0.6,
      onUpdate: () => scrollTo(proxy.y),
      onComplete: () => stop(true),
    });
    legs.forEach((leg, i) => {
      // The first leg may start part-way through: keep its speed, not its length.
      let duration = leg.duration;
      if (i === 0) {
        const prevTo = firstIndex > 0 ? allLegs[firstIndex - 1].to : 0;
        const span = Math.max(1, leg.to - prevTo);
        duration = Math.max(1.2, leg.duration * ((leg.to - from) / span));
      }
      timeline!.to(proxy, { y: leg.to, duration, ease: i === 0 && from > 0 ? 'sine.out' : leg.ease, onStart: () => announce(leg) });
      from = leg.to;
    });

    addInterrupts();
    stopButton?.focus({ preventScroll: true });
  }

  starters.forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    start();
  }));
  stopButton?.addEventListener('click', () => stop());
}
