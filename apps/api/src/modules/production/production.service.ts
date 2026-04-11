import type { FastifyInstance } from 'fastify';
import {
  getProductionRecipe,
  type ProductionJobResult,
  type ResourceId,
} from '@industrial-dominion/shared';

const STARTER_TRANSFORM_RECIPE_KEY = 'iron_ingot_from_iron_ore';
const STARTER_PROCESSING_INSTALLATION_BUILDING_TYPE_ID =
  'starter_processing_installation';

type CreateProductionJobRpcResult = {
  job_id: string;
  building_id: string;
  recipe_key: string;
  runs: number;
  input_resource_id: ResourceId;
  input_amount: number;
  input_inventory_quantity: number;
  output_resource_id: ResourceId;
  output_amount: number;
  output_inventory_quantity: number;
  completed_at: string;
};

async function hasStarterProcessingInstallation(app: FastifyInstance, playerId: string) {
  const { count, error } = await app
    .getSupabaseAdminClient()
    .from('buildings')
    .select('*', { count: 'exact', head: true })
    .eq('player_id', playerId)
    .in('building_type_id', [STARTER_PROCESSING_INSTALLATION_BUILDING_TYPE_ID]);

  if (error) {
    throw new Error(`Failed to validate starter processing installation: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

export async function createProductionJob(
  app: FastifyInstance,
  input: {
    playerId: string;
    recipeKey: string;
    runs: number;
  },
): Promise<ProductionJobResult> {
  const recipe = getProductionRecipe(input.recipeKey);

  if (!recipe) {
    throw new Error('Production recipe not found.');
  }

  if (!Number.isInteger(input.runs) || input.runs < 1) {
    throw new Error('Production runs must be at least 1.');
  }

  if (recipe.key === STARTER_TRANSFORM_RECIPE_KEY) {
    const hasProcessingInstallation = await hasStarterProcessingInstallation(app, input.playerId);

    if (!hasProcessingInstallation) {
      throw new Error('Starter processing installation required for production.');
    }
  }

  const { data, error } = await app.getSupabaseAdminClient().rpc('create_production_job', {
    p_player_id: input.playerId,
    p_recipe_key: input.recipeKey,
    p_runs: input.runs,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data?.[0] ?? null) as CreateProductionJobRpcResult | null;

  if (!result) {
    throw new Error('Production job did not return a result.');
  }

  return {
    jobId: result.job_id,
    buildingId: result.building_id,
    recipeKey: result.recipe_key,
    runs: result.runs,
    inputResourceId: result.input_resource_id,
    inputAmount: result.input_amount,
    inputInventoryQuantity: result.input_inventory_quantity,
    outputResourceId: result.output_resource_id,
    outputAmount: result.output_amount,
    outputInventoryQuantity: result.output_inventory_quantity,
    completedAt: result.completed_at,
  };
}
