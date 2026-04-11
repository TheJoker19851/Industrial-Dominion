import type {
  StarterTutorialProgress,
  StarterTutorialStepDefinition,
  StarterTutorialStepId,
} from '../types/game.js';

export const starterTutorialActionStepIds = [
  'extract_resource',
  'claim_resource',
  'open_inventory',
  'sell_resource',
  'buy_resource',
  'produce_resource',
  'transfer_resource',
] as const;

export const starterTutorialStepIds = [
  ...starterTutorialActionStepIds,
  'complete',
] as const satisfies readonly StarterTutorialStepId[];

export const starterTutorialSteps = [
  {
    id: 'extract_resource',
    titleKey: 'tutorial.steps.extract_resource.title',
    descriptionKey: 'tutorial.steps.extract_resource.description',
    objectiveKey: 'tutorial.steps.extract_resource.objective',
  },
  {
    id: 'claim_resource',
    titleKey: 'tutorial.steps.claim_resource.title',
    descriptionKey: 'tutorial.steps.claim_resource.description',
    objectiveKey: 'tutorial.steps.claim_resource.objective',
  },
  {
    id: 'open_inventory',
    titleKey: 'tutorial.steps.open_inventory.title',
    descriptionKey: 'tutorial.steps.open_inventory.description',
    objectiveKey: 'tutorial.steps.open_inventory.objective',
  },
  {
    id: 'sell_resource',
    titleKey: 'tutorial.steps.sell_resource.title',
    descriptionKey: 'tutorial.steps.sell_resource.description',
    objectiveKey: 'tutorial.steps.sell_resource.objective',
  },
  {
    id: 'buy_resource',
    titleKey: 'tutorial.steps.buy_resource.title',
    descriptionKey: 'tutorial.steps.buy_resource.description',
    objectiveKey: 'tutorial.steps.buy_resource.objective',
  },
  {
    id: 'produce_resource',
    titleKey: 'tutorial.steps.produce_resource.title',
    descriptionKey: 'tutorial.steps.produce_resource.description',
    objectiveKey: 'tutorial.steps.produce_resource.objective',
  },
  {
    id: 'transfer_resource',
    titleKey: 'tutorial.steps.transfer_resource.title',
    descriptionKey: 'tutorial.steps.transfer_resource.description',
    objectiveKey: 'tutorial.steps.transfer_resource.objective',
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
