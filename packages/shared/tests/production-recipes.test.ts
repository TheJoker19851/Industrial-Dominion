import { describe, expect, it } from 'vitest';
import {
  getProductionRecipe,
  productionRecipeCatalog,
} from '../src/content/productionRecipes';

describe('production recipe catalog', () => {
  it('defines the conservative iron ingot starter recipe', () => {
    expect(productionRecipeCatalog).toEqual([
      {
        key: 'iron_ingot_from_iron_ore',
        nameKey: 'productionRecipes.iron_ingot_from_iron_ore.name',
        descriptionKey: 'productionRecipes.iron_ingot_from_iron_ore.description',
        inputResourceId: 'iron_ore',
        inputAmount: 2,
        outputResourceId: 'iron_ingot',
        outputAmount: 1,
      },
    ]);
    expect(getProductionRecipe('iron_ingot_from_iron_ore')).toEqual(
      productionRecipeCatalog[0],
    );
  });
});
