import type { ProductionTransformRecipeDefinition } from '../types/game.js';

export const starterTransformRecipes = [
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
] as const satisfies readonly ProductionTransformRecipeDefinition[];

export function getStarterTransformRecipesForBuildingType(buildingTypeId: string) {
  return starterTransformRecipes.filter((recipe) => recipe.buildingTypeId === buildingTypeId);
}
