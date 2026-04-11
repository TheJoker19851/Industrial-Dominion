import type { MarketContextKey, MarketSnapshot, ResourceId } from '@industrial-dominion/shared';

export type RegionalOpportunityCategory = 'safe' | 'balanced' | 'aggressive';

export type RegionalOpportunity = {
  resourceId: ResourceId;
  buyContextKey: MarketContextKey;
  sellContextKey: MarketContextKey;
  buyPrice: number;
  sellPrice: number;
  spreadPerUnit: number;
  estimatedTransferCostPerUnit: number;
  netSpreadPerUnit: number;
  estimatedTradableUnits: number;
  estimatedNetOpportunityValue: number;
  requiredCapital: number;
  returnOnCapitalRatio: number;
  category: RegionalOpportunityCategory;
};

function getContextPrice(
  snapshotOffer: MarketSnapshot['offers'][number],
  contextKey: MarketContextKey,
) {
  return (
    snapshotOffer.contextPrices.find((quote) => quote.contextKey === contextKey)?.price ??
    snapshotOffer.basePrice
  );
}

function estimateTransferCostPerUnit(buyPrice: number) {
  // MVP assumption: transfer cost scales lightly with the value of the goods being moved.
  // This stays deterministic and frontend-only while still downgrading low-margin arbitrage.
  return Math.max(1, Math.round(buyPrice * 0.08));
}

function estimateTradableUnits(snapshot: MarketSnapshot, resourceId: ResourceId, buyPrice: number) {
  const affordableUnits = Math.floor((snapshot.player?.credits ?? 0) / Math.max(buyPrice, 1));
  const visibleUnitsForResource = snapshot.inventory
    .filter((entry) => entry.resourceId === resourceId)
    .reduce((sum, entry) => sum + entry.quantity, 0);

  // MVP assumption: a route is only meaningfully exploitable up to what the player can afford
  // and what the current snapshot already suggests can move through that resource line soon.
  return Math.max(0, Math.min(affordableUnits, Math.max(visibleUnitsForResource, 0)));
}

function classifyRegionalOpportunity(requiredCapital: number, estimatedNetOpportunityValue: number) {
  const returnOnCapitalRatio =
    estimatedNetOpportunityValue / Math.max(requiredCapital, 1);

  // MVP assumption: category reflects how much estimated value comes back
  // relative to the capital the route locks up right now.
  if (returnOnCapitalRatio >= 0.15) {
    return {
      category: 'safe' as const,
      returnOnCapitalRatio,
    };
  }

  if (returnOnCapitalRatio >= 0.08) {
    return {
      category: 'balanced' as const,
      returnOnCapitalRatio,
    };
  }

  return {
    category: 'aggressive' as const,
    returnOnCapitalRatio,
  };
}

export function getRegionalOpportunities(snapshot: MarketSnapshot | null, limit = 3) {
  if (!snapshot) {
    return [];
  }

  const contextKeys = snapshot.contexts.map((context) => context.key);
  const opportunities: RegionalOpportunity[] = [];

  snapshot.offers.forEach((offer) => {
    let bestBuyContextKey: MarketContextKey | null = null;
    let bestSellContextKey: MarketContextKey | null = null;
    let bestBuyPrice = Number.POSITIVE_INFINITY;
    let bestSellPrice = Number.NEGATIVE_INFINITY;

    contextKeys.forEach((contextKey) => {
      const price = getContextPrice(offer, contextKey);

      if (price < bestBuyPrice) {
        bestBuyPrice = price;
        bestBuyContextKey = contextKey;
      }

      if (price > bestSellPrice) {
        bestSellPrice = price;
        bestSellContextKey = contextKey;
      }
    });

    if (
      bestBuyContextKey &&
      bestSellContextKey &&
      bestBuyContextKey !== bestSellContextKey &&
      bestSellPrice > bestBuyPrice
    ) {
      const spreadPerUnit = bestSellPrice - bestBuyPrice;
      const estimatedTransferCostPerUnit = estimateTransferCostPerUnit(bestBuyPrice);
      const netSpreadPerUnit = spreadPerUnit - estimatedTransferCostPerUnit;
      const estimatedTradableUnits = estimateTradableUnits(snapshot, offer.resourceId, bestBuyPrice);
      const estimatedNetOpportunityValue = netSpreadPerUnit * estimatedTradableUnits;
      const requiredCapital =
        (bestBuyPrice + estimatedTransferCostPerUnit) * estimatedTradableUnits;

      if (netSpreadPerUnit <= 0 || estimatedTradableUnits <= 0 || estimatedNetOpportunityValue <= 0) {
        return;
      }

      const { category, returnOnCapitalRatio } = classifyRegionalOpportunity(
        requiredCapital,
        estimatedNetOpportunityValue,
      );

      opportunities.push({
        resourceId: offer.resourceId,
        buyContextKey: bestBuyContextKey,
        sellContextKey: bestSellContextKey,
        buyPrice: bestBuyPrice,
        sellPrice: bestSellPrice,
        spreadPerUnit,
        estimatedTransferCostPerUnit,
        netSpreadPerUnit,
        estimatedTradableUnits,
        estimatedNetOpportunityValue,
        requiredCapital,
        returnOnCapitalRatio,
        category,
      });
    }
  });

  return opportunities
    .sort((left, right) => {
      if (right.estimatedNetOpportunityValue !== left.estimatedNetOpportunityValue) {
        return right.estimatedNetOpportunityValue - left.estimatedNetOpportunityValue;
      }

      return right.netSpreadPerUnit - left.netSpreadPerUnit;
    })
    .slice(0, limit);
}
