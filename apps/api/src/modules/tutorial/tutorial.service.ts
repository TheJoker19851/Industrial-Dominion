import type { FastifyInstance } from 'fastify';
import {
  starterTutorialActionStepIds,
  starterTutorialSteps,
  type StarterTutorialActionStepId,
  type StarterTutorialProgress,
  type StarterTutorialStepId,
} from '@industrial-dominion/shared';

type LegacyTutorialStepId =
  | 'welcome'
  | 'place_extractor'
  | 'claim_production'
  | 'view_inventory'
  | 'sell_resource';

type TutorialProgressRow = {
  player_id: string;
  tutorial_id: 'starter_loop';
  current_step: StarterTutorialStepId | null;
  completed_step_ids: unknown;
  inventory_viewed_at: string | null;
  skipped_at: string | null;
  completed_at: string | null;
};

type TutorialSignals = {
  hasExtractor: boolean;
  hasProductionClaim: boolean;
  hasMarketSell: boolean;
  hasMarketBuy: boolean;
  hasProductionCompleted: boolean;
  hasLogisticsTransfer: boolean;
};

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

const TUTORIAL_ID = 'starter_loop';

function appendCompletedStep(
  completedStepIds: StarterTutorialActionStepId[],
  stepId: StarterTutorialActionStepId,
) {
  if (!completedStepIds.includes(stepId)) {
    completedStepIds.push(stepId);
  }
}

function normalizeCompletedStepIds(value: unknown): StarterTutorialActionStepId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: StarterTutorialActionStepId[] = [];

  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }

    if (starterTutorialActionStepIds.includes(entry as StarterTutorialActionStepId)) {
      appendCompletedStep(normalized, entry as StarterTutorialActionStepId);
      continue;
    }

    switch (entry as LegacyTutorialStepId) {
      case 'place_extractor':
        appendCompletedStep(normalized, 'extract_resource');
        break;
      case 'claim_production':
        appendCompletedStep(normalized, 'claim_resource');
        break;
      case 'view_inventory':
        appendCompletedStep(normalized, 'open_inventory');
        break;
      case 'sell_resource':
        appendCompletedStep(normalized, 'sell_resource');
        break;
      default:
        break;
    }
  }

  return normalized;
}

function getCurrentStepId(input: {
  completedStepIds: StarterTutorialActionStepId[];
  completedAt: string | null;
}): StarterTutorialStepId {
  if (input.completedAt) {
    return 'complete';
  }

  const completedSet = new Set(input.completedStepIds);
  const nextActionStep = starterTutorialActionStepIds.find(
    (stepId) => !completedSet.has(stepId),
  );

  return nextActionStep ?? 'complete';
}

function getCurrentStepIndex(stepId: StarterTutorialStepId) {
  return stepId === 'complete'
    ? starterTutorialActionStepIds.length
    : starterTutorialActionStepIds.findIndex((entry) => entry === stepId) + 1;
}

function mapTutorialProgress(row: TutorialProgressRow): StarterTutorialProgress {
  const completedStepIds = normalizeCompletedStepIds(row.completed_step_ids);
  const currentStepId =
    row.current_step ??
    getCurrentStepId({
      completedStepIds,
      completedAt: row.completed_at,
    });

  return {
    tutorialId: TUTORIAL_ID,
    currentStepId,
    currentStepIndex: getCurrentStepIndex(currentStepId),
    totalSteps: starterTutorialActionStepIds.length,
    isSkipped: Boolean(row.skipped_at),
    isCompleted: Boolean(row.completed_at),
    completedStepIds,
    steps: starterTutorialSteps.map((step) => ({
      ...step,
      completed:
        step.id === 'complete'
          ? Boolean(row.completed_at)
          : completedStepIds.includes(step.id),
    })),
  };
}

async function readTutorialRow(app: FastifyInstance, playerId: string) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('player_tutorial_progress')
    .select(
      'player_id, tutorial_id, current_step, completed_step_ids, inventory_viewed_at, skipped_at, completed_at',
    )
    .eq('player_id', playerId)
    .maybeSingle<TutorialProgressRow>();

  if (error) {
    throw new Error(`Failed to load tutorial progress: ${error.message}`);
  }

  return data;
}

async function countRecords(
  app: FastifyInstance,
  table: 'buildings' | 'ledger_entries',
  filters: Record<string, string>,
) {
  let query = app
    .getSupabaseAdminClient()
    .from(table)
    .select('*', { count: 'exact', head: true });

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const result = (await query) as CountResult;

  if (result.error) {
    throw new Error(`Failed to inspect tutorial progression state: ${result.error.message}`);
  }

  return result.count ?? 0;
}

async function loadTutorialSignals(
  app: FastifyInstance,
  playerId: string,
): Promise<TutorialSignals> {
  const [
    extractorCount,
    productionClaimCount,
    marketSellCount,
    marketBuyCount,
    productionCompletedCount,
    logisticsTransferCount,
  ] = await Promise.all([
    countRecords(app, 'buildings', {
      player_id: playerId,
    }),
    countRecords(app, 'ledger_entries', {
      player_id: playerId,
      action_type: 'claim_production',
    }),
    countRecords(app, 'ledger_entries', {
      player_id: playerId,
      action_type: 'market_sell',
    }),
    countRecords(app, 'ledger_entries', {
      player_id: playerId,
      action_type: 'market_purchase',
    }),
    countRecords(app, 'ledger_entries', {
      player_id: playerId,
      action_type: 'production_completed',
    }),
    countRecords(app, 'ledger_entries', {
      player_id: playerId,
      action_type: 'logistics_transfer_out',
    }),
  ]);

  return {
    hasExtractor: extractorCount > 0,
    hasProductionClaim: productionClaimCount > 0,
    hasMarketSell: marketSellCount > 0,
    hasMarketBuy: marketBuyCount > 0,
    hasProductionCompleted: productionCompletedCount > 0,
    hasLogisticsTransfer: logisticsTransferCount > 0,
  };
}

function buildSyncedStepIds(
  row: TutorialProgressRow,
  signals: TutorialSignals,
): StarterTutorialActionStepId[] {
  const synced: StarterTutorialActionStepId[] = [];
  const completedSet = new Set(normalizeCompletedStepIds(row.completed_step_ids));

  if (completedSet.has('extract_resource') || signals.hasExtractor) {
    synced.push('extract_resource');
  }

  if (
    synced.includes('extract_resource') &&
    (completedSet.has('claim_resource') || signals.hasProductionClaim)
  ) {
    synced.push('claim_resource');
  }

  if (
    synced.includes('claim_resource') &&
    (completedSet.has('open_inventory') || Boolean(row.inventory_viewed_at))
  ) {
    synced.push('open_inventory');
  }

  if (
    synced.includes('open_inventory') &&
    (completedSet.has('sell_resource') || signals.hasMarketSell)
  ) {
    synced.push('sell_resource');
  }

  if (
    synced.includes('sell_resource') &&
    (completedSet.has('buy_resource') || signals.hasMarketBuy)
  ) {
    synced.push('buy_resource');
  }

  if (
    synced.includes('buy_resource') &&
    (completedSet.has('produce_resource') || signals.hasProductionCompleted)
  ) {
    synced.push('produce_resource');
  }

  if (
    synced.includes('produce_resource') &&
    (completedSet.has('transfer_resource') || signals.hasLogisticsTransfer)
  ) {
    synced.push('transfer_resource');
  }

  return synced;
}

function areStepIdsEqual(
  left: StarterTutorialActionStepId[],
  right: StarterTutorialActionStepId[],
) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function getPersistedCurrentStepId(
  completedStepIds: StarterTutorialActionStepId[],
  completedAt: string | null,
): StarterTutorialStepId {
  return getCurrentStepId({
    completedStepIds,
    completedAt,
  });
}

async function createTutorialRow(
  app: FastifyInstance,
  playerId: string,
  signals: TutorialSignals,
) {
  const baseRow: TutorialProgressRow = {
    player_id: playerId,
    tutorial_id: TUTORIAL_ID,
    current_step: 'extract_resource',
    completed_step_ids: [],
    inventory_viewed_at: null,
    skipped_at: null,
    completed_at: null,
  };
  const completedStepIds = buildSyncedStepIds(baseRow, signals);
  const completedAt = completedStepIds.includes('transfer_resource')
    ? new Date().toISOString()
    : null;

  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('player_tutorial_progress')
    .insert({
      player_id: playerId,
      tutorial_id: TUTORIAL_ID,
      current_step: getPersistedCurrentStepId(completedStepIds, completedAt),
      completed_step_ids: completedStepIds,
      completed_at: completedAt,
    })
    .select(
      'player_id, tutorial_id, current_step, completed_step_ids, inventory_viewed_at, skipped_at, completed_at',
    )
    .single<TutorialProgressRow>();

  if (error || !data) {
    throw new Error(`Failed to create tutorial progress: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

async function ensureTutorialRow(app: FastifyInstance, playerId: string) {
  const existing = await readTutorialRow(app, playerId);

  if (existing) {
    return existing;
  }

  const signals = await loadTutorialSignals(app, playerId);
  return createTutorialRow(app, playerId, signals);
}

async function persistTutorialRow(
  app: FastifyInstance,
  playerId: string,
  patch: Partial<{
    current_step: StarterTutorialStepId;
    completed_step_ids: StarterTutorialActionStepId[];
    inventory_viewed_at: string | null;
    skipped_at: string | null;
    completed_at: string | null;
  }>,
) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('player_tutorial_progress')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('player_id', playerId)
    .select(
      'player_id, tutorial_id, current_step, completed_step_ids, inventory_viewed_at, skipped_at, completed_at',
    )
    .single<TutorialProgressRow>();

  if (error || !data) {
    throw new Error(`Failed to update tutorial progress: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

export async function getStarterTutorialProgress(
  app: FastifyInstance,
  playerId: string,
): Promise<StarterTutorialProgress> {
  let row = await ensureTutorialRow(app, playerId);
  const signals = await loadTutorialSignals(app, playerId);
  const syncedStepIds = buildSyncedStepIds(row, signals);
  const completedAt =
    syncedStepIds.includes('transfer_resource') && !row.completed_at
      ? new Date().toISOString()
      : row.completed_at;
  const currentStep = getPersistedCurrentStepId(syncedStepIds, completedAt);

  if (
    !areStepIdsEqual(syncedStepIds, normalizeCompletedStepIds(row.completed_step_ids)) ||
    completedAt !== row.completed_at ||
    currentStep !== row.current_step
  ) {
    row = await persistTutorialRow(app, playerId, {
      current_step: currentStep,
      completed_step_ids: syncedStepIds,
      completed_at: completedAt,
    });
  }

  return mapTutorialProgress(row);
}

export async function syncStarterTutorialProgress(
  app: FastifyInstance,
  input: {
    playerId: string;
    markInventoryViewed?: boolean;
  },
) {
  let row = await ensureTutorialRow(app, input.playerId);

  if (input.markInventoryViewed && !row.inventory_viewed_at) {
    row = await persistTutorialRow(app, input.playerId, {
      inventory_viewed_at: new Date().toISOString(),
    });
  }

  return getStarterTutorialProgress(app, input.playerId);
}

export async function skipStarterTutorial(
  app: FastifyInstance,
  playerId: string,
): Promise<StarterTutorialProgress> {
  await ensureTutorialRow(app, playerId);
  const row = await persistTutorialRow(app, playerId, {
    skipped_at: new Date().toISOString(),
  });

  return mapTutorialProgress(row);
}
