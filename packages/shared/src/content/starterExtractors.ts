import type { RegionId, StarterExtractorDefinition } from '../types/game.js';

export const starterExtractorCatalog = [
  {
    id: 'ironridge_iron_extractor',
    nameKey: 'buildingTypes.ironridge_iron_extractor.name',
    descriptionKey: 'buildingTypes.ironridge_iron_extractor.description',
    category: 'extraction',
    outputResourceId: 'iron_ore',
    baseOutputPerHour: 24,
    baseMaintenancePerHour: 8,
    baseEnergyUsePerMinute: 2,
    allowedRegionIds: ['ironridge'],
  },
  {
    id: 'greenhaven_timber_extractor',
    nameKey: 'buildingTypes.greenhaven_timber_extractor.name',
    descriptionKey: 'buildingTypes.greenhaven_timber_extractor.description',
    category: 'extraction',
    outputResourceId: 'wood',
    baseOutputPerHour: 22,
    baseMaintenancePerHour: 5,
    baseEnergyUsePerMinute: 1,
    allowedRegionIds: ['greenhaven'],
  },
  {
    id: 'sunbarrel_oil_extractor',
    nameKey: 'buildingTypes.sunbarrel_oil_extractor.name',
    descriptionKey: 'buildingTypes.sunbarrel_oil_extractor.description',
    category: 'extraction',
    outputResourceId: 'crude_oil',
    baseOutputPerHour: 18,
    baseMaintenancePerHour: 10,
    baseEnergyUsePerMinute: 3,
    allowedRegionIds: ['sunbarrel'],
  },
  {
    id: 'riverplain_water_extractor',
    nameKey: 'buildingTypes.riverplain_water_extractor.name',
    descriptionKey: 'buildingTypes.riverplain_water_extractor.description',
    category: 'extraction',
    outputResourceId: 'water',
    baseOutputPerHour: 26,
    baseMaintenancePerHour: 4,
    baseEnergyUsePerMinute: 1,
    allowedRegionIds: ['riverplain'],
  },
] as const satisfies readonly StarterExtractorDefinition[];

export function getStarterExtractorForRegion(regionId: RegionId) {
  return starterExtractorCatalog.find((extractor) =>
    extractor.allowedRegionIds.some((allowedRegionId) => allowedRegionId === regionId),
  );
}
