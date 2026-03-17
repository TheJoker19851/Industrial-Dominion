import { describe, expect, it } from 'vitest';
import {
  getStarterExtractorForRegion,
  starterExtractorCatalog,
  starterRegionIds,
  starterResourceIds,
} from '../src';

describe('starter extractor catalog', () => {
  it('stays aligned with starter regions and raw resources', () => {
    expect(starterExtractorCatalog).toHaveLength(4);

    for (const extractor of starterExtractorCatalog) {
      expect(starterRegionIds).toContain(extractor.allowedRegionIds[0]);
      expect(starterResourceIds).toContain(extractor.outputResourceId);
      expect(extractor.category).toBe('extraction');
      expect(extractor.baseOutputPerHour).toBeGreaterThan(0);
      expect(extractor.baseMaintenancePerHour).toBeGreaterThan(0);
      expect(extractor.baseEnergyUsePerMinute).toBeGreaterThan(0);
    }
  });

  it('uses a single starter extractor per starter region', () => {
    expect(starterExtractorCatalog.map((extractor) => extractor.allowedRegionIds[0])).toEqual([
      'ironridge',
      'greenhaven',
      'sunbarrel',
      'riverplain',
    ]);
  });

  it('resolves the correct extractor for a starter region', () => {
    expect(getStarterExtractorForRegion('ironridge')?.id).toBe('ironridge_iron_extractor');
    expect(getStarterExtractorForRegion('riverplain')?.id).toBe('riverplain_water_extractor');
  });
});
