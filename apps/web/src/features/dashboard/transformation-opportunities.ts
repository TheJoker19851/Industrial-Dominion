import type { MarketContextKey, MarketSnapshot, ResourceId } from '@industrial-dominion/shared';

export type TransformationOpportunityRecipe = {
  key: string;
  inputResourceId: ResourceId;
  outputResourceId: ResourceId;
  inputUnitsPerRun: number;
  outputUnitsPerRun: number;
  transformationCostPerRun: number;
};

export type TransformationOpportunity = {
  recipeKey: string;
  inputResourceId: ResourceId;
  outputResourceId: ResourceId;
  inputBuyContextKey: MarketContextKey;
  outputSellContextKey: MarketContextKey;
  rawSellContextKey: MarketContextKey;
  inputBuyPrice: number;
  outputSellPrice: number;
  rawSellPrice: number;
  inputUnitsPerRun: number;
  outputUnitsPerRun: number;
  transformationCostPerRun: number;
  estimatedTransferCostPerRun: number;
  requiredCapitalPerRun: number;
  estimatedNetProfitPerRun: number;
  rawNetProfitPerRun: number;
  valueAddPerRun: number;
  estimatedExecutableRuns: number;
  estimatedNetOpportunityValue: number;
};

export type TransformationOpportunityDraft = {
  recipeKey: string;
  inputResourceId: ResourceId;
  outputResourceId: ResourceId;
  inputBuyContextKey: MarketContextKey;
  outputSellContextKey: MarketContextKey;
  rawSellContextKey: MarketContextKey;
  runs: number;
  inputUnits: number;
  outputUnits: number;
  estimatedPurchaseCost: number;
  estimatedTransformationCost: number;
  estimatedTransferCost: number;
  estimatedRevenue: number;
  estimatedNetProfit: number;
  estimatedRawAlternativeProfit: number;
  estimatedValueAdd: number;
};

export const transformationOpportunityRecipes: TransformationOpportunityRecipe[] = [
  {
    key: 'iron_ingot_value_add',
    inputResourceId: 'iron_ore',
    outputResourceId: 'iron_ingot',
    inputUnitsPerRun: 2,
    outputUnitsPerRun: 1,
    transformationCostPerRun: 6,
  },
  {
    key: 'coal_briquette_value_add',
    inputResourceId: 'wood',
    outputResourceId: 'coal',
    inputUnitsPerRun: 1,
    outputUnitsPerRun: 1,
    transformationCostPerRun: 1,
  },
  {
    key: 'crops_from_water_value_add',
    inputResourceId: 'water',
    outputResourceId: 'crops',
    inputUnitsPerRun: 1,
    outputUnitsPerRun: 1,
    transformationCostPerRun: 2,
  },
];

function getContextPrice(
  snapshotOffer: MarketSnapshot['offers'][number],
  contextKey: MarketContextKey,
) {
  return (
    snapshotOffer.contextPrices.find((quote) => quote.contextKey === contextKey)?.price ??
    snapshotOffer.basePrice
  );
}

function getBestBuyQuote(
  snapshot: MarketSnapshot,
  resourceId: ResourceId,
): { contextKey: MarketContextKey; price: number } | null {
  const offer = snapshot.offers.find((entry) => entry.resourceId === resourceId);

  if (!offer || snapshot.contexts.length < 1) {
    return null;
  }

  let bestContextKey: MarketContextKey | null = null;
  let bestPrice = Number.POSITIVE_INFINITY;

  snapshot.contexts.forEach((context) => {
    const price = getContextPrice(offer, context.key);

    if (price < bestPrice) {
      bestPrice = price;
      bestContextKey = context.key;
    }
  });

  return bestContextKey ? { contextKey: bestContextKey, price: bestPrice } : null;
}

function getBestSellQuote(
  snapshot: MarketSnapshot,
  resourceId: ResourceId,
): { contextKey: MarketContextKey; price: number } | null {
  const offer = snapshot.offers.find((entry) => entry.resourceId === resourceId);

  if (!offer || snapshot.contexts.length < 1) {
    return null;
  }

  let bestContextKey: MarketContextKey | null = null;
  let bestPrice = Number.NEGATIVE_INFINITY;

  snapshot.contexts.forEach((context) => {
    const price = getContextPrice(offer, context.key);

    if (price > bestPrice) {
      bestPrice = price;
      bestContextKey = context.key;
    }
  });

  return bestContextKey ? { contextKey: bestContextKey, price: bestPrice } : null;
}

function estimateTransformationTransferCostPerRun(
  outputSellPrice: number,
  outputUnitsPerRun: number,
) {
  // MVP assumption: refined goods are denser than raw material but still incur a
  // light, deterministic relocation cost before sale.
  const perUnit = Math.max(1, Math.round(outputSellPrice * 0.06));

  return perUnit * outputUnitsPerRun;
}

function estimateRawTransferCostPerRun(inputBuyPrice: number, inputUnitsPerRun: number) {
  const perUnit = Math.max(1, Math.round(inputBuyPrice * 0.08));

  return perUnit * inputUnitsPerRun;
}

function estimateExecutableRuns(
  snapshot: MarketSnapshot,
  recipe: TransformationOpportunityRecipe,
  requiredCapitalPerRun: number,
) {
  const affordableRuns = Math.floor(
    (snapshot.player?.credits ?? 0) / Math.max(requiredCapitalPerRun, 1),
  );
  const visibleInputUnits = snapshot.inventory
    .filter((entry) => entry.resourceId === recipe.inputResourceId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const runsFromVisibleInput = Math.floor(
    visibleInputUnits / Math.max(recipe.inputUnitsPerRun, 1),
  );

  // MVP assumption: a conversion route should feel grounded in both current
  // buying power and the visible stock line already circulating in the session.
  return Math.max(0, Math.min(affordableRuns, runsFromVisibleInput));
}

function clampTransformationRuns(runs: number, estimatedExecutableRuns: number) {
  const normalizedRuns = Number.isFinite(runs) ? Math.floor(runs) : 1;
  const maxRuns = Math.max(1, estimatedExecutableRuns);

  return Math.min(maxRuns, Math.max(1, normalizedRuns));
}

export function getDefaultTransformationDraftRuns(opportunity: TransformationOpportunity) {
  // MVP assumption: default to a compact batch that is easy to read without
  // immediately maxing out the whole route.
  return clampTransformationRuns(
    Math.min(opportunity.estimatedExecutableRuns, 4),
    opportunity.estimatedExecutableRuns,
  );
}

export function buildTransformationOpportunityDraft(
  opportunity: TransformationOpportunity,
  runs = getDefaultTransformationDraftRuns(opportunity),
): TransformationOpportunityDraft {
  const normalizedRuns = clampTransformationRuns(runs, opportunity.estimatedExecutableRuns);

  return {
    recipeKey: opportunity.recipeKey,
    inputResourceId: opportunity.inputResourceId,
    outputResourceId: opportunity.outputResourceId,
    inputBuyContextKey: opportunity.inputBuyContextKey,
    outputSellContextKey: opportunity.outputSellContextKey,
    rawSellContextKey: opportunity.rawSellContextKey,
    runs: normalizedRuns,
    inputUnits: opportunity.inputUnitsPerRun * normalizedRuns,
    outputUnits: opportunity.outputUnitsPerRun * normalizedRuns,
    estimatedPurchaseCost:
      opportunity.inputBuyPrice * opportunity.inputUnitsPerRun * normalizedRuns,
    estimatedTransformationCost: opportunity.transformationCostPerRun * normalizedRuns,
    estimatedTransferCost: opportunity.estimatedTransferCostPerRun * normalizedRuns,
    estimatedRevenue: opportunity.outputSellPrice * opportunity.outputUnitsPerRun * normalizedRuns,
    estimatedNetProfit: opportunity.estimatedNetProfitPerRun * normalizedRuns,
    estimatedRawAlternativeProfit: opportunity.rawNetProfitPerRun * normalizedRuns,
    estimatedValueAdd: opportunity.valueAddPerRun * normalizedRuns,
  };
}

export function getTransformationOpportunities(
  snapshot: MarketSnapshot | null,
  limit = 3,
) {
  if (!snapshot) {
    return [];
  }

  const opportunities: TransformationOpportunity[] = [];

  transformationOpportunityRecipes.forEach((recipe) => {
    const bestInputBuy = getBestBuyQuote(snapshot, recipe.inputResourceId);
    const bestOutputSell = getBestSellQuote(snapshot, recipe.outputResourceId);
    const bestRawSell = getBestSellQuote(snapshot, recipe.inputResourceId);

    if (!bestInputBuy || !bestOutputSell || !bestRawSell) {
      return;
    }

    const estimatedTransferCostPerRun = estimateTransformationTransferCostPerRun(
      bestOutputSell.price,
      recipe.outputUnitsPerRun,
    );
    const requiredCapitalPerRun =
      bestInputBuy.price * recipe.inputUnitsPerRun +
      recipe.transformationCostPerRun +
      estimatedTransferCostPerRun;
    const estimatedNetProfitPerRun =
      bestOutputSell.price * recipe.outputUnitsPerRun - requiredCapitalPerRun;
    const rawNetProfitPerRun =
      bestRawSell.price * recipe.inputUnitsPerRun -
      bestInputBuy.price * recipe.inputUnitsPerRun -
      estimateRawTransferCostPerRun(bestInputBuy.price, recipe.inputUnitsPerRun);
    const valueAddPerRun = estimatedNetProfitPerRun - rawNetProfitPerRun;
    const estimatedExecutableRuns = estimateExecutableRuns(
      snapshot,
      recipe,
      requiredCapitalPerRun,
    );
    const estimatedNetOpportunityValue =
      estimatedNetProfitPerRun * estimatedExecutableRuns;

    if (
      estimatedNetProfitPerRun <= 0 ||
      valueAddPerRun <= 0 ||
      estimatedExecutableRuns <= 0 ||
      estimatedNetOpportunityValue <= 0
    ) {
      return;
    }

    opportunities.push({
      recipeKey: recipe.key,
      inputResourceId: recipe.inputResourceId,
      outputResourceId: recipe.outputResourceId,
      inputBuyContextKey: bestInputBuy.contextKey,
      outputSellContextKey: bestOutputSell.contextKey,
      rawSellContextKey: bestRawSell.contextKey,
      inputBuyPrice: bestInputBuy.price,
      outputSellPrice: bestOutputSell.price,
      rawSellPrice: bestRawSell.price,
      inputUnitsPerRun: recipe.inputUnitsPerRun,
      outputUnitsPerRun: recipe.outputUnitsPerRun,
      transformationCostPerRun: recipe.transformationCostPerRun,
      estimatedTransferCostPerRun,
      requiredCapitalPerRun,
      estimatedNetProfitPerRun,
      rawNetProfitPerRun,
      valueAddPerRun,
      estimatedExecutableRuns,
      estimatedNetOpportunityValue,
    });
  });

  return opportunities
    .sort((left, right) => {
      if (right.estimatedNetOpportunityValue !== left.estimatedNetOpportunityValue) {
        return right.estimatedNetOpportunityValue - left.estimatedNetOpportunityValue;
      }

      return right.valueAddPerRun - left.valueAddPerRun;
    })
    .slice(0, limit);
}
