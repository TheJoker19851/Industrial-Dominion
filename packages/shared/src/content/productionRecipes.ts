import type { ProductionRecipeDefinition } from '../types/game.js';

export const productionRecipeCatalog = [
  {
    key: 'iron_ingot_from_iron_ore',
    nameKey: 'productionRecipes.iron_ingot_from_iron_ore.name',
    descriptionKey: 'productionRecipes.iron_ingot_from_iron_ore.description',
    inputResourceId: 'iron_ore',
    inputAmount: 2,
    outputResourceId: 'iron_ingot',
    outputAmount: 1,
  },
  {
    key: 'plank_from_wood',
    nameKey: 'productionRecipes.plank_from_wood.name',
    descriptionKey: 'productionRecipes.plank_from_wood.description',
    inputResourceId: 'wood',
    inputAmount: 2,
    outputResourceId: 'plank',
    outputAmount: 1,
  },
] as const satisfies readonly ProductionRecipeDefinition[];

export function getProductionRecipe(recipeKey: string) {
  return productionRecipeCatalog.find((recipe) => recipe.key === recipeKey);
}
