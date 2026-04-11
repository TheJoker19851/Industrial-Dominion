import { describe, expect, it } from 'vitest';
import type { MarketSnapshot } from '@industrial-dominion/shared';
import { previewMarketSnapshot } from '../src/features/dashboard/dashboard-preview';
import {
  buildTransformationOpportunityDraft,
  getDefaultTransformationDraftRuns,
  getTransformationOpportunities,
} from '../src/features/dashboard/transformation-opportunities';

describe('transformation opportunities', () => {
  it('derives multiple positive value-add routes from the market snapshot', () => {
    const opportunities = getTransformationOpportunities(previewMarketSnapshot);

    expect(opportunities).toHaveLength(3);
    expect(opportunities.map((entry) => entry.recipeKey)).toEqual([
      'iron_ingot_value_add',
      'crops_from_water_value_add',
      'coal_briquette_value_add',
    ]);

    const [opportunity] = opportunities;

    expect(opportunity).toMatchObject({
      recipeKey: 'iron_ingot_value_add',
      inputResourceId: 'iron_ore',
      outputResourceId: 'iron_ingot',
      inputBuyContextKey: 'region_anchor',
      outputSellContextKey: 'trade_hub',
      rawSellContextKey: 'trade_hub',
      inputBuyPrice: 10,
      outputSellPrice: 50,
      rawSellPrice: 13,
      inputUnitsPerRun: 2,
      outputUnitsPerRun: 1,
      transformationCostPerRun: 6,
      estimatedTransferCostPerRun: 3,
      requiredCapitalPerRun: 29,
      estimatedNetProfitPerRun: 21,
      rawNetProfitPerRun: 4,
      valueAddPerRun: 17,
      estimatedExecutableRuns: 42,
      estimatedNetOpportunityValue: 882,
    });
  });

  it('keeps additional recipes deterministic and ranked by total estimated opportunity value', () => {
    const [, cropsOpportunity, coalOpportunity] = getTransformationOpportunities(
      previewMarketSnapshot,
    );

    expect(cropsOpportunity).toMatchObject({
      recipeKey: 'crops_from_water_value_add',
      inputResourceId: 'water',
      outputResourceId: 'crops',
      estimatedNetProfitPerRun: 5,
      valueAddPerRun: 4,
      estimatedExecutableRuns: 40,
      estimatedNetOpportunityValue: 200,
    });
    expect(coalOpportunity).toMatchObject({
      recipeKey: 'coal_briquette_value_add',
      inputResourceId: 'wood',
      outputResourceId: 'coal',
      estimatedNetProfitPerRun: 3,
      valueAddPerRun: 4,
      estimatedExecutableRuns: 30,
      estimatedNetOpportunityValue: 90,
    });
    expect(cropsOpportunity!.estimatedNetOpportunityValue).toBeGreaterThan(
      coalOpportunity!.estimatedNetOpportunityValue,
    );
  });

  it('builds a compact deterministic transformation draft with recalculated totals', () => {
    const [opportunity] = getTransformationOpportunities(previewMarketSnapshot);

    expect(opportunity).toBeTruthy();
    expect(getDefaultTransformationDraftRuns(opportunity!)).toBe(4);

    const draft = buildTransformationOpportunityDraft(opportunity!, 3);

    expect(draft).toMatchObject({
      recipeKey: 'iron_ingot_value_add',
      runs: 3,
      inputUnits: 6,
      outputUnits: 3,
      estimatedPurchaseCost: 60,
      estimatedTransformationCost: 18,
      estimatedTransferCost: 9,
      estimatedRevenue: 150,
      estimatedNetProfit: 63,
      estimatedRawAlternativeProfit: 12,
      estimatedValueAdd: 51,
    });
  });

  it('filters out the downgraded recipe while keeping other valid routes stable', () => {
    const marketSnapshot: MarketSnapshot = {
      ...previewMarketSnapshot,
      offers: previewMarketSnapshot.offers.map((offer) =>
        offer.resourceId === 'iron_ingot'
          ? {
              ...offer,
              contextPrices: [
                { contextKey: 'region_anchor', price: 29, modifierPercent: 0 },
                { contextKey: 'trade_hub', price: 31, modifierPercent: 0.02 },
              ],
            }
          : offer,
      ),
    };

    const opportunities = getTransformationOpportunities(marketSnapshot);

    expect(opportunities.some((entry) => entry.recipeKey === 'iron_ingot_value_add')).toBe(false);
    expect(opportunities.map((entry) => entry.recipeKey)).toEqual([
      'crops_from_water_value_add',
      'coal_briquette_value_add',
    ]);
  });

  it('returns an empty list when no market snapshot is available', () => {
    expect(getTransformationOpportunities(null)).toEqual([]);
  });
});
