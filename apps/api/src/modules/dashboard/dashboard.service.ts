import type { FastifyInstance } from 'fastify';
import {
  calculateStarterExtractorMetrics,
  starterExtractorCatalog,
  type DashboardSnapshot,
  type DashboardTransformRecipeSummary,
  type InventoryEntry,
  type LedgerActionType,
  type LedgerFeedEntry,
  type NewsFeedItem,
  type PlayerProfile,
  type RegionId,
  type ResourceId,
  type SupportedLocale,
} from '@industrial-dominion/shared';
import { getAvailableTransformState } from '../buildings/buildings.service.js';

type PlayerRow = {
  id: string;
  locale: SupportedLocale;
  credits: number;
  region_id: RegionId | null;
};

type BuildingRow = {
  id: string;
  building_type_id: string;
  level: number;
  created_at: string;
};

type ProductionJobRow = {
  id: string;
  completes_at: string;
  recipe_id: string | null;
  job_kind?: 'extraction' | 'transform';
};

type InventoryRow = {
  player_id: string;
  resource_id: ResourceId;
  quantity: number;
};

type LedgerRow = {
  id: string;
  action_type: LedgerActionType;
  amount: number;
  resource_id: ResourceId | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type NewsRow = {
  id: string;
  headline_key: string;
  body_key: string;
  scope: 'system' | 'global' | 'regional' | 'corporation';
  created_at: string;
};

const HOUR_IN_MS = 60 * 60 * 1000;

function mapPlayer(player: PlayerRow | null): PlayerProfile | null {
  if (!player) {
    return null;
  }

  return {
    id: player.id,
    locale: player.locale,
    credits: player.credits,
    regionId: player.region_id ?? undefined,
  };
}

export async function getDashboardSnapshot(
  app: FastifyInstance,
  input: {
    playerId: string;
    now?: Date;
  },
): Promise<DashboardSnapshot> {
  const supabase = app.getSupabaseAdminClient();
  const now = input.now ?? new Date();

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, locale, credits, region_id')
    .eq('id', input.playerId)
    .maybeSingle<PlayerRow>();

  if (playerError) {
    throw new Error(`Failed to load dashboard player state: ${playerError.message}`);
  }

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('inventories')
    .select('player_id, resource_id, quantity')
    .eq('player_id', input.playerId)
    .gt('quantity', 0)
    .order('quantity', { ascending: false })
    .returns<InventoryRow[]>();

  if (inventoryError) {
    throw new Error(`Failed to load dashboard inventory state: ${inventoryError.message}`);
  }

  const { data: building, error: buildingError } = await supabase
    .from('buildings')
    .select('id, building_type_id, level, created_at')
    .eq('player_id', input.playerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<BuildingRow>();

  if (buildingError) {
    throw new Error(`Failed to load dashboard building state: ${buildingError.message}`);
  }

  const { data: ledgerRows, error: ledgerError } = await supabase
    .from('ledger_entries')
    .select('id, action_type, amount, resource_id, created_at, metadata')
    .eq('player_id', input.playerId)
    .order('created_at', { ascending: false })
    .limit(5)
    .returns<LedgerRow[]>();

  if (ledgerError) {
    throw new Error(`Failed to load dashboard ledger state: ${ledgerError.message}`);
  }

  const { data: newsRows, error: newsError } = await supabase
    .from('news_items')
    .select('id, headline_key, body_key, scope, created_at')
    .eq('scope', 'system')
    .order('created_at', { ascending: false })
    .limit(3)
    .returns<NewsRow[]>();

  if (newsError) {
    throw new Error(`Failed to load dashboard news state: ${newsError.message}`);
  }

  let extractor: DashboardSnapshot['extractor'] = null;
  let transformRecipes: DashboardTransformRecipeSummary[] = [];

  if (building) {
    const starterExtractor = starterExtractorCatalog.find(
      (entry) => entry.id === building.building_type_id,
    );

    if (starterExtractor) {
      const { data: latestJob, error: latestJobError } = await supabase
        .from('production_jobs')
        .select('id, completes_at, recipe_id, job_kind')
        .eq('building_id', building.id)
        .eq('job_kind', 'extraction')
        .order('completes_at', { ascending: false })
        .limit(1)
        .maybeSingle<ProductionJobRow>();

      if (latestJobError) {
        throw new Error(
          `Failed to load dashboard production state: ${latestJobError.message}`,
        );
      }

      const claimAnchor = new Date(latestJob?.completes_at ?? building.created_at);
      const elapsedMs = now.getTime() - claimAnchor.getTime();
      const completedHours = Math.max(0, Math.floor(elapsedMs / HOUR_IN_MS));
      const metrics = calculateStarterExtractorMetrics(starterExtractor, {
        level: building.level,
      });
      const claimableQuantity = Math.floor(metrics.outputPerHour * completedHours);
      const nextClaimAt = new Date(
        claimAnchor.getTime() + (completedHours + 1) * HOUR_IN_MS,
      );

      extractor = {
        buildingId: building.id,
        buildingTypeId: building.building_type_id,
        level: building.level,
        outputResourceId: starterExtractor.outputResourceId,
        outputPerHour: metrics.outputPerHour,
        claimableQuantity,
        readyToClaim: claimableQuantity > 0,
        nextClaimAt: nextClaimAt.toISOString(),
      };

      transformRecipes = (
        await getAvailableTransformState(app, {
          playerId: input.playerId,
          buildingId: building.id,
          buildingTypeId: building.building_type_id,
          now,
        })
      ).map<DashboardTransformRecipeSummary>((entry) => ({
        recipeId: entry.recipe.id,
        buildingId: building.id,
        nameKey: entry.recipe.nameKey,
        descriptionKey: entry.recipe.descriptionKey,
        inputResourceId: entry.recipe.inputResourceId,
        inputAmount: entry.recipe.inputAmount,
        outputResourceId: entry.recipe.outputResourceId,
        outputAmount: entry.recipe.outputAmount,
        durationSeconds: entry.recipe.durationSeconds,
        canStart: entry.canStart,
        missingInputAmount: entry.missingInputAmount,
        activeJob: entry.activeJob,
      }));
    }
  }

  return {
    player: mapPlayer(player),
    inventory: (inventoryRows ?? []).map<InventoryEntry>((entry) => ({
      playerId: entry.player_id,
      resourceId: entry.resource_id,
      quantity: entry.quantity,
    })),
    extractor,
    transformRecipes,
    ledger: (ledgerRows ?? []).map<LedgerFeedEntry>((entry) => ({
      id: entry.id,
      actionType: entry.action_type,
      amount: entry.amount,
      resourceId: entry.resource_id ?? undefined,
      createdAt: entry.created_at,
      metadata: entry.metadata ?? {},
    })),
    news: (newsRows ?? []).map<NewsFeedItem>((entry) => ({
      id: entry.id,
      headlineKey: entry.headline_key,
      bodyKey: entry.body_key,
      scope: entry.scope,
      createdAt: entry.created_at,
    })),
  };
}
