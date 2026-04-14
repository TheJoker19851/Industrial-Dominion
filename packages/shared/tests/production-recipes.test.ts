import { describe, expect, it } from 'vitest';
import {
  getProductionRecipe,
  productionRecipeCatalog,
} from '../src/content/productionRecipes';

describe('production recipe catalog', () => {
  it('defines the conservative iron ingot starter recipe', () => {
    expect(productionRecipeCatalog).toEqual(
      expect.arrayContaining([
        {
          key: 'iron_ingot_from_iron_ore',
          nameKey: 'productionRecipes.iron_ingot_from_iron_ore.name',
          descriptionKey: 'productionRecipes.iron_ingot_from_iron_ore.description',
          inputResourceId: 'iron_ore',
          inputAmount: 2,
          outputResourceId: 'iron_ingot',
          outputAmount: 1,
        },
      ]),
    );
    expect(getProductionRecipe('iron_ingot_from_iron_ore')).toEqual(
      productionRecipeCatalog[0],
    );
  });

  it('defines the wood to plank recipe with correct ratio', () => {
    const plankRecipe = getProductionRecipe('plank_from_wood');

    expect(plankRecipe).toEqual({
      key: 'plank_from_wood',
      nameKey: 'productionRecipes.plank_from_wood.name',
      descriptionKey: 'productionRecipes.plank_from_wood.description',
      inputResourceId: 'wood',
      inputAmount: 2,
      outputResourceId: 'plank',
      outputAmount: 1,
    });
  });

  it('defines the crude oil to fuel recipe with correct ratio', () => {
    const fuelRecipe = getProductionRecipe('fuel_from_crude_oil');

    expect(fuelRecipe).toEqual({
      key: 'fuel_from_crude_oil',
      nameKey: 'productionRecipes.fuel_from_crude_oil.name',
      descriptionKey: 'productionRecipes.fuel_from_crude_oil.description',
      inputResourceId: 'crude_oil',
      inputAmount: 2,
      outputResourceId: 'fuel',
      outputAmount: 1,
    });
  });
});
