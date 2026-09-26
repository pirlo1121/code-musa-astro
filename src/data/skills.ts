// Skills shown together in the emerald nebula. `level` drives the HTML meter
// and `color` tints its dot and fill.
// TODO: review levels and descriptions — they are editable estimates.

export interface Skill {
  id: string;
  name: string;
  level: number;          // 0–100
  levelLabel: string;
  description: string;
  color: string;
}

export const skills: Skill[] = [
  {
    id: 'javascript', name: 'JavaScript', level: 90, levelLabel: 'Avanzado',
    description: 'El lenguaje con el que más produzco: asincronía, módulos, patrones funcionales y del DOM, del navegador al servidor.',
    color: '#ffe766',
  },
  {
    id: 'node', name: 'Node.js', level: 85, levelLabel: 'Avanzado',
    description: 'APIs y servicios en tiempo real, streams, colas y tooling. Mi base para construir backends.',
    color: '#8cff6b',
  },
  {
    id: 'express', name: 'Express', level: 85, levelLabel: 'Avanzado',
    description: 'Routing, middlewares, validación y manejo de errores para APIs REST limpias y mantenibles.',
    color: '#b8c4d8',
  },
  {
    id: 'mongodb', name: 'MongoDB', level: 80, levelLabel: 'Sólido',
    description: 'Modelado de documentos, índices, agregaciones y Mongoose para datos flexibles a escala.',
    color: '#3dffb0',
  },
  {
    id: 'aws', name: 'AWS', level: 65, levelLabel: 'Intermedio',
    description: 'S3, EC2 y despliegues en la nube; almacenamiento de assets y servicios que escalan con la demanda.',
    color: '#ffb347',
  },
  {
    id: 'linux', name: 'Linux', level: 80, levelLabel: 'Sólido',
    description: 'Mi entorno diario: shell, servidores Debian, permisos, systemd y automatización con scripts.',
    color: '#8fb4ff',
  },
  {
    id: 'git', name: 'Git', level: 85, levelLabel: 'Avanzado',
    description: 'Flujos por ramas, rebase, revisión de código y un historial que cuenta la historia del proyecto.',
    color: '#ff7a55',
  },
];
