import type {
  StarterTutorialProgress,
  StarterTutorialStepDefinition,
  StarterTutorialStepId,
} from '../types/game.js';

export const starterTutorialActionStepIds = [
  'welcome',
  'place_extractor',
  'claim_production',
  'view_inventory',
  'sell_resource',
] as const;

export const starterTutorialStepIds = [
  ...starterTutorialActionStepIds,
  'complete',
] as const satisfies readonly StarterTutorialStepId[];

export const starterTutorialSteps = [
  {
    id: 'welcome',
    titleKey: 'tutorial.steps.welcome.title',
    descriptionKey: 'tutorial.steps.welcome.description',
    objectiveKey: 'tutorial.steps.welcome.objective',
  },
  {
    id: 'place_extractor',
    titleKey: 'tutorial.steps.place_extractor.title',
    descriptionKey: 'tutorial.steps.place_extractor.description',
    objectiveKey: 'tutorial.steps.place_extractor.objective',
  },
  {
    id: 'claim_production',
    titleKey: 'tutorial.steps.claim_production.title',
    descriptionKey: 'tutorial.steps.claim_production.description',
    objectiveKey: 'tutorial.steps.claim_production.objective',
  },
  {
    id: 'view_inventory',
    titleKey: 'tutorial.steps.view_inventory.title',
    descriptionKey: 'tutorial.steps.view_inventory.description',
    objectiveKey: 'tutorial.steps.view_inventory.objective',
  },
  {
    id: 'sell_resource',
    titleKey: 'tutorial.steps.sell_resource.title',
    descriptionKey: 'tutorial.steps.sell_resource.description',
    objectiveKey: 'tutorial.steps.sell_resource.objective',
  },
  {
    id: 'complete',
    titleKey: 'tutorial.steps.complete.title',
    descriptionKey: 'tutorial.steps.complete.description',
    objectiveKey: 'tutorial.steps.complete.objective',
  },
] as const satisfies readonly StarterTutorialStepDefinition[];

export function getStarterTutorialStepDefinition(stepId: StarterTutorialStepId) {
  return starterTutorialSteps.find((step) => step.id === stepId);
}

export function getStarterTutorialCurrentStep(
  progress: Pick<StarterTutorialProgress, 'isCompleted' | 'currentStepId'>,
) {
  return getStarterTutorialStepDefinition(progress.currentStepId);
}
