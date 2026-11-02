// Static copy that the API does not provide. Everything here is rendered as
// real HTML (crawlable, screen-reader friendly); the 3D scene only decorates it.

export const SECTIONS = [
  { id: 'hero',     label: 'Home',     object: 'Star' },
  { id: 'about',    label: 'About',    object: 'Violet nebula' },
  { id: 'skills',   label: 'Skills',   object: 'Emerald nebula' },
  { id: 'projects', label: 'Projects', object: 'Crimson nebula' },
  { id: 'contact',  label: 'Contact',  object: 'Moon' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const site = {
  // Used when the profile API is unreachable at build time.
  fallbackName: 'Maicol Bautista',
  fallbackRole: 'Software Developer',

  tagline: 'I build fast, solid software, crafted down to the last detail.',

  // TODO: public contact address. Left empty on purpose — the e-mail block is
  // hidden until you fill it in.
  email: '',
};
