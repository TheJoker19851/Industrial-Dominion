import type { DashboardSnapshot } from '@industrial-dominion/shared';
import { apiRequest } from '@/lib/api';

export function getDashboardSnapshot(accessToken: string) {
  return apiRequest<DashboardSnapshot>('/dashboard', {
    method: 'GET',
    accessToken,
  });
}

export function placeFirstExtractor(input: {
  accessToken: string;
  buildingTypeId: string;
}) {
  return apiRequest('/buildings/first-extractor', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      buildingTypeId: input.buildingTypeId,
    }),
  });
}

export function placeFirstProcessingInstallation(input: {
  accessToken: string;
  buildingTypeId: string;
}) {
  return apiRequest('/buildings/first-processing-installation', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      buildingTypeId: input.buildingTypeId,
    }),
  });
}

export function claimExtractorProduction(input: {
  accessToken: string;
  buildingId: string;
}) {
  return apiRequest('/buildings/' + input.buildingId + '/claim-production', {
    method: 'POST',
    accessToken: input.accessToken,
  });
}

export function startTransformJob(input: {
  accessToken: string;
  buildingId: string;
  recipeId: string;
}) {
  return apiRequest('/buildings/' + input.buildingId + '/start-transform', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      recipeId: input.recipeId,
    }),
  });
}

export function claimTransformJob(input: {
  accessToken: string;
  jobId: string;
}) {
  return apiRequest('/buildings/transform-jobs/' + input.jobId + '/claim', {
    method: 'POST',
    accessToken: input.accessToken,
  });
}

export function createProductionJob(input: {
  accessToken: string;
  recipeKey: string;
  runs: number;
}) {
  return apiRequest('/production/jobs', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      recipeKey: input.recipeKey,
      runs: input.runs,
    }),
  });
}

export function createLogisticsTransfer(input: {
  accessToken: string;
  fromLocationId: string;
  toLocationId: string;
  itemKey: string;
  quantity: number;
}) {
  return apiRequest('/logistics/transfers', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      itemKey: input.itemKey,
      quantity: input.quantity,
    }),
  });
}
