import type { MarketOrderSide, ResourceId, SlippageQuote } from '../types/game.js';

export type { SlippageQuote };

export interface LiquidityDepthConfig {
  depth: number;
  slippageRateBps: number;
}

export const resourceLiquidityConfig: Record<ResourceId, LiquidityDepthConfig> = {
  iron_ore: { depth: 60, slippageRateBps: 40 },
  iron_ingot: { depth: 30, slippageRateBps: 55 },
  coal: { depth: 60, slippageRateBps: 40 },
  wood: { depth: 50, slippageRateBps: 50 },
  plank: { depth: 20, slippageRateBps: 70 },
  crude_oil: { depth: 40, slippageRateBps: 55 },
  fuel: { depth: 15, slippageRateBps: 90 },
  sand: { depth: 80, slippageRateBps: 30 },
  water: { depth: 100, slippageRateBps: 20 },
  crops: { depth: 70, slippageRateBps: 35 },
};

export function calculateSlippageQuote(input: {
  anchorPrice: number;
  quantity: number;
  side: MarketOrderSide;
  resourceId: ResourceId;
}): SlippageQuote {
  const { anchorPrice, quantity, side, resourceId } = input;
  const config = resourceLiquidityConfig[resourceId];
  const overflow = Math.max(0, quantity - config.depth);

  if (overflow === 0 || anchorPrice <= 0) {
    return {
      anchorPrice,
      effectiveAvgPrice: anchorPrice,
      totalGross: anchorPrice * quantity,
      slippageBps: 0,
      slippagePercent: 0,
      side,
    };
  }

  const direction = side === 'buy' ? 1 : -1;
  const totalSlippageFraction =
    (config.slippageRateBps / 10000) *
    (overflow * (overflow + 1)) /
    (2 * config.depth * quantity);

  const exactTotal = anchorPrice * quantity * (1 + direction * totalSlippageFraction);
  const totalGross = Math.max(quantity, Math.round(exactTotal));
  const effectiveAvgPrice = Number((totalGross / quantity).toFixed(4));
  const actualSlippageBps = Math.round(
    Math.abs(effectiveAvgPrice / anchorPrice - 1) * 10000,
  );
  const actualSlippagePercent = Number(
    (Math.abs(effectiveAvgPrice / anchorPrice - 1) * 100).toFixed(2),
  );

  return {
    anchorPrice,
    effectiveAvgPrice,
    totalGross,
    slippageBps: actualSlippageBps,
    slippagePercent: actualSlippagePercent,
    side,
  };
}
