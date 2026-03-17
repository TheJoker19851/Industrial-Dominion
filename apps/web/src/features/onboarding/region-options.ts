import { starterRegionIds, type RegionId } from '@industrial-dominion/shared';

export type RegionOption = {
  id: RegionId;
  accentClassName: string;
};

const regionAccentClasses: Record<RegionId, string> = {
  ironridge: 'from-amber-500/20 via-orange-500/10 to-transparent',
  greenhaven: 'from-emerald-500/20 via-lime-500/10 to-transparent',
  sunbarrel: 'from-yellow-400/20 via-amber-500/10 to-transparent',
  riverplain: 'from-sky-400/20 via-cyan-500/10 to-transparent',
};

export const regionOptions: RegionOption[] = starterRegionIds.map((id) => ({
  id,
  accentClassName: regionAccentClasses[id],
}));
