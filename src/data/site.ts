// Static copy that the API does not provide. Everything here is rendered as
// real HTML (crawlable, screen-reader friendly); the 3D scene only decorates it.

export const SECTIONS = [
  { id: 'hero',       label: 'Inicio',      object: 'Estrella' },
  { id: 'about',      label: 'Sobre mí',    object: 'Nebulosa violeta' },
  { id: 'skills',     label: 'Habilidades', object: 'Nebulosa esmeralda' },
  { id: 'projects',   label: 'Proyectos',   object: 'Nebulosa carmesí' },
  { id: 'experience', label: 'Trayectoria', object: 'Nebulosa zafiro' },
  { id: 'contact',    label: 'Contacto',    object: 'Luna' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const site = {
  // Used when the profile API is unreachable at build time.
  fallbackName: 'Maicol Bautista',
  fallbackRole: 'Software Developer',

  tagline: 'Construyo software rápido, sólido y cuidado hasta el último detalle.',

  // TODO: public contact address. Left empty on purpose — the e-mail block is
  // hidden until you fill it in.
  email: '',
};
