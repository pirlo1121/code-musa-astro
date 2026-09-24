// Each entry is a star of the constellation, in chronological order.
// TODO(Maicol): replace these placeholders with your real history — the API
// does not expose experience, so it lives here.

export interface ExperienceEntry {
  role: string;
  org: string;
  period: string;
  summary: string;
  tags: string[];
}

export const experience: ExperienceEntry[] = [
  {
    role: 'Cargo / rol',
    org: 'Empresa u organización',
    period: '20XX – 20XX',
    summary: 'Describe en una o dos líneas qué construiste y qué impacto tuvo.',
    tags: ['Tecnología', 'Tecnología'],
  },
  {
    role: 'Cargo / rol',
    org: 'Empresa u organización',
    period: '20XX – 20XX',
    summary: 'Describe en una o dos líneas qué construiste y qué impacto tuvo.',
    tags: ['Tecnología', 'Tecnología'],
  },
  {
    role: 'Cargo / rol',
    org: 'Empresa u organización',
    period: '20XX – 20XX',
    summary: 'Describe en una o dos líneas qué construiste y qué impacto tuvo.',
    tags: ['Tecnología', 'Tecnología'],
  },
  {
    role: 'Cargo / rol',
    org: 'Empresa u organización',
    period: '20XX – hoy',
    summary: 'Describe en una o dos líneas qué construiste y qué impacto tuvo.',
    tags: ['Tecnología', 'Tecnología'],
  },
];
