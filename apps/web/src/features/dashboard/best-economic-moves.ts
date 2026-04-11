import type { MarketSnapshot } from '@industrial-dominion/shared';
import {
  buildRegionalTradeDraft,
  getRegionalTradeRequiredCapital,
} from './regional-trade-draft';
import { getRegionalOpportunities, type RegionalOpportunityCategory } from './regional-opportunities';
import {
  buildTransformationOpportunityDraft,
  getTransformationOpportunities,
} from './transformation-opportunities';

export type EconomicMoveType = 'regional_trade' | 'transformation';

export type BestEconomicMove = {
  id: string;
  type: EconomicMoveType;
  label: string;
  capitalRequired: number;
  estimatedNetProfit: number;
  efficiencyScore: number;
  category?: RegionalOpportunityCategory;
  resourceId?: string;
  inputResourceId?: string;
  outputResourceId?: string;
  buyContextKey?: string;
  sellContextKey?: string;
  sourceOpportunityId: string;
};

function getEfficiencyScore(estimatedNetProfit: number, capitalRequired: number) {
  return estimatedNetProfit / Math.max(capitalRequired, 1);
}

export function getBestEconomicMoves(snapshot: MarketSnapshot | null, limit = 3) {
  if (!snapshot) {
    return [];
  }

  const regionalMoves: BestEconomicMove[] = getRegionalOpportunities(snapshot, limit).map(
    (opportunity) => {
      const draft = buildRegionalTradeDraft(opportunity);
      const capitalRequired = getRegionalTradeRequiredCapital(draft);

      return {
        id: `regional-${opportunity.resourceId}-${opportunity.buyContextKey}-${opportunity.sellContextKey}`,
        type: 'regional_trade',
        label: `${opportunity.resourceId}:${opportunity.buyContextKey}->${opportunity.sellContextKey}`,
        capitalRequired,
        estimatedNetProfit: draft.estimatedNetProfit,
        efficiencyScore: getEfficiencyScore(draft.estimatedNetProfit, capitalRequired),
        category: opportunity.category,
        resourceId: opportunity.resourceId,
        buyContextKey: opportunity.buyContextKey,
        sellContextKey: opportunity.sellContextKey,
        sourceOpportunityId: `${opportunity.resourceId}-${opportunity.buyContextKey}-${opportunity.sellContextKey}`,
      };
    },
  );

  const transformationMoves: BestEconomicMove[] = getTransformationOpportunities(snapshot, limit).map(
    (opportunity) => {
      const draft = buildTransformationOpportunityDraft(opportunity);
      const capitalRequired =
        draft.estimatedPurchaseCost +
        draft.estimatedTransformationCost +
        draft.estimatedTransferCost;

      return {
        id: `transformation-${opportunity.recipeKey}-${opportunity.inputBuyContextKey}-${opportunity.outputSellContextKey}`,
        type: 'transformation',
        label: `${opportunity.inputResourceId}->${opportunity.outputResourceId}:${opportunity.inputBuyContextKey}->${opportunity.outputSellContextKey}`,
        capitalRequired,
        estimatedNetProfit: draft.estimatedNetProfit,
        efficiencyScore: getEfficiencyScore(draft.estimatedNetProfit, capitalRequired),
        inputResourceId: opportunity.inputResourceId,
        outputResourceId: opportunity.outputResourceId,
        buyContextKey: opportunity.inputBuyContextKey,
        sellContextKey: opportunity.outputSellContextKey,
        sourceOpportunityId: `${opportunity.recipeKey}-${opportunity.inputBuyContextKey}-${opportunity.outputSellContextKey}`,
      };
    },
  );

  // MVP assumption: "best use of capital now" should prioritize the net profit
  // of the immediate actionable batch, then break ties by capital efficiency.
  return [...regionalMoves, ...transformationMoves]
    .sort((left, right) => {
      if (right.estimatedNetProfit !== left.estimatedNetProfit) {
        return right.estimatedNetProfit - left.estimatedNetProfit;
      }

      if (right.efficiencyScore !== left.efficiencyScore) {
        return right.efficiencyScore - left.efficiencyScore;
      }

      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}
