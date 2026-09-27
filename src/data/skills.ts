// Skills shown together in the emerald nebula; `color` tints each one.

export interface Skill {
  id: string;
  name: string;
  color: string;
}

export const skills: Skill[] = [
  { id: 'javascript', name: 'JavaScript', color: '#ffe766' },
  { id: 'node', name: 'Node.js', color: '#8cff6b' },
  { id: 'express', name: 'Express', color: '#b8c4d8' },
  { id: 'mongodb', name: 'MongoDB', color: '#3dffb0' },
  { id: 'aws', name: 'AWS', color: '#ffb347' },
  { id: 'linux', name: 'Linux', color: '#8fb4ff' },
  { id: 'git', name: 'Git', color: '#ff7a55' },
];
