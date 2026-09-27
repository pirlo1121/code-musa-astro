// Content for the "Trayectoria" section (the sapphire nebula).
// TODO: every entry below is a placeholder in [brackets] — replace it with
// your real history before deploying. An empty array hides its column.

export interface ExperienceEntry {
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
      title: '[Tu rol actual]',
      org: '[Empresa / Freelance]',
      description: '[Qué construyes y qué impacto tuvo.]',
    },
    {
      title: '[Rol anterior]',
      org: '[Empresa]',
      description: '[Responsabilidades y logros clave.]',
    },
  ],
  education: [
    { title: '[Título / Carrera]', org: '[Institución]' },
  ],
  certifications: [
    { title: '[Certificación]', org: '[Emisor]' },
  ],
  achievements: [
    { title: '[Logro destacado]', org: '[Contexto]' },
  ],
};
