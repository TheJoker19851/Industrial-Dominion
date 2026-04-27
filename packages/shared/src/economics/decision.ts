import type { RegionId, ResourceId } from '../types/game.js';
import { starterRegionIds } from '../types/game.js';
import { buildArbitrageQuote } from './arbitrage.js';
import { calculateTransportCost, calculateTransportTime } from './logistics.js';
import { calculateSlippageQuote } from './slippage.js';

export type EconomicStrategy =
  | 'SELL_LOCAL'
  | 'PROCESS_AND_SELL_LOCAL'
  | 'TRANSPORT_AND_SELL'
  | 'PROCESS_THEN_TRANSPORT_AND_SELL';

export interface RegionPriceEntry {
  regionId: RegionId;
  anchorPrice: number;
}

export interface ResourcePriceMap {
  [resourceId: string]: RegionPriceEntry[];
}

export interface TransformRecipeEntry {
  inputResourceId: ResourceId;
  inputAmount: number;
  outputResourceId: ResourceId;
  outputAmount: number;
  durationSeconds: number;
}

export interface MarketContextForDecision {
  feeRate: number;
  pricesByResourceAndRegion: ResourcePriceMap;
  recipes: TransformRecipeEntry[];
}

export interface StrategyBreakdownSellLocal {
  avgPrice: number;
  slippageBps: number;
  gross: number;
  fee: number;
}

export interface StrategyBreakdownProcessAndSellLocal {
  inputAmount: number;
  outputAmount: number;
  outputResourceId: ResourceId;
  inputCostOpportunity: number;
  outputRevenue: number;
  outputSlippageBps: number;
  outputFee: number;
  processingTime: number;
}

export interface StrategyBreakdownTransportAndSell {
  destinationRegion: RegionId;
  localAvgPrice: number;
  remoteAvgPrice: number;
  remoteSlippageBps: number;
  transportCost: number;
  transportTime: number;
  remoteGross: number;
  remoteFee: number;
}

export interface StrategyBreakdownProcessThenTransportAndSell {
  inputAmount: number;
  outputAmount: number;
  outputResourceId: ResourceId;
  inputCostOpportunity: number;
  destinationRegion: RegionId;
  outputRevenue: number;
  outputSlippageBps: number;
  transportCost: number;
  transportTime: number;
  processingTime: number;
  remoteFee: number;
}

export interface StrategyResult {
  strategy: EconomicStrategy;
  resource: ResourceId;
  quantity: number;
  region: RegionId;
  net: number;
  roi: number;
  time: number;
  breakdown:
    | StrategyBreakdownSellLocal
    | StrategyBreakdownProcessAndSellLocal
    | StrategyBreakdownTransportAndSell
    | StrategyBreakdownProcessThenTransportAndSell;
}

export interface EconomicDecisionSnapshot {
  ranked: StrategyResult[];
}

function sellQuoteNet(
  anchorPrice: number,
  quantity: number,
  resourceId: ResourceId,
  feeRate: number,
): {
  gross: number;
  net: number;
  avgPrice: number;
  slippageBps: number;
  fee: number;
} {
  const slippage = calculateSlippageQuote({
    anchorPrice,
    quantity,
    side: 'sell',
    resourceId,
  });
  const gross = slippage.totalGross;
  const fee = Math.round(gross * feeRate);
  const net = gross - fee;
  return {
    gross,
    net,
    avgPrice: slippage.effectiveAvgPrice,
    slippageBps: slippage.slippageBps,
    fee,
  };
}

function getResourcePrice(
  priceMap: ResourcePriceMap,
  resourceId: ResourceId,
  regionId: RegionId,
): number {
  const entries = priceMap[resourceId];
  if (!entries) return 0;
  const entry = entries.find((p) => p.regionId === regionId);
  return entry?.anchorPrice ?? 0;
}

function findRecipeForResource(
  recipes: TransformRecipeEntry[],
  resourceId: ResourceId,
): TransformRecipeEntry | undefined {
  return recipes.find((r) => r.inputResourceId === resourceId);
}

function computeSellLocal(
  resource: ResourceId,
  quantity: number,
  region: RegionId,
  marketContext: MarketContextForDecision,
): StrategyResult {
  const anchorPrice = getResourcePrice(
    marketContext.pricesByResourceAndRegion,
    resource,
    region,
  );
  const { gross, net, avgPrice, slippageBps, fee } = sellQuoteNet(
    anchorPrice,
    quantity,
    resource,
    marketContext.feeRate,
  );
  const roi = gross > 0 ? net / gross : 0;

  return {
    strategy: 'SELL_LOCAL',
    resource,
    quantity,
    region,
    net,
    roi,
    time: 0,
    breakdown: { avgPrice, slippageBps, gross, fee },
  };
}

function computeProcessAndSellLocal(
  resource: ResourceId,
  quantity: number,
  region: RegionId,
  marketContext: MarketContextForDecision,
): StrategyResult | null {
  const recipe = findRecipeForResource(marketContext.recipes, resource);
  if (!recipe) return null;

  const batches = Math.floor(quantity / recipe.inputAmount);
  if (batches <= 0) return null;

  const inputUsed = batches * recipe.inputAmount;
  const outputProduced = batches * recipe.outputAmount;
  const processingTime = batches * recipe.durationSeconds;

  const inputAnchorPrice = getResourcePrice(
    marketContext.pricesByResourceAndRegion,
    resource,
    region,
  );
  const inputCostOpportunity = inputUsed * inputAnchorPrice;

  const outputAnchorPrice = getResourcePrice(
    marketContext.pricesByResourceAndRegion,
    recipe.outputResourceId,
    region,
  );
  const {
    gross: outputRevenue,
    net,
    slippageBps: outputSlippageBps,
    fee: remoteFee,
  } = sellQuoteNet(
    outputAnchorPrice,
    outputProduced,
    recipe.outputResourceId,
    marketContext.feeRate,
  );

  const roi = inputCostOpportunity > 0 ? net / inputCostOpportunity : 0;

  return {
    strategy: 'PROCESS_AND_SELL_LOCAL',
    resource,
    quantity,
    region,
    net,
    roi,
    time: processingTime,
    breakdown: {
      inputAmount: inputUsed,
      outputAmount: outputProduced,
      outputResourceId: recipe.outputResourceId,
      inputCostOpportunity,
      outputRevenue,
      outputSlippageBps,
      outputFee: remoteFee,
      processingTime,
    },
  };
}

function computeTransportAndSell(
  resource: ResourceId,
  quantity: number,
  region: RegionId,
  marketContext: MarketContextForDecision,
): StrategyResult | null {
  const otherRegions = starterRegionIds.filter(
    (r) => r !== region,
  ) as RegionId[];
  if (otherRegions.length === 0) return null;

  const originAnchorPrice = getResourcePrice(
    marketContext.pricesByResourceAndRegion,
    resource,
    region,
  );

  let bestResult: StrategyResult | null = null;

  for (const destRegion of otherRegions) {
    const destAnchorPrice = getResourcePrice(
      marketContext.pricesByResourceAndRegion,
      resource,
      destRegion,
    );
    if (destAnchorPrice <= 0) continue;

    const arbitrageQuote = buildArbitrageQuote({
      resource,
      quantity,
      originRegion: region,
      destinationRegion: destRegion,
      originAnchorPrice,
      destinationAnchorPrice: destAnchorPrice,
      feeRate: marketContext.feeRate,
    });

    const net = arbitrageQuote.remote.net;
    const transportTime = arbitrageQuote.remote.transportTime;
    const roi =
      arbitrageQuote.remote.gross > 0 ? net / arbitrageQuote.remote.gross : 0;

    if (!bestResult || net > bestResult.net) {
      bestResult = {
        strategy: 'TRANSPORT_AND_SELL',
        resource,
        quantity,
        region,
        net,
        roi,
        time: transportTime,
        breakdown: {
          destinationRegion: destRegion,
          localAvgPrice: arbitrageQuote.local.avgPrice,
          remoteAvgPrice: arbitrageQuote.remote.avgPrice,
          remoteSlippageBps: arbitrageQuote.remote.slippageBps,
          transportCost: arbitrageQuote.remote.transportCost,
          transportTime,
          remoteGross: arbitrageQuote.remote.gross,
          remoteFee: Math.round(
            arbitrageQuote.remote.gross * marketContext.feeRate,
          ),
        },
      };
    }
  }

  return bestResult;
}

function computeProcessThenTransportAndSell(
  resource: ResourceId,
  quantity: number,
  region: RegionId,
  marketContext: MarketContextForDecision,
): StrategyResult | null {
  const recipe = findRecipeForResource(marketContext.recipes, resource);
  if (!recipe) return null;

  const batches = Math.floor(quantity / recipe.inputAmount);
  if (batches <= 0) return null;

  const inputUsed = batches * recipe.inputAmount;
  const outputProduced = batches * recipe.outputAmount;
  const processingTime = batches * recipe.durationSeconds;

  const inputAnchorPrice = getResourcePrice(
    marketContext.pricesByResourceAndRegion,
    resource,
    region,
  );
  const inputCostOpportunity = inputUsed * inputAnchorPrice;

  const otherRegions = starterRegionIds.filter(
    (r) => r !== region,
  ) as RegionId[];
  if (otherRegions.length === 0) return null;

  let bestNet = -Infinity;
  let bestBreakdown: StrategyBreakdownProcessThenTransportAndSell | null = null;

  for (const destRegion of otherRegions) {
    const destAnchorPrice = getResourcePrice(
      marketContext.pricesByResourceAndRegion,
      recipe.outputResourceId,
      destRegion,
    );
    if (destAnchorPrice <= 0) continue;

    const transportCost = calculateTransportCost({
      quantity: outputProduced,
      originRegion: region,
      destinationRegion: destRegion,
    });
    const transportTime = calculateTransportTime({
      originRegion: region,
      destinationRegion: destRegion,
    });

    const sellQuote = sellQuoteNet(
      destAnchorPrice,
      outputProduced,
      recipe.outputResourceId,
      marketContext.feeRate,
    );
    const net = sellQuote.net - transportCost;

    if (net > bestNet) {
      bestNet = net;
      bestBreakdown = {
        inputAmount: inputUsed,
        outputAmount: outputProduced,
        outputResourceId: recipe.outputResourceId,
        inputCostOpportunity,
        destinationRegion: destRegion,
        outputRevenue: sellQuote.gross,
        outputSlippageBps: sellQuote.slippageBps,
        transportCost,
        transportTime,
        processingTime,
        remoteFee: sellQuote.fee,
      };
    }
  }

  if (!bestBreakdown) return null;

  const roi = inputCostOpportunity > 0 ? bestNet / inputCostOpportunity : 0;

  return {
    strategy: 'PROCESS_THEN_TRANSPORT_AND_SELL',
    resource,
    quantity,
    region,
    net: bestNet,
    roi,
    time: processingTime + bestBreakdown.transportTime,
    breakdown: bestBreakdown,
  };
}

export function buildEconomicDecisionSnapshot(input: {
  resource: ResourceId;
  quantity: number;
  region: RegionId;
  marketContext: MarketContextForDecision;
}): EconomicDecisionSnapshot {
  const { resource, quantity, region, marketContext } = input;

  const candidates: StrategyResult[] = [];

  const sellLocal = computeSellLocal(resource, quantity, region, marketContext);
  candidates.push(sellLocal);

  const processLocal = computeProcessAndSellLocal(
    resource,
    quantity,
    region,
    marketContext,
  );
  if (processLocal) candidates.push(processLocal);

  const transportAndSell = computeTransportAndSell(
    resource,
    quantity,
    region,
    marketContext,
  );
  if (transportAndSell) candidates.push(transportAndSell);

  const processThenTransport = computeProcessThenTransportAndSell(
    resource,
    quantity,
    region,
    marketContext,
  );
  if (processThenTransport) candidates.push(processThenTransport);

  const ranked = candidates.sort((a, b) => {
    if (b.net !== a.net) return b.net - a.net;
    if (b.roi !== a.roi) return b.roi - a.roi;
    return a.time - b.time;
  });

  return { ranked };
}
