import type { FastifyInstance } from 'fastify';
import {
  calculateStarterExtractorMetrics,
  starterExtractorCatalog,
  starterTransformRecipes,
  type ProductionTransformRecipeDefinition,
  type RegionId,
  type ResourceId,
  type StarterExtractorDefinition,
  type TransformClaimResult,
  type TransformStartResult,
} from '@industrial-dominion/shared';

type PlayerPlacementState = {
  id: string;
  region_id: RegionId | null;
};

export type FirstExtractorPlacementResult = {
  building: {
    id: string;
    playerId: string;
    regionId: RegionId;
    buildingTypeId: string;
    level: number;
  };
  extractor: StarterExtractorDefinition;
};

export type ClaimProductionResult = {
  building: {
    id: string;
    playerId: string;
    regionId: RegionId;
    buildingTypeId: string;
    level: number;
  };
  extractor: StarterExtractorDefinition;
  claimedQuantity: number;
  inventory: {
    resourceId: ResourceId;
    quantity: number;
  };
  productionJob: {
    id: string;
    startedAt: string;
    completesAt: string;
    claimedAt: string;
  };
};

type BuildingClaimState = {
  id: string;
  player_id: string;
  region_id: RegionId;
  building_type_id: string;
  level: number;
  created_at: string;
};

type ProductionJobState = {
  id?: string;
  completes_at: string;
  recipe_id?: string | null;
  output_resource_id?: ResourceId | null;
  output_amount?: number | null;
};

type InventoryState = {
  quantity: number;
};

async function readPlayerPlacementState(app: FastifyInstance, playerId: string) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('players')
    .select('id, region_id')
    .eq('id', playerId)
    .maybeSingle<PlayerPlacementState>();

  if (error) {
    throw new Error(`Failed to load player placement state: ${error.message}`);
  }

  return data;
}

async function countPlayerBuildings(app: FastifyInstance, playerId: string) {
  const { count, error } = await app
    .getSupabaseAdminClient()
    .from('buildings')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', playerId);

  if (error) {
    throw new Error(`Failed to count player buildings: ${error.message}`);
  }

  return count ?? 0;
}

async function readBuildingClaimState(
  app: FastifyInstance,
  input: {
    playerId: string;
    buildingId: string;
  },
) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('buildings')
    .select('id, player_id, region_id, building_type_id, level, created_at')
    .eq('id', input.buildingId)
    .eq('player_id', input.playerId)
    .maybeSingle<BuildingClaimState>();

  if (error) {
    throw new Error(`Failed to load building claim state: ${error.message}`);
  }

  return data;
}

async function readLatestProductionJob(app: FastifyInstance, buildingId: string) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('production_jobs')
    .select('completes_at')
    .eq('building_id', buildingId)
    .eq('job_kind', 'extraction')
    .order('completes_at', { ascending: false })
    .limit(1)
    .maybeSingle<ProductionJobState>();

  if (error) {
    throw new Error(`Failed to load latest production job: ${error.message}`);
  }

  return data;
}

async function readActiveTransformJob(app: FastifyInstance, input: {
  playerId: string;
  buildingId: string;
  recipeId: string;
}) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('production_jobs')
    .select('id, completes_at, recipe_id, output_resource_id, output_amount')
    .eq('player_id', input.playerId)
    .eq('building_id', input.buildingId)
    .eq('job_kind', 'transform')
    .eq('recipe_id', input.recipeId)
    .is('claimed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ProductionJobState>();

  if (error) {
    throw new Error(`Failed to load active transform job: ${error.message}`);
  }

  return data;
}

async function readInventoryQuantity(
  app: FastifyInstance,
  input: {
    playerId: string;
    resourceId: ResourceId;
  },
) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('inventories')
    .select('quantity')
    .eq('player_id', input.playerId)
    .eq('resource_id', input.resourceId)
    .maybeSingle<InventoryState>();

  if (error) {
    throw new Error(`Failed to load inventory state: ${error.message}`);
  }

  return data?.quantity ?? 0;
}

function resolveStarterExtractor(
  buildingTypeId: string,
  regionId: RegionId,
): StarterExtractorDefinition {
  const extractor = starterExtractorCatalog.find(
    (entry) => entry.id === buildingTypeId,
  );

  if (!extractor) {
    throw new Error('Unknown starter extractor.');
  }

  if (!extractor.allowedRegionIds.some((allowedRegionId) => allowedRegionId === regionId)) {
    throw new Error('Starter extractor does not match the player region.');
  }

  return extractor;
}

function resolvePlacedStarterExtractor(buildingTypeId: string): StarterExtractorDefinition {
  const extractor = starterExtractorCatalog.find(
    (entry) => entry.id === buildingTypeId,
  );

  if (!extractor) {
    throw new Error('Building is not a starter extractor.');
  }

  return extractor;
}

function resolveTransformRecipe(
  buildingTypeId: string,
  recipeId: string,
): ProductionTransformRecipeDefinition {
  const recipe = starterTransformRecipes.find((entry) => entry.id === recipeId);

  if (!recipe) {
    throw new Error('Transform recipe not found.');
  }

  if (recipe.buildingTypeId !== buildingTypeId) {
    throw new Error('Building cannot run this transform recipe.');
  }

  return recipe;
}

export async function placeFirstExtractor(
  app: FastifyInstance,
  input: {
    playerId: string;
    buildingTypeId: string;
  },
): Promise<FirstExtractorPlacementResult> {
  const player = await readPlayerPlacementState(app, input.playerId);

  if (!player?.region_id) {
    throw new Error('Player must complete bootstrap before placing an extractor.');
  }

  const existingBuildings = await countPlayerBuildings(app, input.playerId);

  if (existingBuildings > 0) {
    throw new Error('Player already placed the first extractor.');
  }

  const extractor = resolveStarterExtractor(input.buildingTypeId, player.region_id);
  const { data: building, error: buildingError } = await app
    .getSupabaseAdminClient()
    .from('buildings')
    .insert({
      player_id: input.playerId,
      region_id: player.region_id,
      building_type_id: extractor.id,
      level: 1,
    })
    .select('id, player_id, region_id, building_type_id, level')
    .single<{
      id: string;
      player_id: string;
      region_id: RegionId;
      building_type_id: string;
      level: number;
    }>();

  if (buildingError || !building) {
    throw new Error(`Failed to create first extractor: ${buildingError?.message ?? 'Unknown error'}`);
  }

  const { error: ledgerError } = await app.getSupabaseAdminClient().from('ledger_entries').insert({
    player_id: input.playerId,
    action_type: 'build',
    amount: 0,
    metadata: {
      buildingId: building.id,
      buildingTypeId: building.building_type_id,
      regionId: building.region_id,
      starterPlacement: true,
    },
  });

  if (ledgerError) {
    throw new Error(`Failed to create build ledger entry: ${ledgerError.message}`);
  }

  return {
    building: {
      id: building.id,
      playerId: building.player_id,
      regionId: building.region_id,
      buildingTypeId: building.building_type_id,
      level: building.level,
    },
    extractor,
  };
}

const HOUR_IN_MS = 60 * 60 * 1000;

export async function claimProduction(
  app: FastifyInstance,
  input: {
    playerId: string;
    buildingId: string;
    now?: Date;
  },
): Promise<ClaimProductionResult> {
  const building = await readBuildingClaimState(app, input);

  if (!building) {
    throw new Error('Starter extractor not found for player.');
  }

  const extractor = resolvePlacedStarterExtractor(building.building_type_id);
  const latestJob = await readLatestProductionJob(app, building.id);
  const claimStart = new Date(latestJob?.completes_at ?? building.created_at);
  const claimedAt = input.now ?? new Date();
  const elapsedMs = claimedAt.getTime() - claimStart.getTime();
  const completedHours = Math.floor(elapsedMs / HOUR_IN_MS);

  if (completedHours < 1) {
    throw new Error('No production is ready to claim yet.');
  }

  const completesAt = new Date(claimStart.getTime() + completedHours * HOUR_IN_MS);
  const metrics = calculateStarterExtractorMetrics(extractor, {
    level: building.level,
  });
  const claimedQuantity = Math.floor(metrics.outputPerHour * completedHours);

  if (claimedQuantity < 1) {
    throw new Error('No production is ready to claim yet.');
  }

  const { data: productionJob, error: productionJobError } = await app
    .getSupabaseAdminClient()
    .from('production_jobs')
    .insert({
      building_id: building.id,
      player_id: input.playerId,
      started_at: claimStart.toISOString(),
      completes_at: completesAt.toISOString(),
      claimed_at: claimedAt.toISOString(),
    })
    .select('id, started_at, completes_at, claimed_at')
    .single<{
      id: string;
      started_at: string;
      completes_at: string;
      claimed_at: string;
    }>();

  if (productionJobError || !productionJob) {
    if (productionJobError?.message.toLowerCase().includes('duplicate key')) {
      throw new Error('No production is ready to claim yet.');
    }

    throw new Error(
      `Failed to create production job claim: ${productionJobError?.message ?? 'Unknown error'}`,
    );
  }

  const existingQuantity = await readInventoryQuantity(app, {
    playerId: input.playerId,
    resourceId: extractor.outputResourceId,
  });
  const nextQuantity = existingQuantity + claimedQuantity;
  const { error: inventoryError } = await app.getSupabaseAdminClient().from('inventories').upsert(
    {
      player_id: input.playerId,
      resource_id: extractor.outputResourceId,
      quantity: nextQuantity,
      updated_at: claimedAt.toISOString(),
    },
    {
      onConflict: 'player_id,resource_id',
    },
  );

  if (inventoryError) {
    throw new Error(`Failed to update inventory after production claim: ${inventoryError.message}`);
  }

  const { error: ledgerError } = await app.getSupabaseAdminClient().from('ledger_entries').insert({
    player_id: input.playerId,
    action_type: 'claim_production',
    amount: claimedQuantity,
    resource_id: extractor.outputResourceId,
    metadata: {
      buildingId: building.id,
      buildingTypeId: building.building_type_id,
      startedAt: claimStart.toISOString(),
      completesAt: completesAt.toISOString(),
      claimedAt: claimedAt.toISOString(),
      hoursClaimed: completedHours,
    },
  });

  if (ledgerError) {
    throw new Error(`Failed to create production claim ledger entry: ${ledgerError.message}`);
  }

  return {
    building: {
      id: building.id,
      playerId: building.player_id,
      regionId: building.region_id,
      buildingTypeId: building.building_type_id,
      level: building.level,
    },
    extractor,
    claimedQuantity,
    inventory: {
      resourceId: extractor.outputResourceId,
      quantity: nextQuantity,
    },
    productionJob: {
      id: productionJob.id,
      startedAt: productionJob.started_at,
      completesAt: productionJob.completes_at,
      claimedAt: productionJob.claimed_at,
    },
  };
}

type StartTransformRpcResult = {
  job_id: string;
  building_id: string;
  recipe_id: string;
  input_resource_id: ResourceId;
  input_inventory_quantity: number;
  output_resource_id: ResourceId;
  output_amount: number;
  completes_at: string;
};

type ClaimTransformRpcResult = {
  job_id: string;
  building_id: string;
  recipe_id: string;
  output_resource_id: ResourceId;
  output_amount: number;
  inventory_quantity: number;
  claimed_at: string;
};

export async function startTransform(
  app: FastifyInstance,
  input: {
    playerId: string;
    buildingId: string;
    recipeId: string;
  },
): Promise<TransformStartResult> {
  const building = await readBuildingClaimState(app, {
    playerId: input.playerId,
    buildingId: input.buildingId,
  });

  if (!building) {
    throw new Error('Transform building not found for player.');
  }

  resolveTransformRecipe(building.building_type_id, input.recipeId);

  const { data, error } = await app.getSupabaseAdminClient().rpc('start_transform_job', {
    p_player_id: input.playerId,
    p_building_id: input.buildingId,
    p_recipe_id: input.recipeId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data?.[0] ?? null) as StartTransformRpcResult | null;

  if (!result) {
    throw new Error('Transform start did not return a result.');
  }

  return {
    jobId: result.job_id,
    buildingId: result.building_id,
    recipeId: result.recipe_id,
    inputResourceId: result.input_resource_id,
    inputInventoryQuantity: result.input_inventory_quantity,
    outputResourceId: result.output_resource_id,
    outputAmount: result.output_amount,
    completesAt: result.completes_at,
  };
}

export async function claimTransform(
  app: FastifyInstance,
  input: {
    playerId: string;
    jobId: string;
  },
): Promise<TransformClaimResult> {
  const { data, error } = await app.getSupabaseAdminClient().rpc('claim_transform_job', {
    p_player_id: input.playerId,
    p_job_id: input.jobId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data?.[0] ?? null) as ClaimTransformRpcResult | null;

  if (!result) {
    throw new Error('Transform claim did not return a result.');
  }

  return {
    jobId: result.job_id,
    buildingId: result.building_id,
    recipeId: result.recipe_id,
    outputResourceId: result.output_resource_id,
    outputAmount: result.output_amount,
    inventoryQuantity: result.inventory_quantity,
    claimedAt: result.claimed_at,
  };
}

export async function getAvailableTransformState(
  app: FastifyInstance,
  input: {
    playerId: string;
    buildingId: string;
    buildingTypeId: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  const recipes = starterTransformRecipes.filter(
    (recipe) => recipe.buildingTypeId === input.buildingTypeId,
  );

  return Promise.all(
    recipes.map(async (recipe) => {
      const inventoryQuantity = await readInventoryQuantity(app, {
        playerId: input.playerId,
        resourceId: recipe.inputResourceId,
      });
      const activeJob = await readActiveTransformJob(app, {
        playerId: input.playerId,
        buildingId: input.buildingId,
        recipeId: recipe.id,
      });

      return {
        recipe,
        canStart: !activeJob && inventoryQuantity >= recipe.inputAmount,
        missingInputAmount: Math.max(0, recipe.inputAmount - inventoryQuantity),
        activeJob: activeJob
          ? {
              jobId: activeJob.id!,
              recipeId: activeJob.recipe_id!,
              buildingId: input.buildingId,
              completesAt: activeJob.completes_at,
              readyToClaim: new Date(activeJob.completes_at).getTime() <= now.getTime(),
            }
          : null,
      };
    }),
  );
}
