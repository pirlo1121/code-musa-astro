// Mounts a chapter's objects only while the camera is within `margin` stops
// of it. Out of range, the whole subtree unmounts and R3F disposes its
// geometries and materials, so GPU memory stays flat along the journey.
// The margin is wide enough that shaders compile during the previous hold,
// not mid-flight.

import { Suspense, type ReactNode } from 'react';
import type { ChapterId } from '../data/journey';
import { useUi, useWorld } from './context';

interface Props {
  chapter: ChapterId;
  margin?: number;
  children: ReactNode;
}

export function ChapterGate({ chapter, margin = 2, children }: Props) {
  const [first, last] = useWorld().ranges[chapter];
  const near = useUi((s) => s.stop >= first - margin && s.stop <= last + margin);
  return near ? <Suspense fallback={null}>{children}</Suspense> : null;
}
