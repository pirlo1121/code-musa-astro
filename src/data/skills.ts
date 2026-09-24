// Each skill becomes a planet of the "Habilidades" system. `level` drives both
// the HTML meter and the 3D orbit ring drawn around the focused planet.
// TODO: review levels and descriptions — they are editable estimates.

export type PlanetKind = 'rocky' | 'gas' | 'ocean';

export interface Skill {
  id: string;
  name: string;
  level: number;          // 0–100
  levelLabel: string;
  description: string;
  kind: PlanetKind;
  palette: [string, string, string];
  atmosphere: string;
  size: number;           // planet radius in world units
  ring?: boolean;
}

export const skills: Skill[] = [
  {
    id: 'javascript', name: 'JavaScript', level: 90, levelLabel: 'Avanzado',
    description: 'El lenguaje con el que más produzco: asincronía, módulos, patrones funcionales y del DOM, del navegador al servidor.',
    kind: 'gas', palette: ['#6b5200', '#f7df1e', '#fff6b0'], atmosphere: '#ffe766', size: 2.1, ring: true,
  },
  {
    id: 'node', name: 'Node.js', level: 85, levelLabel: 'Avanzado',
    description: 'APIs y servicios en tiempo real, streams, colas y tooling. Mi base para construir backends.',
    kind: 'rocky', palette: ['#1d3a12', '#5fa04e', '#c8f0a0'], atmosphere: '#8cff6b', size: 1.8,
  },
  {
    id: 'express', name: 'Express', level: 85, levelLabel: 'Avanzado',
    description: 'Routing, middlewares, validación y manejo de errores para APIs REST limpias y mantenibles.',
    kind: 'rocky', palette: ['#23262d', '#7d8594', '#dfe4ec'], atmosphere: '#b8c4d8', size: 1.3,
  },
  {
    id: 'mongodb', name: 'MongoDB', level: 80, levelLabel: 'Sólido',
    description: 'Modelado de documentos, índices, agregaciones y Mongoose para datos flexibles a escala.',
    kind: 'ocean', palette: ['#003b2a', '#00a86b', '#b9ffd9'], atmosphere: '#3dffb0', size: 1.6,
  },
  {
    id: 'aws', name: 'AWS', level: 65, levelLabel: 'Intermedio',
    description: 'S3, EC2 y despliegues en la nube; almacenamiento de assets y servicios que escalan con la demanda.',
    kind: 'gas', palette: ['#4a2300', '#ff9900', '#ffe1b0'], atmosphere: '#ffb347', size: 2.4, ring: true,
  },
  {
    id: 'linux', name: 'Linux', level: 80, levelLabel: 'Sólido',
    description: 'Mi entorno diario: shell, servidores Debian, permisos, systemd y automatización con scripts.',
    kind: 'ocean', palette: ['#0c1a3a', '#4f7bd9', '#f2f6ff'], atmosphere: '#8fb4ff', size: 1.5,
  },
  {
    id: 'git', name: 'Git', level: 85, levelLabel: 'Avanzado',
    description: 'Flujos por ramas, rebase, revisión de código y un historial que cuenta la historia del proyecto.',
    kind: 'rocky', palette: ['#3a0d05', '#f05032', '#ffc2a8'], atmosphere: '#ff7a55', size: 1.2,
  },
];
