import type { RegionId } from '../types/game.js';
import { starterRegionIds } from '../types/game.js';

export interface RegionDistanceConfig {
  costPerUnitPerDistance: number;
  timePerDistanceUnit: number;
  minimumTransferCost: number;
}

export const logisticsConfig: RegionDistanceConfig = {
  costPerUnitPerDistance: 0.5,
  timePerDistanceUnit: 60,
  minimumTransferCost: 5,
};

type RegionPair = `${RegionId}:${RegionId}`;

const regionDistances: Partial<Record<RegionPair, number>> = {
  'greenhaven:ironridge': 4,
  'ironridge:sunbarrel': 6,
  'ironridge:riverplain': 3,
  'greenhaven:sunbarrel': 5,
  'greenhaven:riverplain': 4,
  'riverplain:sunbarrel': 5,
};

function distanceKey(a: RegionId, b: RegionId): RegionPair {
  const sorted = [a, b].sort() as [RegionId, RegionId];
  return `${sorted[0]}:${sorted[1]}`;
}

export function getDistanceBetweenRegions(a: RegionId, b: RegionId): number {
  if (a === b) return 0;
  const key = distanceKey(a, b);
  return regionDistances[key] ?? 0;
}

export function calculateTransportCost(input: {
  quantity: number;
  originRegion: RegionId;
  destinationRegion: RegionId;
}): number {
  const distance = getDistanceBetweenRegions(
    input.originRegion,
    input.destinationRegion,
  );
  if (distance === 0) return 0;
  const raw =
    input.quantity * distance * logisticsConfig.costPerUnitPerDistance;
  return Math.max(Math.round(raw), logisticsConfig.minimumTransferCost);
}

export function calculateTransportTime(input: {
  originRegion: RegionId;
  destinationRegion: RegionId;
}): number {
  const distance = getDistanceBetweenRegions(
    input.originRegion,
    input.destinationRegion,
  );
  return distance * logisticsConfig.timePerDistanceUnit;
}

export function getAllRegionDistances(): Partial<Record<RegionPair, number>> {
  return { ...regionDistances };
}

export { starterRegionIds };
