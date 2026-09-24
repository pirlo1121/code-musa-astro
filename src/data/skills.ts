// Each skill is a planet of the solar system. `kind` picks the surface shader:
// terrestrial (oceans + land), gas (bands), lava (emissive cracks), ice.
// Descriptions are a starting point — edit them to tell your own story.

export type PlanetKind = 'terrestrial' | 'gas' | 'lava' | 'ice';

export interface Skill {
  id: string;
  name: string;
  /** Accent used by the DOM card. */
  accent: string;
  kind: PlanetKind;
  /** Surface ramp: [base, mid, high]. */
  colors: [string, string, string];
  atmosphere: string;
  radius: number;
  rings?: boolean;
  summary: string;
  uses: string[];
}

export const skills: Skill[] = [
  {
    id: 'javascript',
    name: 'JavaScript',
    accent: '#f7df1e',
    kind: 'gas',
    colors: ['#8a6a12', '#f2d45c', '#fff4c2'],
    atmosphere: '#ffe27a',
    radius: 3.4,
    summary:
      'El lenguaje base de todo lo que construyo: lógica de interfaz, tooling y servicios en el servidor.',
    uses: ['ES2023+', 'DOM', 'Async / Promises', 'Módulos'],
  },
  {
    id: 'node',
    name: 'Node.js',
    accent: '#5fa04e',
    kind: 'terrestrial',
    colors: ['#0f3b2a', '#3f8f3a', '#b9d88a'],
    atmosphere: '#8fe08a',
    radius: 2.6,
    summary:
      'Runtime para APIs y procesos de backend: servicios REST, tareas programadas y scripts de automatización.',
    uses: ['APIs REST', 'Streams', 'npm', 'Event loop'],
  },
  {
    id: 'express',
    name: 'Express',
    accent: '#c9d1d9',
    kind: 'ice',
    colors: ['#3a4250', '#9aa6b8', '#e8eef7'],
    atmosphere: '#cfe0ff',
    radius: 1.9,
    summary:
      'Framework minimalista para estructurar rutas, middlewares y validación sobre Node.js.',
    uses: ['Routing', 'Middlewares', 'Auth', 'Validación'],
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    accent: '#47a248',
    kind: 'terrestrial',
    colors: ['#06303a', '#1f7a4c', '#7fc88f'],
    atmosphere: '#62d6b0',
    radius: 2.9,
    summary:
      'Base de datos documental para modelos flexibles: esquemas con Mongoose, índices y agregaciones.',
    uses: ['Mongoose', 'Agregaciones', 'Índices', 'Atlas'],
  },
  {
    id: 'aws',
    name: 'AWS',
    accent: '#ff9900',
    kind: 'gas',
    colors: ['#5a2a06', '#e08a2a', '#ffd9a0'],
    atmosphere: '#ffb45e',
    radius: 3.9,
    rings: true,
    summary:
      'Infraestructura en la nube: almacenamiento de archivos, despliegue de servicios y configuración de accesos.',
    uses: ['S3', 'EC2', 'IAM', 'CloudFront'],
  },
  {
    id: 'linux',
    name: 'Linux',
    accent: '#fcc624',
    kind: 'lava',
    colors: ['#1a0f0c', '#3b2217', '#ff6a1f'],
    atmosphere: '#ff8a4a',
    radius: 2.3,
    summary:
      'Mi entorno de trabajo diario y de servidores: shell, servicios, permisos y despliegues.',
    uses: ['Bash', 'systemd', 'SSH', 'Debian'],
  },
  {
    id: 'git',
    name: 'Git',
    accent: '#f05032',
    kind: 'lava',
    colors: ['#200c0a', '#4a1a14', '#ff3d2a'],
    atmosphere: '#ff6b4f',
    radius: 2.0,
    summary:
      'Control de versiones para trabajar en ramas, revisar cambios y mantener un historial limpio.',
    uses: ['Branching', 'Rebase', 'Pull requests', 'CI'],
  },
];
