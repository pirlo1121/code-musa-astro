import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { ui, type UiState } from '../scroll/store';
import { QUALITY, type Quality } from './quality';
import type { World } from './world';

export const WorldContext = createContext<World | null>(null);

export function useWorld(): World {
  const world = useContext(WorldContext);
  if (!world) throw new Error('useWorld must be used inside <Scene>');
  return world;
}

export function useUi<T>(selector: (s: UiState) => T): T {
  return useStore(ui, selector);
}

export function useQuality(): Quality {
  return QUALITY[useUi((s) => s.tier)];
}
