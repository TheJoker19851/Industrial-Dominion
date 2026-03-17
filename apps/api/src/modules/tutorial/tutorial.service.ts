import type { FastifyInstance } from 'fastify';
import {
  starterTutorialActionStepIds,
  starterTutorialSteps,
  type StarterTutorialActionStepId,
  type StarterTutorialProgress,
  type StarterTutorialStepId,
} from '@industrial-dominion/shared';

type TutorialProgressRow = {
  player_id: string;
  tutorial_id: 'starter_loop';
  completed_step_ids: unknown;
  inventory_viewed_at: string | null;
  skipped_at: string | null;
  completed_at: string | null;
};

type TutorialSignals = {
  hasStarterGrant: boolean;
  hasExtractor: boolean;
  hasProductionClaim: boolean;
  hasMarketSell: boolean;
};

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

const TUTORIAL_ID = 'starter_loop';

function normalizeCompletedStepIds(value: unknown): StarterTutorialActionStepId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is StarterTutorialActionStepId =>
    typeof entry === 'string' &&
    starterTutorialActionStepIds.includes(entry as StarterTutorialActionStepId),
  );
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
    ? starterTutorialSteps.length
    : starterTutorialSteps.findIndex((step) => step.id === stepId) + 1;
}

function mapTutorialProgress(row: TutorialProgressRow): StarterTutorialProgress {
  const completedStepIds = normalizeCompletedStepIds(row.completed_step_ids);
  const currentStepId = getCurrentStepId({
    completedStepIds,
    completedAt: row.completed_at,
  });

  return {
    tutorialId: TUTORIAL_ID,
    currentStepId,
    currentStepIndex: getCurrentStepIndex(currentStepId),
    totalSteps: starterTutorialSteps.length,
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
      'player_id, tutorial_id, completed_step_ids, inventory_viewed_at, skipped_at, completed_at',
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
  const [starterGrantCount, extractorCount, productionClaimCount, marketSellCount] =
    await Promise.all([
      countRecords(app, 'ledger_entries', {
        player_id: playerId,
        action_type: 'starter_grant',
      }),
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
    ]);

  return {
    hasStarterGrant: starterGrantCount > 0,
    hasExtractor: extractorCount > 0,
    hasProductionClaim: productionClaimCount > 0,
    hasMarketSell: marketSellCount > 0,
  };
}

async function createTutorialRow(
  app: FastifyInstance,
  playerId: string,
  signals: TutorialSignals,
) {
  const completedStepIds: StarterTutorialActionStepId[] = [];

  if (signals.hasStarterGrant) {
    completedStepIds.push('welcome');
  }

  if (completedStepIds.includes('welcome') && signals.hasExtractor) {
    completedStepIds.push('place_extractor');
  }

  if (completedStepIds.includes('place_extractor') && signals.hasProductionClaim) {
    completedStepIds.push('claim_production');
  }

  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('player_tutorial_progress')
    .insert({
      player_id: playerId,
      tutorial_id: TUTORIAL_ID,
      completed_step_ids: completedStepIds,
    })
    .select(
      'player_id, tutorial_id, completed_step_ids, inventory_viewed_at, skipped_at, completed_at',
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
      'player_id, tutorial_id, completed_step_ids, inventory_viewed_at, skipped_at, completed_at',
    )
    .single<TutorialProgressRow>();

  if (error || !data) {
    throw new Error(`Failed to update tutorial progress: ${error?.message ?? 'Unknown error'}`);
  }

  return data;
}

function buildSyncedStepIds(
  row: TutorialProgressRow,
  signals: TutorialSignals,
): StarterTutorialActionStepId[] {
  const synced: StarterTutorialActionStepId[] = [];
  const completedSet = new Set(normalizeCompletedStepIds(row.completed_step_ids));

  if (completedSet.has('welcome') || signals.hasStarterGrant) {
    synced.push('welcome');
  }

  if (synced.includes('welcome') && (completedSet.has('place_extractor') || signals.hasExtractor)) {
    synced.push('place_extractor');
  }

  if (
    synced.includes('place_extractor') &&
    (completedSet.has('claim_production') || signals.hasProductionClaim)
  ) {
    synced.push('claim_production');
  }

  if (
    synced.includes('claim_production') &&
    (completedSet.has('view_inventory') || Boolean(row.inventory_viewed_at))
  ) {
    synced.push('view_inventory');
  }

  if (
    synced.includes('view_inventory') &&
    (completedSet.has('sell_resource') || signals.hasMarketSell)
  ) {
    synced.push('sell_resource');
  }

  return synced;
}

function areStepIdsEqual(
  left: StarterTutorialActionStepId[],
  right: StarterTutorialActionStepId[],
) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export async function getStarterTutorialProgress(
  app: FastifyInstance,
  playerId: string,
): Promise<StarterTutorialProgress> {
  let row = await ensureTutorialRow(app, playerId);
  const signals = await loadTutorialSignals(app, playerId);
  const syncedStepIds = buildSyncedStepIds(row, signals);
  const completedAt =
    syncedStepIds.includes('sell_resource') && !row.completed_at
      ? new Date().toISOString()
      : row.completed_at;

  if (
    !areStepIdsEqual(syncedStepIds, normalizeCompletedStepIds(row.completed_step_ids)) ||
    completedAt !== row.completed_at
  ) {
    row = await persistTutorialRow(app, playerId, {
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
