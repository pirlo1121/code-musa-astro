// Content for the "Trayectoria" section (the space station).
// TODO: every entry below is a placeholder in [brackets] — replace it with
// your real history before deploying. An empty array hides its column.

export interface ExperienceEntry {
  period: string;
  title: string;
  org: string;
  description?: string;
}

export const experience: {
  path: ExperienceEntry[];
  education: ExperienceEntry[];
  certifications: ExperienceEntry[];
  achievements: ExperienceEntry[];
} = {
  path: [
    {
      period: '[20XX — Actualidad]',
      title: '[Tu rol actual]',
      org: '[Empresa / Freelance]',
      description: '[Qué construyes y qué impacto tuvo.]',
    },
    {
      period: '[20XX — 20XX]',
      title: '[Rol anterior]',
      org: '[Empresa]',
      description: '[Responsabilidades y logros clave.]',
    },
  ],
  education: [
    { period: '[20XX — 20XX]', title: '[Título / Carrera]', org: '[Institución]' },
  ],
  certifications: [
    { period: '[20XX]', title: '[Certificación]', org: '[Emisor]' },
  ],
  achievements: [
    { period: '[20XX]', title: '[Logro destacado]', org: '[Contexto]' },
  ],
};
