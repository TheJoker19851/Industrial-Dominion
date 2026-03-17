import type { StarterTutorialProgress } from '@industrial-dominion/shared';
import { apiRequest } from '@/lib/api';

export function getStarterTutorial(accessToken: string) {
  return apiRequest<StarterTutorialProgress>('/tutorial', {
    method: 'GET',
    accessToken,
  });
}

export function skipStarterTutorial(accessToken: string) {
  return apiRequest<StarterTutorialProgress>('/tutorial/skip', {
    method: 'POST',
    accessToken,
  });
}
