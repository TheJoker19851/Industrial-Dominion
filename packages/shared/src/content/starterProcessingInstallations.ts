import type { StarterProcessingInstallationDefinition } from '../types/game.js';

export const starterProcessingInstallationCatalog = [
  {
    id: 'starter_processing_installation',
    nameKey: 'buildingTypes.starter_processing_installation.name',
    descriptionKey: 'buildingTypes.starter_processing_installation.description',
    category: 'processing',
  },
] as const satisfies readonly StarterProcessingInstallationDefinition[];

export function getStarterProcessingInstallation() {
  return starterProcessingInstallationCatalog[0];
}
