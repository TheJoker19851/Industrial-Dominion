import { describe, expect, it } from 'vitest';
import { getRegionalOpportunities } from '../src/features/dashboard/regional-opportunities';
import { previewMarketSnapshot } from '../src/features/dashboard/dashboard-preview';
import type { MarketSnapshot } from '@industrial-dominion/shared';

describe('regional opportunities', () => {
  it('returns opportunities ranked by net spread, not only gross spread', () => {
    const opportunities = getRegionalOpportunities(previewMarketSnapshot);

    expect(opportunities).toHaveLength(3);
    expect(opportunities[0]).toMatchObject({
      resourceId: 'iron_ore',
      buyContextKey: 'region_anchor',
      sellContextKey: 'trade_hub',
      buyPrice: 10,
      sellPrice: 13,
      spreadPerUnit: 3,
      estimatedTransferCostPerUnit: 1,
      netSpreadPerUnit: 2,
      estimatedTradableUnits: 84,
      estimatedNetOpportunityValue: 168,
      requiredCapital: 924,
      category: 'safe',
    });
    expect(opportunities[1]).toMatchObject({
      resourceId: 'water',
      buyContextKey: 'region_anchor',
      sellContextKey: 'trade_hub',
      buyPrice: 4,
      sellPrice: 6,
      spreadPerUnit: 2,
      estimatedTransferCostPerUnit: 1,
      netSpreadPerUnit: 1,
      estimatedTradableUnits: 40,
      estimatedNetOpportunityValue: 40,
      requiredCapital: 200,
      category: 'safe',
    });
    expect(opportunities[2]).toMatchObject({
      resourceId: 'iron_ingot',
      buyContextKey: 'region_anchor',
      sellContextKey: 'trade_hub',
      buyPrice: 45,
      sellPrice: 50,
      spreadPerUnit: 5,
      estimatedTransferCostPerUnit: 4,
      netSpreadPerUnit: 1,
      estimatedTradableUnits: 21,
      estimatedNetOpportunityValue: 21,
      requiredCapital: 1029,
      category: 'aggressive',
    });
  });

  it('accounts for transfer cost and visible tradable volume when computing opportunity value', () => {
    const [ironOreOpportunity] = getRegionalOpportunities(previewMarketSnapshot);

    expect(ironOreOpportunity?.spreadPerUnit).toBe(3);
    expect(ironOreOpportunity?.estimatedTransferCostPerUnit).toBe(1);
    expect(ironOreOpportunity?.netSpreadPerUnit).toBe(2);
    expect(ironOreOpportunity?.estimatedTradableUnits).toBe(84);
    expect(ironOreOpportunity?.estimatedNetOpportunityValue).toBe(168);
    expect(ironOreOpportunity?.requiredCapital).toBe(924);
    expect(ironOreOpportunity?.returnOnCapitalRatio).toBeCloseTo(168 / 924, 4);
  });

  it('classifies routes deterministically across multiple categories', () => {
    const marketSnapshot: MarketSnapshot = {
      ...previewMarketSnapshot,
      player: {
        ...previewMarketSnapshot.player!,
        credits: 1000,
      },
      inventory: [
        {
          resourceId: 'iron_ore',
          quantity: 60,
          basePrice: 12,
          effectivePrice: 11,
          grossValue: 660,
          feeAmount: 33,
          netValue: 627,
          marketContextKey: 'region_anchor',
          locationId: 'preview-primary-storage',
          locationNameKey: 'locations.primary_storage.name',
        },
        {
          resourceId: 'coal',
          quantity: 20,
          basePrice: 11,
          effectivePrice: 10,
          grossValue: 200,
          feeAmount: 10,
          netValue: 190,
          marketContextKey: 'region_anchor',
          locationId: 'preview-primary-storage',
          locationNameKey: 'locations.primary_storage.name',
        },
        {
          resourceId: 'iron_ingot',
          quantity: 8,
          basePrice: 45,
          effectivePrice: 50,
          grossValue: 400,
          feeAmount: 20,
          netValue: 380,
          marketContextKey: 'trade_hub',
          locationId: 'preview-remote-storage',
          locationNameKey: 'locations.remote_storage.name',
        },
      ],
      offers: [
        {
          resourceId: 'iron_ore',
          basePrice: 11,
          contextPrices: [
            { contextKey: 'region_anchor', price: 10, modifierPercent: -0.09 },
            { contextKey: 'trade_hub', price: 13, modifierPercent: 0.18 },
          ],
        },
        {
          resourceId: 'coal',
          basePrice: 11,
          contextPrices: [
            { contextKey: 'region_anchor', price: 10, modifierPercent: -0.09 },
            { contextKey: 'trade_hub', price: 12, modifierPercent: 0.09 },
          ],
        },
        {
          resourceId: 'iron_ingot',
          basePrice: 48,
          contextPrices: [
            { contextKey: 'region_anchor', price: 45, modifierPercent: -0.06 },
            { contextKey: 'trade_hub', price: 50, modifierPercent: 0.04 },
          ],
        },
      ],
    };

    const opportunities = getRegionalOpportunities(marketSnapshot);

    expect(opportunities.find((entry) => entry.resourceId === 'iron_ore')?.category).toBe('safe');
    expect(opportunities.find((entry) => entry.resourceId === 'coal')?.category).toBe('balanced');
    expect(opportunities.find((entry) => entry.resourceId === 'iron_ingot')?.category).toBe('aggressive');
  });

  it('excludes opportunities that become unattractive after estimated transfer cost', () => {
    const marketSnapshot: MarketSnapshot = {
      ...previewMarketSnapshot,
      offers: [
        ...previewMarketSnapshot.offers,
        {
          resourceId: 'coal',
          basePrice: 9,
          contextPrices: [
            { contextKey: 'region_anchor', price: 8, modifierPercent: -0.11 },
            { contextKey: 'trade_hub', price: 9, modifierPercent: 0 },
          ],
        },
      ],
    };
    const opportunities = getRegionalOpportunities(marketSnapshot);

    expect(opportunities.some((entry) => entry.resourceId === 'coal')).toBe(false);
  });

  it('prefers routes with better estimated economic impact over thin high-margin routes', () => {
    const marketSnapshot: MarketSnapshot = {
      ...previewMarketSnapshot,
      player: {
        ...previewMarketSnapshot.player!,
        credits: 2000,
      },
      inventory: [
        {
          resourceId: 'iron_ore',
          quantity: 60,
          basePrice: 12,
          effectivePrice: 11,
          grossValue: 660,
          feeAmount: 33,
          netValue: 627,
          marketContextKey: 'region_anchor',
          locationId: 'preview-primary-storage',
          locationNameKey: 'locations.primary_storage.name',
        },
        {
          resourceId: 'iron_ingot',
          quantity: 2,
          basePrice: 45,
          effectivePrice: 50,
          grossValue: 100,
          feeAmount: 5,
          netValue: 95,
          marketContextKey: 'trade_hub',
          locationId: 'preview-remote-storage',
          locationNameKey: 'locations.remote_storage.name',
        },
      ],
    };

    const opportunities = getRegionalOpportunities(marketSnapshot);

    expect(opportunities[0]?.resourceId).toBe('iron_ore');
    expect(opportunities[0]?.estimatedNetOpportunityValue).toBeGreaterThan(
      opportunities[1]?.estimatedNetOpportunityValue ?? 0,
    );
  });

  it('returns an empty list when no market snapshot is available', () => {
    expect(getRegionalOpportunities(null)).toEqual([]);
  });
});
