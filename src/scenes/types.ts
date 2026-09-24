/** Minimal project data the 3D scene needs (serialised from Astro as island props). */
export interface ProjectBody {
  id: string;
  name: string;
  /** Build-time optimised screenshot (same-origin WebP), or null. */
  image: string | null;
}
