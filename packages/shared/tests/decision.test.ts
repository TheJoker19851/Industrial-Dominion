import { describe, expect, it } from 'vitest';
import { buildEconomicDecisionSnapshot } from '../src/economics/decision';
import type {
  MarketContextForDecision,
  RegionId,
  ResourceId,
} from '../src/types/game';

const FEE_RATE = 0.02;

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

const ALL_REGIONS: RegionId[] = [
  'ironridge',
  'greenhaven',
  'sunbarrel',
  'riverplain',
];

const RECIPES: MarketContextForDecision['recipes'] = [
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
];

function makePriceEntries(prices: Record<RegionId, number>) {
  return ALL_REGIONS.map((regionId) => ({
    regionId,
    anchorPrice: prices[regionId] ?? 0,
  }));
}

function makeUniformContext(
  resourcePrices?: Partial<Record<ResourceId, number>>,
): MarketContextForDecision {
  const pricesByResourceAndRegion: MarketContextForDecision['pricesByResourceAndRegion'] =
    {};
  for (const resId of Object.keys(BASE_PRICES) as ResourceId[]) {
    const price = resourcePrices?.[resId] ?? BASE_PRICES[resId];
    pricesByResourceAndRegion[resId] = makePriceEntries({
      ironridge: price,
      greenhaven: price,
      sunbarrel: price,
      riverplain: price,
    });
  }
  return { feeRate: FEE_RATE, pricesByResourceAndRegion, recipes: RECIPES };
}

function makeResourceContext(
  resourceId: ResourceId,
  regionPrices: Record<RegionId, number>,
  outputPrices?: Record<ResourceId, Record<RegionId, number>>,
  recipes?: MarketContextForDecision['recipes'],
): MarketContextForDecision {
  const pricesByResourceAndRegion: MarketContextForDecision['pricesByResourceAndRegion'] =
    {};
  for (const resId of Object.keys(BASE_PRICES) as ResourceId[]) {
    if (outputPrices?.[resId]) {
      pricesByResourceAndRegion[resId] = makePriceEntries(outputPrices[resId]);
    } else if (resId === resourceId) {
      pricesByResourceAndRegion[resId] = makePriceEntries(regionPrices);
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
    recipes: recipes ?? RECIPES,
  };
}

describe('TASK-057: Unified Economic Decision Layer — Unit Tests', () => {
  describe('1. Deterministic Output', () => {
    it('identical inputs always produce identical results', () => {
      const ctx = makeUniformContext();
      const input = {
        resource: 'iron_ore' as ResourceId,
        quantity: 50,
        region: 'ironridge' as RegionId,
        marketContext: ctx,
      };

      const s1 = buildEconomicDecisionSnapshot(input);
      const s2 = buildEconomicDecisionSnapshot(input);

      expect(s1).toEqual(s2);
    });

    it('100 identical calls produce identical results', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 20,
        sunbarrel: 22,
        riverplain: 19,
      });
      const input = {
        resource: 'iron_ore' as ResourceId,
        quantity: 100,
        region: 'ironridge' as RegionId,
        marketContext: ctx,
      };

      const first = buildEconomicDecisionSnapshot(input);
      for (let i = 0; i < 99; i++) {
        expect(buildEconomicDecisionSnapshot(input)).toEqual(first);
      }
    });
  });

  describe('2. No NaN or Undefined Values', () => {
    it('every strategy has valid numeric net, roi, time', () => {
      const ctx = makeResourceContext('wood', {
        ironridge: 10,
        greenhaven: 9,
        sunbarrel: 11,
        riverplain: 10,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'wood',
        quantity: 24,
        region: 'greenhaven',
        marketContext: ctx,
      });

      for (const strategy of snapshot.ranked) {
        expect(Number.isNaN(strategy.net)).toBe(false);
        expect(Number.isNaN(strategy.roi)).toBe(false);
        expect(Number.isNaN(strategy.time)).toBe(false);
        expect(strategy.net).toBeDefined();
        expect(strategy.roi).toBeDefined();
        expect(strategy.time).toBeDefined();
        expect(typeof strategy.net).toBe('number');
        expect(typeof strategy.roi).toBe('number');
        expect(typeof strategy.time).toBe('number');
      }
    });

    it('every strategy has a valid breakdown', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 20,
        sunbarrel: 22,
        riverplain: 19,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      for (const strategy of snapshot.ranked) {
        expect(strategy.breakdown).toBeDefined();
        expect(typeof strategy.breakdown).toBe('object');
      }
    });
  });

  describe('3. SELL_LOCAL Strategy', () => {
    it('is always present', () => {
      const ctx = makeResourceContext('coal', {
        ironridge: 12,
        greenhaven: 12,
        sunbarrel: 12,
        riverplain: 12,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'coal',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      const sellLocal = snapshot.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      );
      expect(sellLocal).toBeDefined();
    });

    it('net equals gross minus fee', () => {
      const ctx = makeResourceContext('coal', {
        ironridge: 12,
        greenhaven: 12,
        sunbarrel: 12,
        riverplain: 12,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'coal',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      const sellLocal = snapshot.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;
      const expectedGross = 12 * 10;
      const expectedFee = Math.round(expectedGross * FEE_RATE);
      expect(sellLocal.net).toBe(expectedGross - expectedFee);
      expect(sellLocal.time).toBe(0);
    });
  });

  describe('4. PROCESS_AND_SELL_LOCAL Strategy', () => {
    it('is present for processable resources', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 18,
        sunbarrel: 18,
        riverplain: 18,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      const process = snapshot.ranked.find(
        (s) => s.strategy === 'PROCESS_AND_SELL_LOCAL',
      );
      expect(process).toBeDefined();
    });

    it('is absent for non-processable resources', () => {
      const ctx = makeResourceContext('coal', {
        ironridge: 12,
        greenhaven: 12,
        sunbarrel: 12,
        riverplain: 12,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'coal',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      const process = snapshot.ranked.find(
        (s) => s.strategy === 'PROCESS_AND_SELL_LOCAL',
      );
      expect(process).toBeUndefined();
    });

    it('is absent when quantity is below recipe input amount', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 18,
        sunbarrel: 18,
        riverplain: 18,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 5,
        region: 'ironridge',
        marketContext: ctx,
      });

      const process = snapshot.ranked.find(
        (s) => s.strategy === 'PROCESS_AND_SELL_LOCAL',
      );
      expect(process).toBeUndefined();
    });
  });

  describe('5. TRANSPORT_AND_SELL Strategy', () => {
    it('is present when other regions have prices', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 20,
        sunbarrel: 22,
        riverplain: 19,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      const transport = snapshot.ranked.find(
        (s) => s.strategy === 'TRANSPORT_AND_SELL',
      );
      expect(transport).toBeDefined();
    });

    it('selects the best destination region', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 15,
        greenhaven: 30,
        sunbarrel: 25,
        riverplain: 20,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      const transport = snapshot.ranked.find(
        (s) => s.strategy === 'TRANSPORT_AND_SELL',
      )!;
      const breakdown = transport.breakdown as { destinationRegion: RegionId };
      expect(breakdown.destinationRegion).toBe('greenhaven');
    });
  });

  describe('6. PROCESS_THEN_TRANSPORT_AND_SELL Strategy', () => {
    it('is present for processable resources with multiple regions', () => {
      const ctx = makeResourceContext('wood', {
        ironridge: 10,
        greenhaven: 9,
        sunbarrel: 30,
        riverplain: 11,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'wood',
        quantity: 24,
        region: 'greenhaven',
        marketContext: ctx,
      });

      const processTransport = snapshot.ranked.find(
        (s) => s.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL',
      );
      expect(processTransport).toBeDefined();
    });

    it('combines processing time and transport time', () => {
      const ctx = makeResourceContext('wood', {
        ironridge: 10,
        greenhaven: 9,
        sunbarrel: 30,
        riverplain: 11,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'wood',
        quantity: 24,
        region: 'greenhaven',
        marketContext: ctx,
      });

      const processTransport = snapshot.ranked.find(
        (s) => s.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL',
      )!;
      expect(processTransport.time).toBeGreaterThan(0);

      const breakdown = processTransport.breakdown as {
        processingTime: number;
        transportTime: number;
      };
      expect(processTransport.time).toBe(
        breakdown.processingTime + breakdown.transportTime,
      );
    });
  });

  describe('7. Destination Selection Picks Best Region', () => {
    it('TRANSPORT_AND_SELL picks highest net destination', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 15,
        greenhaven: 18,
        sunbarrel: 50,
        riverplain: 16,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 10,
        region: 'ironridge',
        marketContext: ctx,
      });

      const transport = snapshot.ranked.find(
        (s) => s.strategy === 'TRANSPORT_AND_SELL',
      )!;
      const breakdown = transport.breakdown as { destinationRegion: RegionId };
      expect(breakdown.destinationRegion).toBe('sunbarrel');
    });

    it('PROCESS_THEN_TRANSPORT_AND_SELL picks best destination for output', () => {
      const ctx = makeResourceContext(
        'wood',
        { ironridge: 10, greenhaven: 10, sunbarrel: 10, riverplain: 10 },
        {
          plank: {
            ironridge: 26,
            greenhaven: 26,
            sunbarrel: 60,
            riverplain: 26,
          },
        },
        [
          {
            inputResourceId: 'wood',
            inputAmount: 2,
            outputResourceId: 'plank',
            outputAmount: 1,
            durationSeconds: 100,
          },
        ],
      );

      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'wood',
        quantity: 12,
        region: 'ironridge',
        marketContext: ctx,
      });

      const processTransport = snapshot.ranked.find(
        (s) => s.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL',
      )!;
      const breakdown = processTransport.breakdown as {
        destinationRegion: RegionId;
      };
      expect(breakdown.destinationRegion).toBe('sunbarrel');
    });
  });

  describe('8. Ranking Correctness', () => {
    it('strategies are sorted by net profit descending', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 18,
        sunbarrel: 18,
        riverplain: 18,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      for (let i = 1; i < snapshot.ranked.length; i++) {
        expect(snapshot.ranked[i - 1].net).toBeGreaterThanOrEqual(
          snapshot.ranked[i].net,
        );
      }
    });

    it('best strategy is at index 0', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 18,
        sunbarrel: 18,
        riverplain: 18,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      const maxNet = Math.max(...snapshot.ranked.map((s) => s.net));
      expect(snapshot.ranked[0].net).toBe(maxNet);
    });
  });

  describe('9. Increasing Quantity Changes Outcomes (Slippage Effect)', () => {
    it('slippage causes different rankings at different volumes', () => {
      const ctx = makeResourceContext('fuel', {
        ironridge: 48,
        greenhaven: 52,
        sunbarrel: 50,
        riverplain: 48,
      });

      const lowVolume = buildEconomicDecisionSnapshot({
        resource: 'fuel',
        quantity: 5,
        region: 'ironridge',
        marketContext: ctx,
      });

      const highVolume = buildEconomicDecisionSnapshot({
        resource: 'fuel',
        quantity: 500,
        region: 'ironridge',
        marketContext: ctx,
      });

      expect(lowVolume.ranked[0].net).not.toBe(highVolume.ranked[0].net);

      const lowSellLocal = lowVolume.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;
      const highSellLocal = highVolume.ranked.find(
        (s) => s.strategy === 'SELL_LOCAL',
      )!;

      const lowBreakdown = lowSellLocal.breakdown as { slippageBps: number };
      const highBreakdown = highSellLocal.breakdown as { slippageBps: number };

      expect(highBreakdown.slippageBps).toBeGreaterThanOrEqual(
        lowBreakdown.slippageBps,
      );
    });
  });

  describe('10. All Strategies Present for Processable Resource', () => {
    it('iron_ore at sufficient quantity produces all 4 strategies', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 22,
        sunbarrel: 20,
        riverplain: 19,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      const strategies = snapshot.ranked.map((s) => s.strategy);
      expect(strategies).toContain('SELL_LOCAL');
      expect(strategies).toContain('PROCESS_AND_SELL_LOCAL');
      expect(strategies).toContain('TRANSPORT_AND_SELL');
      expect(strategies).toContain('PROCESS_THEN_TRANSPORT_AND_SELL');
    });
  });

  describe('11. Return Structure Integrity', () => {
    it('every strategy has the required top-level fields', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 20,
        sunbarrel: 22,
        riverplain: 19,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      for (const s of snapshot.ranked) {
        expect(s).toHaveProperty('strategy');
        expect(s).toHaveProperty('resource');
        expect(s).toHaveProperty('quantity');
        expect(s).toHaveProperty('region');
        expect(s).toHaveProperty('net');
        expect(s).toHaveProperty('roi');
        expect(s).toHaveProperty('time');
        expect(s).toHaveProperty('breakdown');
        expect(s.resource).toBe('iron_ore');
        expect(s.quantity).toBe(24);
        expect(s.region).toBe('ironridge');
      }
    });

    it('transport strategies have destinationRegion in breakdown', () => {
      const ctx = makeResourceContext('iron_ore', {
        ironridge: 18,
        greenhaven: 22,
        sunbarrel: 20,
        riverplain: 19,
      });
      const snapshot = buildEconomicDecisionSnapshot({
        resource: 'iron_ore',
        quantity: 24,
        region: 'ironridge',
        marketContext: ctx,
      });

      const transport = snapshot.ranked.find(
        (s) => s.strategy === 'TRANSPORT_AND_SELL',
      );
      const processTransport = snapshot.ranked.find(
        (s) => s.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL',
      );

      if (transport) {
        const bd = transport.breakdown as { destinationRegion: RegionId };
        expect(bd.destinationRegion).toBeDefined();
        expect(ALL_REGIONS).toContain(bd.destinationRegion);
      }

      if (processTransport) {
        const bd = processTransport.breakdown as {
          destinationRegion: RegionId;
        };
        expect(bd.destinationRegion).toBeDefined();
        expect(ALL_REGIONS).toContain(bd.destinationRegion);
      }
    });
  });
});
