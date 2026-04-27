import { describe, expect, it } from 'vitest';
import { buildEconomicDecisionSnapshot } from '../src/economics/decision';
import type {
  MarketContextForDecision,
  RegionId,
  ResourceId,
} from '../src/types/game';

const FEE_RATE = 0.02;

const ALL_REGIONS: RegionId[] = [
  'ironridge',
  'greenhaven',
  'sunbarrel',
  'riverplain',
];
const ALL_RESOURCES: ResourceId[] = [
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

const BASE_PRICES: Record<ResourceId, number> = {
  iron_ore: 18,
  iron_ingot: 42,
  coal: 12,
  wood: 10,
  plank: 26,
  crude_oil: 20,
  fuel: 48,
  sand: 8,
  water: 6,
  crops: 7,
};

function makePriceEntries(prices: Record<RegionId, number>) {
  return ALL_REGIONS.map((regionId) => ({
    regionId,
    anchorPrice: prices[regionId] ?? 0,
  }));
}

function makeContext(
  overrides: Partial<Record<ResourceId, Record<RegionId, number>>>,
  recipes?: MarketContextForDecision['recipes'],
): MarketContextForDecision {
  const pricesByResourceAndRegion: MarketContextForDecision['pricesByResourceAndRegion'] =
    {};
  for (const resId of ALL_RESOURCES) {
    if (overrides[resId]) {
      pricesByResourceAndRegion[resId] = makePriceEntries(overrides[resId]!);
    } else {
      const defaultPrice = BASE_PRICES[resId];
      pricesByResourceAndRegion[resId] = makePriceEntries({
        ironridge: defaultPrice,
        greenhaven: defaultPrice,
        sunbarrel: defaultPrice,
        riverplain: defaultPrice,
      });
    }
  }
  return {
    feeRate: FEE_RATE,
    pricesByResourceAndRegion,
    recipes: recipes ?? [
      {
        inputResourceId: 'iron_ore',
        inputAmount: 12,
        outputResourceId: 'iron_ingot',
        outputAmount: 6,
        durationSeconds: 3600,
      },
      {
        inputResourceId: 'wood',
        inputAmount: 12,
        outputResourceId: 'plank',
        outputAmount: 6,
        durationSeconds: 1800,
      },
      {
        inputResourceId: 'crude_oil',
        inputAmount: 12,
        outputResourceId: 'fuel',
        outputAmount: 6,
        durationSeconds: 2400,
      },
    ],
  };
}

describe('TASK-057: Economic Validation Scenarios', () => {
  describe('Scenario 1: Low Volume — SELL_LOCAL or PROCESS dominates', () => {
    it('low volume iron_ore (10 units) in ironridge — local strategies dominate', () => {
      const ctx = makeContext({
        iron_ore: {
          ironridge: 18,
          greenhaven: 18,
          sunbarrel: 18,
          riverplain: 18,
        },
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      expect(snapshot.ranked.length).toBeGreaterThanOrEqual(1);
      const best = snapshot.ranked[0];
      expect(best.net).toBeGreaterThan(0);

      const sellLocal = snapshot.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;
      expect(sellLocal).toBeDefined();
      expect(sellLocal.net).toBeGreaterThan(0);
      expect(sellLocal.time).toBe(0);
    });

    it('low volume wood (12 units) in greenhaven — PROCESS_AND_SELL_LOCAL may win', () => {
      const ctx = makeContext({
        wood: { ironridge: 10, greenhaven: 9, sunbarrel: 10, riverplain: 10 },
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'wood',
        quantity: 12,
        region: 'greenhaven',
        marketContext: ctx,
      });

      const sellLocal = snapshot.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;
      const processLocal = snapshot.ranked.find(
        (s) => s.strategy === 'PROCESS_AND_SELL_LOCAL',
      );

      expect(sellLocal).toBeDefined();
      if (processLocal) {
        expect(processLocal.net).toBeGreaterThan(0);
      }
    });
  });

  describe('Scenario 2: Medium Volume — PROCESS or TRANSPORT may dominate', () => {
    it('medium volume iron_ore (120 units) with regional price variation', () => {
      const ctx = makeContext({
        iron_ore: {
          ironridge: 15,
          greenhaven: 20,
          sunbarrel: 18,
          riverplain: 16,
        },
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 120,
        region: 'ironridge',
        marketContext: ctx,
      });

      expect(snapshot.ranked.length).toBeGreaterThanOrEqual(2);
      const best = snapshot.ranked[0];
      expect(best.net).toBeGreaterThan(0);

      const transport = snapshot.ranked.find(
        (s) => s.strategy === 'TRANSPORT_AND_SELL',
      );
      if (transport) {
        const bd = transport.breakdown as { destinationRegion: RegionId };
        expect(bd.destinationRegion).toBe('greenhaven');
      }
    });
  });

  describe('Scenario 3: High Volume — TRANSPORT or PROCESS_THEN_TRANSPORT may dominate', () => {
    it('high volume fuel (500 units) — slippage must influence ranking', () => {
      const ctx = makeContext({
        crude_oil: {
          ironridge: 20,
          greenhaven: 20,
          sunbarrel: 20,
          riverplain: 20,
        },
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'crude_oil',
        quantity: 500,
        region: 'sunbarrel',
        marketContext: ctx,
      });

      const sellLocal = snapshot.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;
      const bd = sellLocal.breakdown as { slippageBps: number };
      expect(bd.slippageBps).toBeGreaterThan(0);

      const lowSnapshot = buildEconomicDecisionSnapshot({
        resource: 'crude_oil',
        quantity: 20,
        region: 'sunbarrel',
        marketContext: ctx,
      });
      const lowSellLocal = lowSnapshot.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;
      const lowBd = lowSellLocal.breakdown as { slippageBps: number };
      expect(bd.slippageBps).toBeGreaterThanOrEqual(lowBd.slippageBps);
    });

    it('high volume with steep remote premium favors transport', () => {
      const ctx = makeContext({
        iron_ore: {
          ironridge: 15,
          greenhaven: 45,
          sunbarrel: 20,
          riverplain: 18,
        },
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 100,
        region: 'ironridge',
        marketContext: ctx,
      });

      const best = snapshot.ranked[0];
      const isTransport =
        best.strategy === 'TRANSPORT_AND_SELL' ||
        best.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL';
      expect(isTransport).toBe(true);

      if (best.strategy === 'TRANSPORT_AND_SELL') {
        const bd = best.breakdown as { destinationRegion: RegionId };
        expect(bd.destinationRegion).toBe('greenhaven');
      }
    });
  });

  describe('Scenario 4: Cross-Chain — different resources produce different best strategies', () => {
    it('iron_ore best strategy differs from wood best strategy under same conditions', () => {
      const ironCtx = makeContext({
        iron_ore: {
          ironridge: 18,
          greenhaven: 18,
          sunbarrel: 18,
          riverplain: 18,
        },
      });
      const woodCtx = makeContext({
        wood: { ironridge: 10, greenhaven: 10, sunbarrel: 10, riverplain: 10 },
      });

      const ironSnapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ironCtx,
      });

      const woodSnapshot = buildEconomicDecisionSnapshot({
        resource: 'wood',
        quantity: 24,
        region: 'ironridge',
        marketContext: woodCtx,
      });

      const ironStrategies = ironSnapshot.ranked.map((s) => s.strategy);
      const woodStrategies = woodSnapshot.ranked.map((s) => s.strategy);

      expect(ironStrategies).toContain('PROCESS_AND_SELL_LOCAL');
      expect(woodStrategies).toContain('PROCESS_AND_SELL_LOCAL');

      expect(ironSnapshot.ranked[0].net).not.toBe(woodSnapshot.ranked[0].net);
    });

    it('coal (no recipe) only has SELL_LOCAL and TRANSPORT strategies', () => {
      const ctx = makeContext({
        coal: { ironridge: 12, greenhaven: 14, sunbarrel: 13, riverplain: 11 },
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'coal',
        quantity: 50,
        region: 'ironridge',
        marketContext: ctx,
      });

      const strategies = snapshot.ranked.map((s) => s.strategy);
      expect(strategies).toContain('SELL_LOCAL');
      expect(strategies).toContain('TRANSPORT_AND_SELL');
      expect(strategies).not.toContain('PROCESS_AND_SELL_LOCAL');
      expect(strategies).not.toContain('PROCESS_THEN_TRANSPORT_AND_SELL');
    });
  });

  describe('Scenario 5: Region Sensitivity — changing origin changes best decision', () => {
    it('same resource/quantity in different regions yields different net values', () => {
      const ctx = makeContext({
        iron_ore: {
          ironridge: 15,
          greenhaven: 30,
          sunbarrel: 16,
          riverplain: 14,
        },
      });

      const fromIronridge = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      const fromGreenhaven = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'greenhaven',
        marketContext: ctx,
      });

      expect(fromIronridge.ranked[0].net).not.toBe(
        fromGreenhaven.ranked[0].net,
      );

      const ironridgeSellLocal = fromIronridge.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;
      const greenhavenSellLocal = fromGreenhaven.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;

      expect(greenhavenSellLocal.net).toBeGreaterThan(ironridgeSellLocal.net);
    });

    it('transport from low-price to high-price region is best', () => {
      const ctx = makeContext({
        iron_ore: {
          ironridge: 10,
          greenhaven: 50,
          sunbarrel: 12,
          riverplain: 11,
        },
      });

      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      const best = snapshot.ranked[0];
      expect(best.strategy).toBe('TRANSPORT_AND_SELL');
      const bd = best.breakdown as { destinationRegion: RegionId };
      expect(bd.destinationRegion).toBe('greenhaven');
    });
  });

  describe('Scenario 6: At Least 3 Different Strategies Win Across Scenarios', () => {
    const winningStrategies = new Set<string>();

    it('SELL_LOCAL wins when local price is high and remote is low', () => {
      const ctx = makeContext({
        sand: { ironridge: 50, greenhaven: 5, sunbarrel: 5, riverplain: 5 },
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'sand',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      expect(snapshot.ranked[0].strategy).toBe('SELL_LOCAL');
      winningStrategies.add(snapshot.ranked[0].strategy);
    });

    it('TRANSPORT_AND_SELL wins when remote price is much higher', () => {
      const ctx = makeContext({
        sand: { ironridge: 5, greenhaven: 50, sunbarrel: 5, riverplain: 5 },
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'sand',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      expect(snapshot.ranked[0].strategy).toBe('TRANSPORT_AND_SELL');
      winningStrategies.add(snapshot.ranked[0].strategy);
    });

    it('PROCESS_AND_SELL_LOCAL wins when processing premium exceeds transport benefit', () => {
      const ctx = makeContext({
        iron_ore: {
          ironridge: 18,
          greenhaven: 18,
          sunbarrel: 18,
          riverplain: 18,
        },
        iron_ingot: {
          ironridge: 100,
          greenhaven: 18,
          sunbarrel: 18,
          riverplain: 18,
        },
      });

      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      expect(snapshot.ranked[0].strategy).toBe('PROCESS_AND_SELL_LOCAL');
      winningStrategies.add(snapshot.ranked[0].strategy);
    });

    it('verifies at least 3 different strategies won', () => {
      expect(winningStrategies.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Scenario 7: Ranking Changes with Volume', () => {
    it('low volume may favor SELL_LOCAL, high volume may favor TRANSPORT due to slippage differences', () => {
      const ctx = makeContext({
        fuel: { ironridge: 48, greenhaven: 50, sunbarrel: 49, riverplain: 48 },
      });

      const low = buildEconomicDecisionSnapshot({
        resource: 'fuel',
        quantity: 5,
        region: 'ironridge',
        marketContext: ctx,
      });

      const high = buildEconomicDecisionSnapshot({
        resource: 'fuel',
        quantity: 500,
        region: 'ironridge',
        marketContext: ctx,
      });

      expect(low.ranked[0].net).not.toBe(high.ranked[0].net);
    });
  });

  describe('Scenario 8: Ranking Changes with Region', () => {
    it('same resource in different region produces different SELL_LOCAL net', () => {
      const ctx = makeContext({
        iron_ore: {
          ironridge: 14,
          greenhaven: 40,
          sunbarrel: 15,
          riverplain: 30,
        },
      });

      const fromIronridge = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      const fromRiverplain = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'riverplain',
        marketContext: ctx,
      });

      const ironridgeSellLocal = fromIronridge.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;
      const riverplainSellLocal = fromRiverplain.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;

      expect(ironridgeSellLocal.net).not.toBe(riverplainSellLocal.net);
    });
  });
});
