import { describe, expect, it } from 'vitest';
import {
  calculateEnergyUsePerMinute,
  calculateMaintenancePerHour,
  calculateProductionOutput,
  calculateStarterExtractorMetrics,
  energyMultiplier,
  maintenanceMultiplier,
  outputMultiplier,
} from '../src/economics/formulas';
import { starterExtractorCatalog } from '../src/content/starterExtractors';

describe('economics formulas', () => {
  it('keeps level 1 as the baseline multiplier', () => {
    expect(outputMultiplier(1)).toBe(1);
    expect(maintenanceMultiplier(1)).toBe(1);
    expect(energyMultiplier(1)).toBe(1);
  });

  it('scales higher levels with the configured growth curve', () => {
    expect(outputMultiplier(4)).toBe(1.6);
    expect(maintenanceMultiplier(4)).toBe(1.3);
    expect(energyMultiplier(4)).toBe(1.24);
  });

  it('calculates production output with level, event, and region modifiers', () => {
    expect(
      calculateProductionOutput({
        baseOutputPerHour: 24,
        level: 2,
        eventModifier: 1.1,
        regionModifier: 0.95,
      }),
    ).toBe(30.1);
  });

  it('calculates maintenance and energy usage from the base formulas', () => {
    expect(
      calculateMaintenancePerHour({
        baseMaintenancePerHour: 8,
        level: 3,
      }),
    ).toBe(9.6);
    expect(
      calculateEnergyUsePerMinute({
        baseEnergyUsePerMinute: 2,
        level: 3,
      }),
    ).toBe(2.32);
  });

  it('derives a starter extractor production snapshot from the shared catalog', () => {
    const extractor = starterExtractorCatalog[0];

    expect(
      calculateStarterExtractorMetrics(extractor, {
        level: 2,
        eventModifier: 1,
        regionModifier: 1,
      }),
    ).toEqual({
      outputPerHour: 28.8,
      maintenancePerHour: 8.8,
      energyUsePerMinute: 2.16,
    });
  });
});
