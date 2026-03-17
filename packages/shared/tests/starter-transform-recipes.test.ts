import { describe, expect, it } from 'vitest';
import { starterTransformRecipes } from '../src';

describe('starter transform recipes', () => {
  it('defines the minimal iron ingot transform recipe', () => {
    expect(starterTransformRecipes).toEqual([
      {
        id: 'ironridge_iron_ingot_batch',
        buildingTypeId: 'ironridge_iron_extractor',
        nameKey: 'transforms.ironridge_iron_ingot_batch.name',
        descriptionKey: 'transforms.ironridge_iron_ingot_batch.description',
        inputResourceId: 'iron_ore',
        inputAmount: 12,
        outputResourceId: 'iron_ingot',
        outputAmount: 6,
        durationSeconds: 3600,
      },
    ]);
  });
});
