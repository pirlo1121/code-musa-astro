// The journey contract shared by the DOM (Astro panels + scroll runtime) and
// the 3D scene (camera keyframes). Both sides call buildStops() with the same
// counts, so stop N in the DOM is always keyframe N in the scene.

export type ChapterId =
  | 'hero'
  | 'about'
  | 'skills'
  | 'projects'
  | 'blackhole'
  | 'experience'
  | 'contact';

export interface Stop {
  index: number;
  chapter: ChapterId;
  /** Item inside the chapter (planet, galaxy, star). -1 = chapter intro. */
  item: number;
  /** Scroll length of this stop, in viewport heights. */
  slot: number;
}

export const CHAPTER_ORDER: ChapterId[] = [
  'hero',
  'about',
  'skills',
  'projects',
  'blackhole',
  'experience',
  'contact',
];

/** Chapters listed in the navigation (the black hole is a transition). */
export const NAV_CHAPTERS: { id: ChapterId; label: string }[] = [
  { id: 'about', label: 'Origen' },
  { id: 'skills', label: 'Stack' },
  { id: 'projects', label: 'Proyectos' },
  { id: 'experience', label: 'Trayectoria' },
  { id: 'contact', label: 'Contacto' },
];

const SLOT = {
  hero: 1.3,
  about: 1.6,
  skillsIntro: 1.2,
  skill: 1.0,
  project: 1.2,
  blackhole: 1.5,
  experience: 1.0,
  contact: 1.4,
};

export interface JourneyCounts {
  skills: number;
  projects: number;
  experience: number;
}

export function buildStops({ skills, projects, experience }: JourneyCounts): Stop[] {
  const stops: Stop[] = [];
  const push = (chapter: ChapterId, item: number, slot: number) =>
    stops.push({ index: stops.length, chapter, item, slot });

  push('hero', -1, SLOT.hero);
  push('about', -1, SLOT.about);
  push('skills', -1, SLOT.skillsIntro);
  for (let i = 0; i < skills; i++) push('skills', i, SLOT.skill);
  // With no projects (API down during build) keep one stop for the empty state
  for (let i = 0; i < Math.max(projects, 1); i++) push('projects', i, SLOT.project);
  push('blackhole', -1, SLOT.blackhole);
  for (let i = 0; i < Math.max(experience, 1); i++) push('experience', i, SLOT.experience);
  push('contact', -1, SLOT.contact);
  return stops;
}

export function chapterRanges(stops: Stop[]): Record<ChapterId, [number, number]> {
  const ranges = {} as Record<ChapterId, [number, number]>;
  for (const s of stops) {
    const r = ranges[s.chapter];
    if (r) r[1] = s.index;
    else ranges[s.chapter] = [s.index, s.index];
  }
  return ranges;
}

// ─── Scroll track ────────────────────────────────────────────────────────────
// Each stop owns a slot of scroll. The middle HOLD fraction of the slot keeps
// the camera parked at the stop (s = k, panel readable); the rest is travel
// to the neighbouring stops. The first hold starts at the top of the page and
// the last one runs to the bottom.

export const HOLD = 0.42;

export interface Track {
  holdStart: number[];
  holdEnd: number[];
  total: number;
}

export function buildTrack(slots: number[], unitPx: number): Track {
  const holdStart: number[] = [];
  const holdEnd: number[] = [];
  let y = 0;
  for (const slot of slots) {
    const len = slot * unitPx;
    const pad = ((1 - HOLD) / 2) * len;
    holdStart.push(y + pad);
    holdEnd.push(y + len - pad);
    y += len;
  }
  holdStart[0] = 0;
  holdEnd[holdEnd.length - 1] = y;
  return { holdStart, holdEnd, total: y };
}

const smoothstep = (f: number) => f * f * (3 - 2 * f);

/** Scroll position (px) → journey coordinate s ∈ [0, stops-1]. */
export function scrollToS(y: number, t: Track): number {
  const n = t.holdStart.length;
  if (y <= t.holdEnd[0]) return 0;
  for (let k = 0; k < n - 1; k++) {
    if (y < t.holdStart[k + 1]) {
      const f = (y - t.holdEnd[k]) / (t.holdStart[k + 1] - t.holdEnd[k]);
      return k + smoothstep(Math.min(Math.max(f, 0), 1));
    }
    if (y <= t.holdEnd[k + 1]) return k + 1;
  }
  return n - 1;
}

/** Scroll position (px) that parks the camera on stop k. */
export function stopToScroll(k: number, t: Track): number {
  if (k <= 0) return 0;
  const last = t.holdStart.length - 1;
  if (k >= last) return t.total;
  return (t.holdStart[k] + t.holdEnd[k]) / 2;
}
