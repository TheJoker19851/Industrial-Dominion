import type {
  DashboardSnapshot,
  EconomicDecisionSnapshot,
  RegionId,
  ResourceId,
  StrategyResult,
} from '@industrial-dominion/shared';
import { apiRequest } from '@/lib/api';

export type EconomicStrategy =
  | 'SELL_LOCAL'
  | 'PROCESS_AND_SELL_LOCAL'
  | 'TRANSPORT_AND_SELL'
  | 'PROCESS_THEN_TRANSPORT_AND_SELL';

export interface DecisionExecutionResult {
  decisionId: string;
  orderId: string;
  pricePerUnit: number;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  inventoryQuantity: number;
  playerCredits: number;
  strategy: EconomicStrategy;
  resource: ResourceId;
  quantity: number;
  region: RegionId;
  outputResourceId?: ResourceId;
  inputConsumed?: number;
  outputProduced?: number;
}

export interface DecisionHistoryEntry {
  id: string;
  strategy: EconomicStrategy;
  resourceId: ResourceId;
  quantity: number;
  originRegion: RegionId;
  destinationRegion: RegionId | null;
  result: Record<string, unknown>;
  status: string;
  createdAt: string;
}

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

export function previewEconomicDecision(input: {
  accessToken: string;
  resource: ResourceId;
  quantity: number;
  region: RegionId;
}) {
  return apiRequest<EconomicDecisionSnapshot>('/economics/decision-preview', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      resource: input.resource,
      quantity: input.quantity,
      region: input.region,
    }),
  });
}

export interface BatchAnalysisEntry {
  resource: ResourceId;
  quantity: number;
  region: RegionId;
  snapshot: { ranked: StrategyResult[] };
}

export interface BatchAnalysisResult {
  analyses: BatchAnalysisEntry[];
}

export function batchAnalyzeDecision(input: {
  accessToken: string;
  resource: ResourceId;
  quantities: number[];
  regions: RegionId[];
}) {
  return apiRequest<BatchAnalysisResult>('/economics/batch-analysis', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      resource: input.resource,
      quantities: input.quantities,
      regions: input.regions,
    }),
  });
}

export interface MarketSignal {
  key: string;
  severity: 'info' | 'caution' | 'warning';
  params: Record<string, string | number>;
}

export interface MarketSignalsResult {
  signals: MarketSignal[];
}

export function getMarketSignals(input: {
  accessToken: string;
  resource: ResourceId;
  quantity: number;
  region: RegionId;
}) {
  return apiRequest<MarketSignalsResult>('/economics/market-signals', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      resource: input.resource,
      quantity: input.quantity,
      region: input.region,
    }),
  });
}

export function executeDecision(input: {
  accessToken: string;
  strategy: EconomicStrategy;
  resource: ResourceId;
  quantity: number;
  region: RegionId;
}) {
  return apiRequest<DecisionExecutionResult>('/economics/decision-execute', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      strategy: input.strategy,
      resource: input.resource,
      quantity: input.quantity,
      region: input.region,
    }),
  });
}

export function getDecisionHistory(input: {
  accessToken: string;
  limit?: number;
}) {
  const params = input.limit ? `?limit=${input.limit}` : '';
  return apiRequest<{ history: DecisionHistoryEntry[] }>(
    `/economics/decision-history${params}`,
    {
      method: 'GET',
      accessToken: input.accessToken,
    },
  );
}
