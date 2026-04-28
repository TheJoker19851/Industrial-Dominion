import type { FastifyInstance } from 'fastify';
import { gameConfig } from '@industrial-dominion/config';
import type {
  EconomicStrategy,
  MarketContextForDecision,
  RegionId,
  ResourceId,
} from '@industrial-dominion/shared';
import {
  buildEconomicDecisionSnapshot,
  calculateSlippageQuote,
  calculateTransportCost,
  resourceLiquidityConfig,
  starterTransformRecipes,
} from '@industrial-dominion/shared';
import type { StrategyResult } from '@industrial-dominion/shared';
import { getMarketContextPrice } from '../market/market-context.js';

type ResourceRow = {
  id: ResourceId;
  base_price: number;
  tradable: boolean;
};

type AllResourceRow = {
  id: ResourceId;
  base_price: number;
  tradable: boolean;
};

const instantTradeSpreadRate = 0.05;

function applyInstantTradeSpread(price: number, side: 'buy' | 'sell') {
  const adjustedPrice =
    side === 'buy'
      ? Math.round(price * (1 + instantTradeSpreadRate))
      : Math.round(price * (1 - instantTradeSpreadRate));

  return Math.max(1, adjustedPrice);
}

const allRegionIds: RegionId[] = [
  'ironridge',
  'greenhaven',
  'sunbarrel',
  'riverplain',
];
const allResourceIds: ResourceId[] = [
  'iron_ore',
  'iron_ingot',
  'coal',
  'wood',
  'plank',
  'crude_oil',
  'fuel',
  'sand',
  'water',
  'crops',
];

export interface BatchAnalysisEntry {
  resource: ResourceId;
  quantity: number;
  region: RegionId;
  snapshot: { ranked: StrategyResult[] };
}

export interface BatchAnalysisResult {
  analyses: BatchAnalysisEntry[];
}

export async function batchAnalyze(
  app: FastifyInstance,
  input: {
    playerId: string;
    resource: ResourceId;
    quantities: number[];
    regions: RegionId[];
  },
) {
  const supabase = app.getSupabaseAdminClient();

  const { data: resourceRow, error: resourceError } = await supabase
    .from('resources')
    .select('id, base_price, tradable')
    .eq('id', input.resource)
    .maybeSingle<ResourceRow>();

  if (resourceError) {
    throw new Error(`Failed to load resource: ${resourceError.message}`);
  }

  if (!resourceRow) {
    throw new Error('Resource not found.');
  }

  if (!resourceRow.tradable) {
    throw new Error('Resource is not tradable.');
  }

  const { data: allResources, error: allResourcesError } = await supabase
    .from('resources')
    .select('id, base_price, tradable')
    .in('id', allResourceIds)
    .returns<AllResourceRow[]>();

  if (allResourcesError) {
    throw new Error(`Failed to load resources: ${allResourcesError.message}`);
  }

  const resourceBasePriceMap = new Map<string, number>();
  for (const row of allResources ?? []) {
    resourceBasePriceMap.set(row.id, row.base_price);
  }

  const pricesByResourceAndRegion: MarketContextForDecision['pricesByResourceAndRegion'] =
    {};
  for (const resId of allResourceIds) {
    const basePrice = resourceBasePriceMap.get(resId) ?? 0;
    pricesByResourceAndRegion[resId] = allRegionIds.map((regionId) => {
      const contextPrice = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId,
        resourceId: resId,
        basePrice,
        side: 'sell',
      });
      const anchorPrice = applyInstantTradeSpread(contextPrice.price, 'sell');
      return { regionId, anchorPrice };
    });
  }

  const recipes = starterTransformRecipes.map((r) => ({
    inputResourceId: r.inputResourceId,
    inputAmount: r.inputAmount,
    outputResourceId: r.outputResourceId,
    outputAmount: r.outputAmount,
    durationSeconds: r.durationSeconds,
  }));

  const marketContext: MarketContextForDecision = {
    feeRate: gameConfig.marketFee,
    pricesByResourceAndRegion,
    recipes,
  };

  const analyses: BatchAnalysisEntry[] = [];

  for (const region of input.regions) {
    for (const quantity of input.quantities) {
      const snapshot = buildEconomicDecisionSnapshot({
        resource: input.resource,
        quantity,
        region,
        marketContext,
      });
      analyses.push({
        resource: input.resource,
        quantity,
        region,
        snapshot: { ranked: snapshot.ranked },
      });
    }
  }

  return { analyses };
}

export async function previewDecision(
  app: FastifyInstance,
  input: {
    playerId: string;
    resource: ResourceId;
    quantity: number;
    region: RegionId;
  },
) {
  const supabase = app.getSupabaseAdminClient();

  const { data: resourceRow, error: resourceError } = await supabase
    .from('resources')
    .select('id, base_price, tradable')
    .eq('id', input.resource)
    .maybeSingle<ResourceRow>();

  if (resourceError) {
    throw new Error(`Failed to load resource: ${resourceError.message}`);
  }

  if (!resourceRow) {
    throw new Error('Resource not found.');
  }

  if (!resourceRow.tradable) {
    throw new Error('Resource is not tradable.');
  }

  const { data: allResources, error: allResourcesError } = await supabase
    .from('resources')
    .select('id, base_price, tradable')
    .in('id', allResourceIds)
    .returns<AllResourceRow[]>();

  if (allResourcesError) {
    throw new Error(`Failed to load resources: ${allResourcesError.message}`);
  }

  const resourceBasePriceMap = new Map<string, number>();
  for (const row of allResources ?? []) {
    resourceBasePriceMap.set(row.id, row.base_price);
  }

  const pricesByResourceAndRegion: MarketContextForDecision['pricesByResourceAndRegion'] =
    {};
  for (const resId of allResourceIds) {
    const basePrice = resourceBasePriceMap.get(resId) ?? 0;
    pricesByResourceAndRegion[resId] = allRegionIds.map((regionId) => {
      const contextPrice = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId,
        resourceId: resId,
        basePrice,
        side: 'sell',
      });
      const anchorPrice = applyInstantTradeSpread(contextPrice.price, 'sell');
      return { regionId, anchorPrice };
    });
  }

  const recipes = starterTransformRecipes.map((r) => ({
    inputResourceId: r.inputResourceId,
    inputAmount: r.inputAmount,
    outputResourceId: r.outputResourceId,
    outputAmount: r.outputAmount,
    durationSeconds: r.durationSeconds,
  }));

  const marketContext: MarketContextForDecision = {
    feeRate: gameConfig.marketFee,
    pricesByResourceAndRegion,
    recipes,
  };

  return buildEconomicDecisionSnapshot({
    resource: input.resource,
    quantity: input.quantity,
    region: input.region,
    marketContext,
  });
}

export interface MarketSignal {
  key: string;
  severity: 'info' | 'caution' | 'warning';
  params: Record<string, string | number>;
}

export async function getMarketSignals(
  app: FastifyInstance,
  input: {
    playerId: string;
    resource: ResourceId;
    quantity: number;
    region: RegionId;
  },
) {
  const supabase = app.getSupabaseAdminClient();

  const { data: resourceRow, error: resourceError } = await supabase
    .from('resources')
    .select('id, base_price, tradable')
    .eq('id', input.resource)
    .maybeSingle<ResourceRow>();

  if (resourceError) {
    throw new Error(`Failed to load resource: ${resourceError.message}`);
  }

  if (!resourceRow) {
    throw new Error('Resource not found.');
  }

  if (!resourceRow.tradable) {
    throw new Error('Resource is not tradable.');
  }

  const basePrice = resourceRow.base_price;
  const liquidityConfig = resourceLiquidityConfig[input.resource];
  const signals: MarketSignal[] = [];

  const contextPrice = getMarketContextPrice({
    contextKey: 'region_anchor',
    regionId: input.region,
    resourceId: input.resource,
    basePrice,
    side: 'sell',
  });
  const anchorPrice = applyInstantTradeSpread(contextPrice.price, 'sell');

  const slippage = calculateSlippageQuote({
    anchorPrice,
    quantity: input.quantity,
    side: 'sell',
    resourceId: input.resource,
  });

  if (slippage.slippageBps > 200) {
    signals.push({
      key: 'HIGH_SLIPPAGE_RISK',
      severity: 'warning',
      params: {
        slippagePercent: slippage.slippagePercent.toFixed(1),
        liquidityDepth: liquidityConfig.depth,
        quantity: input.quantity,
      },
    });
  } else if (slippage.slippageBps > 50) {
    signals.push({
      key: 'MODERATE_SLIPPAGE',
      severity: 'caution',
      params: {
        slippagePercent: slippage.slippagePercent.toFixed(1),
        liquidityDepth: liquidityConfig.depth,
      },
    });
  }

  if (input.quantity > liquidityConfig.depth) {
    signals.push({
      key: 'EXCEEDS_LIQUIDITY_DEPTH',
      severity: 'caution',
      params: {
        quantity: input.quantity,
        depth: liquidityConfig.depth,
      },
    });
  }

  const gross = slippage.totalGross;
  const fee = Math.round(gross * gameConfig.marketFee);
  const net = gross - fee;
  const marginPercent = gross > 0 ? (net / gross) * 100 : 0;

  if (marginPercent < 85) {
    signals.push({
      key: 'LOW_SELL_MARGIN',
      severity: 'warning',
      params: {
        marginPercent: marginPercent.toFixed(1),
        feePercent: (gameConfig.marketFee * 100).toFixed(0),
      },
    });
  }

  if (liquidityConfig.depth <= 20) {
    signals.push({
      key: 'THIN_LIQUIDITY',
      severity: 'info',
      params: {
        depth: liquidityConfig.depth,
      },
    });
  }

  if (contextPrice.modifierPercent !== 0) {
    signals.push({
      key: 'REGIONAL_PRICE_MODIFIER',
      severity: 'info',
      params: {
        modifierPercent: (contextPrice.modifierPercent * 100).toFixed(0),
      },
    });
  }

  return { signals };
}

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
  transportCost?: number;
  destinationRegion?: RegionId;
  priceBasis?: string;
}

function computeExecutionSellQuote(params: {
  resourceId: ResourceId;
  regionId: RegionId;
  basePrice: number;
  quantity: number;
}): { effectiveAvgPrice: number; totalGross: number; slippageBps: number } {
  const contextPrice = getMarketContextPrice({
    contextKey: 'region_anchor',
    regionId: params.regionId,
    resourceId: params.resourceId,
    basePrice: params.basePrice,
    side: 'sell',
  });
  const anchorPrice = applyInstantTradeSpread(contextPrice.price, 'sell');
  const slippage = calculateSlippageQuote({
    anchorPrice,
    quantity: params.quantity,
    side: 'sell',
    resourceId: params.resourceId,
  });
  return {
    effectiveAvgPrice: slippage.effectiveAvgPrice,
    totalGross: slippage.totalGross,
    slippageBps: slippage.slippageBps,
  };
}

export async function executeDecision(
  app: FastifyInstance,
  input: {
    playerId: string;
    strategy: EconomicStrategy;
    resource: ResourceId;
    quantity: number;
    region: RegionId;
    destinationRegion?: RegionId;
  },
): Promise<DecisionExecutionResult> {
  const supabase = app.getSupabaseAdminClient();

  const { data: resourceRow, error: resourceError } = await supabase
    .from('resources')
    .select('id, base_price, tradable')
    .eq('id', input.resource)
    .maybeSingle<ResourceRow>();

  if (resourceError) {
    throw new Error(`Failed to load resource: ${resourceError.message}`);
  }

  if (!resourceRow) {
    throw new Error('Resource not found.');
  }

  if (!resourceRow.tradable) {
    throw new Error('Resource is not tradable.');
  }

  if (input.strategy === 'PROCESS_AND_SELL_LOCAL') {
    const recipe = starterTransformRecipes.find(
      (r) => r.inputResourceId === input.resource,
    );

    if (!recipe) {
      throw new Error('No recipe found for resource.');
    }

    const batches = Math.floor(input.quantity / recipe.inputAmount);
    if (batches <= 0) {
      throw new Error('Input quantity too low for processing.');
    }

    const inputUsed = batches * recipe.inputAmount;
    const outputProduced = batches * recipe.outputAmount;

    const { data: outputResourceRow, error: outputResourceError } = await supabase
      .from('resources')
      .select('id, base_price, tradable')
      .eq('id', recipe.outputResourceId)
      .maybeSingle<ResourceRow>();

    if (outputResourceError) {
      throw new Error(`Failed to load output resource: ${outputResourceError.message}`);
    }

    if (!outputResourceRow) {
      throw new Error('Output resource not found.');
    }

    if (!outputResourceRow.tradable) {
      throw new Error('Output resource is not tradable.');
    }

    const sellQuote = computeExecutionSellQuote({
      resourceId: recipe.outputResourceId,
      regionId: input.region,
      basePrice: outputResourceRow.base_price,
      quantity: outputProduced,
    });

    type ProcessResult = {
      decision_id: string;
      order_id: string;
      price_per_unit: number;
      gross_amount: number;
      fee_amount: number;
      net_amount: number;
      input_consumed: number;
      output_produced: number;
      output_resource_id: string;
      inventory_quantity: number;
      player_credits: number;
    };

    const { data: processRpcResult, error: processRpcError } =
      await supabase.rpc('execute_decision_process_and_sell_local', {
        p_player_id: input.playerId,
        p_input_resource_id: input.resource,
        p_input_amount: inputUsed,
        p_output_resource_id: recipe.outputResourceId,
        p_output_amount: outputProduced,
        p_original_quantity: input.quantity,
        p_origin_region: input.region,
        p_fee_rate: gameConfig.marketFee,
        p_price_per_unit: sellQuote.effectiveAvgPrice,
      });

    if (processRpcError) {
      throw new Error(processRpcError.message);
    }

    const processRows = processRpcResult as ProcessResult[];
    const processRow = Array.isArray(processRows)
      ? processRows[0]
      : (processRows as unknown as ProcessResult);

    if (!processRow) {
      throw new Error('Decision execution returned no result.');
    }

    return {
      decisionId: processRow.decision_id,
      orderId: processRow.order_id,
      pricePerUnit: processRow.price_per_unit,
      grossAmount: processRow.gross_amount,
      feeAmount: processRow.fee_amount,
      netAmount: processRow.net_amount,
      inventoryQuantity: processRow.inventory_quantity,
      playerCredits: processRow.player_credits,
      outputResourceId: processRow.output_resource_id as ResourceId,
      inputConsumed: processRow.input_consumed,
      outputProduced: processRow.output_produced,
      strategy: input.strategy,
      resource: input.resource,
      quantity: input.quantity,
      region: input.region,
      priceBasis: 'market_context',
    };
  }

  if (input.strategy === 'SELL_LOCAL') {
    const sellQuote = computeExecutionSellQuote({
      resourceId: input.resource,
      regionId: input.region,
      basePrice: resourceRow.base_price,
      quantity: input.quantity,
    });

    type ExecuteResult = {
      decision_id: string;
      order_id: string;
      price_per_unit: number;
      gross_amount: number;
      fee_amount: number;
      net_amount: number;
      inventory_quantity: number;
      player_credits: number;
    };

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'execute_decision_sell_local',
      {
        p_player_id: input.playerId,
        p_resource_id: input.resource,
        p_quantity: input.quantity,
        p_origin_region: input.region,
        p_fee_rate: gameConfig.marketFee,
        p_price_per_unit: sellQuote.effectiveAvgPrice,
      },
    );

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    const rows = rpcResult as ExecuteResult[];
    const row = Array.isArray(rows)
      ? rows[0]
      : (rows as unknown as ExecuteResult);

    if (!row) {
      throw new Error('Decision execution returned no result.');
    }

    return {
      decisionId: row.decision_id,
      orderId: row.order_id,
      pricePerUnit: row.price_per_unit,
      grossAmount: row.gross_amount,
      feeAmount: row.fee_amount,
      netAmount: row.net_amount,
      inventoryQuantity: row.inventory_quantity,
      playerCredits: row.player_credits,
      strategy: input.strategy,
      resource: input.resource,
      quantity: input.quantity,
      region: input.region,
      priceBasis: 'market_context',
    };
  }

  if (input.strategy === 'TRANSPORT_AND_SELL') {
    if (!input.destinationRegion) {
      throw new Error('Destination region is required for transport strategies.');
    }

    if (input.destinationRegion === input.region) {
      throw new Error('Origin and destination regions must be different.');
    }

    const transportCost = calculateTransportCost({
      quantity: input.quantity,
      originRegion: input.region,
      destinationRegion: input.destinationRegion,
    });

    const sellQuote = computeExecutionSellQuote({
      resourceId: input.resource,
      regionId: input.destinationRegion,
      basePrice: resourceRow.base_price,
      quantity: input.quantity,
    });

    type TransportResult = {
      decision_id: string;
      order_id: string;
      price_per_unit: number;
      gross_amount: number;
      fee_amount: number;
      transport_cost: number;
      net_amount: number;
      inventory_quantity: number;
      player_credits: number;
      destination_region: string;
    };

    const { data: transportRpcResult, error: transportRpcError } =
      await supabase.rpc('execute_decision_transport_and_sell', {
        p_player_id: input.playerId,
        p_resource_id: input.resource,
        p_quantity: input.quantity,
        p_origin_region: input.region,
        p_destination_region: input.destinationRegion,
        p_fee_rate: gameConfig.marketFee,
        p_price_per_unit: sellQuote.effectiveAvgPrice,
        p_transport_cost: transportCost,
      });

    if (transportRpcError) {
      throw new Error(transportRpcError.message);
    }

    const transportRows = transportRpcResult as TransportResult[];
    const transportRow = Array.isArray(transportRows)
      ? transportRows[0]
      : (transportRows as unknown as TransportResult);

    if (!transportRow) {
      throw new Error('Decision execution returned no result.');
    }

    return {
      decisionId: transportRow.decision_id,
      orderId: transportRow.order_id,
      pricePerUnit: transportRow.price_per_unit,
      grossAmount: transportRow.gross_amount,
      feeAmount: transportRow.fee_amount,
      netAmount: transportRow.net_amount,
      inventoryQuantity: transportRow.inventory_quantity,
      playerCredits: transportRow.player_credits,
      strategy: input.strategy,
      resource: input.resource,
      quantity: input.quantity,
      region: input.region,
      transportCost: transportRow.transport_cost,
      destinationRegion: transportRow.destination_region as RegionId,
      priceBasis: 'market_context',
    };
  }

  if (input.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL') {
    if (!input.destinationRegion) {
      throw new Error('Destination region is required for transport strategies.');
    }

    if (input.destinationRegion === input.region) {
      throw new Error('Origin and destination regions must be different.');
    }

    const recipe = starterTransformRecipes.find(
      (r) => r.inputResourceId === input.resource,
    );

    if (!recipe) {
      throw new Error('No recipe found for resource.');
    }

    const batches = Math.floor(input.quantity / recipe.inputAmount);
    if (batches <= 0) {
      throw new Error('Input quantity too low for processing.');
    }

    const inputUsed = batches * recipe.inputAmount;
    const outputProduced = batches * recipe.outputAmount;

    const { data: outputResourceRow, error: outputResourceError } = await supabase
      .from('resources')
      .select('id, base_price, tradable')
      .eq('id', recipe.outputResourceId)
      .maybeSingle<ResourceRow>();

    if (outputResourceError) {
      throw new Error(`Failed to load output resource: ${outputResourceError.message}`);
    }

    if (!outputResourceRow) {
      throw new Error('Output resource not found.');
    }

    if (!outputResourceRow.tradable) {
      throw new Error('Output resource is not tradable.');
    }

    const transportCost = calculateTransportCost({
      quantity: outputProduced,
      originRegion: input.region,
      destinationRegion: input.destinationRegion,
    });

    const sellQuote = computeExecutionSellQuote({
      resourceId: recipe.outputResourceId,
      regionId: input.destinationRegion,
      basePrice: outputResourceRow.base_price,
      quantity: outputProduced,
    });

    type ProcessTransportResult = {
      decision_id: string;
      order_id: string;
      price_per_unit: number;
      gross_amount: number;
      fee_amount: number;
      transport_cost: number;
      net_amount: number;
      input_consumed: number;
      output_produced: number;
      output_resource_id: string;
      inventory_quantity: number;
      player_credits: number;
      destination_region: string;
    };

    const { data: ptRpcResult, error: ptRpcError } =
      await supabase.rpc('execute_decision_process_transport_and_sell', {
        p_player_id: input.playerId,
        p_input_resource_id: input.resource,
        p_input_amount: inputUsed,
        p_output_resource_id: recipe.outputResourceId,
        p_output_amount: outputProduced,
        p_original_quantity: input.quantity,
        p_origin_region: input.region,
        p_destination_region: input.destinationRegion,
        p_fee_rate: gameConfig.marketFee,
        p_price_per_unit: sellQuote.effectiveAvgPrice,
        p_transport_cost: transportCost,
      });

    if (ptRpcError) {
      throw new Error(ptRpcError.message);
    }

    const ptRows = ptRpcResult as ProcessTransportResult[];
    const ptRow = Array.isArray(ptRows)
      ? ptRows[0]
      : (ptRows as unknown as ProcessTransportResult);

    if (!ptRow) {
      throw new Error('Decision execution returned no result.');
    }

    return {
      decisionId: ptRow.decision_id,
      orderId: ptRow.order_id,
      pricePerUnit: ptRow.price_per_unit,
      grossAmount: ptRow.gross_amount,
      feeAmount: ptRow.fee_amount,
      netAmount: ptRow.net_amount,
      inventoryQuantity: ptRow.inventory_quantity,
      playerCredits: ptRow.player_credits,
      outputResourceId: ptRow.output_resource_id as ResourceId,
      inputConsumed: ptRow.input_consumed,
      outputProduced: ptRow.output_produced,
      strategy: input.strategy,
      resource: input.resource,
      quantity: input.quantity,
      region: input.region,
      transportCost: ptRow.transport_cost,
      destinationRegion: ptRow.destination_region as RegionId,
      priceBasis: 'market_context',
    };
  }

  const { error: insertError } = await supabase.from('decision_log').insert({
    player_id: input.playerId,
    strategy: input.strategy,
    resource_id: input.resource,
    quantity: input.quantity,
    origin_region: input.region,
    result: { note: 'Strategy not yet executable in MVP.' },
    status: 'recorded',
  });

  if (insertError) {
    throw new Error(`Failed to record decision: ${insertError.message}`);
  }

  return {
    decisionId: 'pending',
    orderId: 'pending',
    pricePerUnit: 0,
    grossAmount: 0,
    feeAmount: 0,
    netAmount: 0,
    inventoryQuantity: 0,
    playerCredits: 0,
    strategy: input.strategy,
    resource: input.resource,
    quantity: input.quantity,
    region: input.region,
  };
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

export async function getDecisionHistory(
  app: FastifyInstance,
  input: {
    playerId: string;
    limit?: number;
  },
): Promise<{ history: DecisionHistoryEntry[] }> {
  const supabase = app.getSupabaseAdminClient();
  const limit = input.limit ?? 20;

  type DecisionLogRow = {
    id: string;
    strategy: EconomicStrategy;
    resource_id: ResourceId;
    quantity: number;
    origin_region: RegionId;
    destination_region: RegionId | null;
    result: Record<string, unknown>;
    status: string;
    created_at: string;
  };

  const { data, error } = await supabase
    .from('decision_log')
    .select(
      'id, strategy, resource_id, quantity, origin_region, destination_region, result, status, created_at',
    )
    .eq('player_id', input.playerId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .returns<DecisionLogRow[]>();

  if (error) {
    throw new Error(`Failed to load decision history: ${error.message}`);
  }

  const history: DecisionHistoryEntry[] = (data ?? []).map((row) => ({
    id: row.id,
    strategy: row.strategy,
    resourceId: row.resource_id,
    quantity: row.quantity,
    originRegion: row.origin_region,
    destinationRegion: row.destination_region,
    result: row.result,
    status: row.status,
    createdAt: row.created_at,
  }));

  return { history };
}
