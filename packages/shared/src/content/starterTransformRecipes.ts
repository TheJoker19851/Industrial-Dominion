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
  {
    id: 'greenhaven_plank_batch',
    buildingTypeId: 'greenhaven_timber_extractor',
    nameKey: 'transforms.greenhaven_plank_batch.name',
    descriptionKey: 'transforms.greenhaven_plank_batch.description',
    inputResourceId: 'wood',
    inputAmount: 12,
    outputResourceId: 'plank',
    outputAmount: 6,
    durationSeconds: 1800,
  },
  {
    id: 'sunbarrel_fuel_batch',
    buildingTypeId: 'sunbarrel_oil_extractor',
    nameKey: 'transforms.sunbarrel_fuel_batch.name',
    descriptionKey: 'transforms.sunbarrel_fuel_batch.description',
    inputResourceId: 'crude_oil',
    inputAmount: 12,
    outputResourceId: 'fuel',
    outputAmount: 6,
    durationSeconds: 2400,
  },
] as const satisfies readonly ProductionTransformRecipeDefinition[];

export function getStarterTransformRecipesForBuildingType(buildingTypeId: string) {
  return starterTransformRecipes.filter((recipe) => recipe.buildingTypeId === buildingTypeId);
}
