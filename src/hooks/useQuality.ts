import { useSyncExternalStore } from 'react';
import { effectiveTier, getQuality, subscribeQuality, type QualityTier } from '../lib/store';
import { TIER_CONFIG, type TierConfig } from '../lib/quality';

export function useQualityTier(): QualityTier {
  return useSyncExternalStore(subscribeQuality, () => effectiveTier(getQuality()), () => 'off');
}

/** Budget table for the current tier (never called while tier is 'off'). */
export function useTierConfig(): TierConfig {
  const tier = useQualityTier();
  return TIER_CONFIG[tier === 'off' ? 'low' : tier];
}
