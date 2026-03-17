import type { StarterExtractorDefinition } from '../types/game.js';

export function outputMultiplier(level: number): number {
  return 1 + 0.2 * Math.max(0, level - 1);
}

export function maintenanceMultiplier(level: number): number {
  return 1 + 0.1 * Math.max(0, level - 1);
}

export function energyMultiplier(level: number): number {
  return 1 + 0.08 * Math.max(0, level - 1);
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateProductionOutput(input: {
  baseOutputPerHour: number;
  level: number;
  eventModifier?: number;
  regionModifier?: number;
}): number {
  return roundToHundredth(
    input.baseOutputPerHour *
      outputMultiplier(input.level) *
      (input.eventModifier ?? 1) *
      (input.regionModifier ?? 1),
  );
}

export function calculateMaintenancePerHour(input: {
  baseMaintenancePerHour: number;
  level: number;
}): number {
  return roundToHundredth(
    input.baseMaintenancePerHour * maintenanceMultiplier(input.level),
  );
}

export function calculateEnergyUsePerMinute(input: {
  baseEnergyUsePerMinute: number;
  level: number;
}): number {
  return roundToHundredth(
    input.baseEnergyUsePerMinute * energyMultiplier(input.level),
  );
}

export function calculateStarterExtractorMetrics(
  extractor: StarterExtractorDefinition,
  input: {
    level: number;
    eventModifier?: number;
    regionModifier?: number;
  },
) {
  return {
    outputPerHour: calculateProductionOutput({
      baseOutputPerHour: extractor.baseOutputPerHour,
      level: input.level,
      eventModifier: input.eventModifier,
      regionModifier: input.regionModifier,
    }),
    maintenancePerHour: calculateMaintenancePerHour({
      baseMaintenancePerHour: extractor.baseMaintenancePerHour,
      level: input.level,
    }),
    energyUsePerMinute: calculateEnergyUsePerMinute({
      baseEnergyUsePerMinute: extractor.baseEnergyUsePerMinute,
      level: input.level,
    }),
  };
}
