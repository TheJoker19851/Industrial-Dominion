import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { starterRegionIds, starterResourceIds } from '../src/types/game';

const seedPath = path.resolve(import.meta.dirname, '../../../supabase/seeds/seed.sql');
const seedSql = readFileSync(seedPath, 'utf8');

function getInsertValues(sql: string, tableName: string) {
  const pattern = new RegExp(
    `insert into ${tableName}[\\s\\S]*?values([\\s\\S]*?)on conflict`,
    'i',
  );
  const match = sql.match(pattern);

  if (!match) {
    return '';
  }

  return match[1];
}

describe('starter seed SQL', () => {
  it('seeds all documented starter regions', () => {
    const regionValues = getInsertValues(seedSql, 'regions');

    expect(regionValues).toBeTruthy();

    for (const regionId of starterRegionIds) {
      expect(regionValues).toContain(`'${regionId}'`);
      expect(regionValues).toContain(`'regions.${regionId}.name'`);
      expect(regionValues).toContain(`'regions.${regionId}.description'`);
    }
  });

  it('seeds all documented starter raw resources with tradable storage metadata', () => {
    const resourceValues = getInsertValues(seedSql, 'resources');

    expect(resourceValues).toBeTruthy();

    for (const resourceId of starterResourceIds) {
      expect(resourceValues).toContain(`'${resourceId}'`);
      expect(resourceValues).toContain(`'resources.${resourceId}.name'`);
    }

    expect(resourceValues.match(/'raw'/g)).toHaveLength(starterResourceIds.length);
    expect(resourceValues.match(/, true, true\)/g)).toHaveLength(
      starterResourceIds.length,
    );
    expect(resourceValues).toContain("'iron_ingot'");
    expect(resourceValues).toContain("'resources.iron_ingot.name'");
    expect(resourceValues).toContain("'processed'");
  });

  it('seeds the starter extractor building types', () => {
    const buildingTypeValues = getInsertValues(seedSql, 'building_types');

    expect(buildingTypeValues).toContain("'ironridge_iron_extractor'");
    expect(buildingTypeValues).toContain("'greenhaven_timber_extractor'");
    expect(buildingTypeValues).toContain("'sunbarrel_oil_extractor'");
    expect(buildingTypeValues).toContain("'riverplain_water_extractor'");
    expect(buildingTypeValues).toContain("'starter_processing_installation'");
    expect(buildingTypeValues.match(/'extraction'/g)).toHaveLength(4);
    expect(buildingTypeValues.match(/'processing'/g)).toHaveLength(1);
  });

  it('seeds the starter transform recipe', () => {
    const recipeValues = getInsertValues(seedSql, 'recipes');

    expect(recipeValues).toContain("'ironridge_iron_ingot_batch'");
    expect(recipeValues).toContain("'iron_ore'");
    expect(recipeValues).toContain("'iron_ingot'");
    expect(recipeValues).toContain(', 12, 6, 3600)');
  });
});
