import type { RegionId, ResourceId, SlippageQuote } from '../types/game.js';
import { calculateSlippageQuote } from './slippage.js';
import { calculateTransportCost, calculateTransportTime } from './logistics.js';

export interface MarketContextInput {
  contextKey: string;
  regionId: RegionId | undefined;
  basePrice: number;
}

export interface ArbitrageQuoteLocal {
  gross: number;
  net: number;
  avgPrice: number;
  slippageBps: number;
}

export interface ArbitrageQuoteRemote {
  gross: number;
  net: number;
  avgPrice: number;
  slippageBps: number;
  transportCost: number;
  transportTime: number;
}

export interface ArbitrageQuoteDelta {
  profitDifference: number;
  isRemoteBetter: boolean;
}

export interface ArbitrageQuote {
  resource: ResourceId;
  quantity: number;
  originRegion: RegionId;
  destinationRegion: RegionId;
  local: ArbitrageQuoteLocal;
  remote: ArbitrageQuoteRemote;
  delta: ArbitrageQuoteDelta;
}

function computeSellQuote(input: {
  anchorPrice: number;
  quantity: number;
  resourceId: ResourceId;
  feeRate: number;
}): { gross: number; net: number; avgPrice: number; slippageBps: number } {
  const slippage: SlippageQuote = calculateSlippageQuote({
    anchorPrice: input.anchorPrice,
    quantity: input.quantity,
    side: 'sell',
    resourceId: input.resourceId,
  });

  const gross = slippage.totalGross;
  const fee = Math.round(gross * input.feeRate);
  const net = gross - fee;

  return {
    gross,
    net,
    avgPrice: slippage.effectiveAvgPrice,
    slippageBps: slippage.slippageBps,
  };
}

export function buildArbitrageQuote(input: {
  resource: ResourceId;
  quantity: number;
  originRegion: RegionId;
  destinationRegion: RegionId;
  originAnchorPrice: number;
  destinationAnchorPrice: number;
  feeRate: number;
}): ArbitrageQuote {
  const {
    resource,
    quantity,
    originRegion,
    destinationRegion,
    originAnchorPrice,
    destinationAnchorPrice,
    feeRate,
  } = input;

  const local = computeSellQuote({
    anchorPrice: originAnchorPrice,
    quantity,
    resourceId: resource,
    feeRate,
  });

  const transportCost = calculateTransportCost({
    quantity,
    originRegion,
    destinationRegion,
  });

  const transportTime = calculateTransportTime({
    originRegion,
    destinationRegion,
  });

  const remoteSell = computeSellQuote({
    anchorPrice: destinationAnchorPrice,
    quantity,
    resourceId: resource,
    feeRate,
  });

  const remote: ArbitrageQuoteRemote = {
    gross: remoteSell.gross,
    net: remoteSell.net - transportCost,
    avgPrice: remoteSell.avgPrice,
    slippageBps: remoteSell.slippageBps,
    transportCost,
    transportTime,
  };

  const profitDifference = remote.net - local.net;

  return {
    resource,
    quantity,
    originRegion,
    destinationRegion,
    local,
    remote,
    delta: {
      profitDifference,
      isRemoteBetter: profitDifference > 0,
    },
  };
}
