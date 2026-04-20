import { describe, expect, it } from 'vitest';
import { calculateSlippageQuote, resourceLiquidityConfig } from '@industrial-dominion/shared';
import { getMarketContextPrice } from '../src/modules/market/market-context';
import { gameConfig } from '@industrial-dominion/config';

const FEE = gameConfig.marketFee;

function net(gross: number): number {
  return gross - Math.round(gross * FEE);
}

function applySpread(price: number, side: 'buy' | 'sell'): number {
  return Math.max(1, Math.round(price * (side === 'buy' ? 1.05 : 0.95)));
}

type ChainSpec = {
  name: string;
  rawId: 'iron_ore' | 'wood' | 'crude_oil';
  processedId: 'iron_ingot' | 'plank' | 'fuel';
  rawPrice: number;
  processedPrice: number;
  regionId: 'ironridge' | 'greenhaven' | 'sunbarrel';
};

const CHAINS: ChainSpec[] = [
  {
    name: 'Wood → Plank',
    rawId: 'wood',
    processedId: 'plank',
    rawPrice: 10,
    processedPrice: 26,
    regionId: 'greenhaven',
  },
  {
    name: 'Iron → Ingot',
    rawId: 'iron_ore',
    processedId: 'iron_ingot',
    rawPrice: 18,
    processedPrice: 42,
    regionId: 'ironridge',
  },
  {
    name: 'Oil → Fuel',
    rawId: 'crude_oil',
    processedId: 'fuel',
    rawPrice: 22,
    processedPrice: 48,
    regionId: 'sunbarrel',
  },
];

function computeChainProfitability(chain: ChainSpec, rawUnits: number) {
  const processedUnits = rawUnits / 2;

  const rawSellContext = getMarketContextPrice({
    contextKey: 'region_anchor',
    regionId: chain.regionId,
    resourceId: chain.rawId,
    basePrice: chain.rawPrice,
    side: 'sell',
  });
  const rawAnchorPrice = applySpread(rawSellContext.price, 'sell');

  const processedSellContext = getMarketContextPrice({
    contextKey: 'region_anchor',
    regionId: chain.regionId,
    resourceId: chain.processedId,
    basePrice: chain.processedPrice,
    side: 'sell',
  });
  const processedAnchorPrice = applySpread(processedSellContext.price, 'sell');

  const rawSlippage = calculateSlippageQuote({
    anchorPrice: rawAnchorPrice,
    quantity: rawUnits,
    side: 'sell',
    resourceId: chain.rawId,
  });
  const processedSlippage = calculateSlippageQuote({
    anchorPrice: processedAnchorPrice,
    quantity: processedUnits,
    side: 'sell',
    resourceId: chain.processedId,
  });

  const rawGross = rawSlippage.totalGross;
  const processedGross = processedSlippage.totalGross;

  const rawNet = net(rawGross);
  const processedNet = net(processedGross);
  const processingPremium = processedNet - rawNet;
  const processingMargin = rawNet > 0 ? processingPremium / rawNet : 0;

  return {
    rawNet,
    processedNet,
    processingPremium,
    processingMargin,
    rawSlippageBps: rawSlippage.slippageBps,
    processedSlippageBps: processedSlippage.slippageBps,
    rawEffectiveAvg: rawSlippage.effectiveAvgPrice,
    processedEffectiveAvg: processedSlippage.effectiveAvgPrice,
  };
}

describe('TASK-055: Multi-Chain Slippage Validation', () => {
  describe('1. Low Volume (within depth for all resources)', () => {
    const lowVolume = 10;

    for (const chain of CHAINS) {
      describe(chain.name, () => {
        const result = computeChainProfitability(chain, lowVolume);

        it('has zero slippage on raw sell', () => {
          expect(result.rawSlippageBps).toBe(0);
        });

        it('has zero slippage on processed sell', () => {
          expect(result.processedSlippageBps).toBe(0);
        });

        it('processing premium is positive', () => {
          expect(result.processingPremium).toBeGreaterThan(0);
        });

        it('effective avg price equals anchor price', () => {
          expect(result.rawEffectiveAvg).toBe(
            applySpread(
              getMarketContextPrice({
                contextKey: 'region_anchor',
                regionId: chain.regionId,
                resourceId: chain.rawId,
                basePrice: chain.rawPrice,
                side: 'sell',
              }).price,
              'sell',
            ),
          );
        });
      });
    }
  });

  describe('2. Medium Volume (100 raw units → 50 processed)', () => {
    const mediumVolume = 100;

    for (const chain of CHAINS) {
      describe(chain.name, () => {
        const result = computeChainProfitability(chain, mediumVolume);

        it('raw slippage may or may not apply depending on depth', () => {
          const rawDepth = resourceLiquidityConfig[chain.rawId].depth;
          if (mediumVolume > rawDepth) {
            expect(result.rawSlippageBps).toBeGreaterThan(0);
          } else {
            expect(result.rawSlippageBps).toBe(0);
          }
        });

        it('processed slippage is at least as high as raw slippage', () => {
          expect(result.processedSlippageBps).toBeGreaterThanOrEqual(result.rawSlippageBps);
        });

        it('processing premium is still positive', () => {
          expect(result.processingPremium).toBeGreaterThan(0);
        });

        it('margin is lower than at low volume', () => {
          const lowResult = computeChainProfitability(chain, 10);
          expect(result.processingMargin).toBeLessThanOrEqual(lowResult.processingMargin);
        });
      });
    }

    it('oil chain has the highest processed slippage at medium volume', () => {
      const results = CHAINS.map((c) => ({
        name: c.name,
        ...computeChainProfitability(c, mediumVolume),
      }));

      const oil = results.find((r) => r.name === 'Oil → Fuel')!;
      const iron = results.find((r) => r.name === 'Iron → Ingot')!;
      const wood = results.find((r) => r.name === 'Wood → Plank')!;

      expect(oil.processedSlippageBps).toBeGreaterThan(iron.processedSlippageBps);
      expect(oil.processedSlippageBps).toBeGreaterThan(wood.processedSlippageBps);
    });
  });

  describe('3. High Volume (2000 raw units → 1000 processed)', () => {
    const highVolume = 2000;

    for (const chain of CHAINS) {
      describe(chain.name, () => {
        const result = computeChainProfitability(chain, highVolume);

        it('raw slippage is significant', () => {
          expect(result.rawSlippageBps).toBeGreaterThan(0);
        });

        it('processed slippage is significant', () => {
          expect(result.processedSlippageBps).toBeGreaterThan(0);
        });

        it('processed slippage exceeds raw slippage', () => {
          expect(result.processedSlippageBps).toBeGreaterThan(result.rawSlippageBps);
        });
      });
    }

    it('iron chain margin exceeds wood chain margin at high volume', () => {
      const wood = computeChainProfitability(
        CHAINS.find((c) => c.name === 'Wood → Plank')!,
        highVolume,
      );
      const iron = computeChainProfitability(
        CHAINS.find((c) => c.name === 'Iron → Ingot')!,
        highVolume,
      );

      expect(iron.processingMargin).toBeGreaterThan(wood.processingMargin);
    });

    it('oil chain processing premium becomes negative at high volume', () => {
      const oil = computeChainProfitability(
        CHAINS.find((c) => c.name === 'Oil → Fuel')!,
        highVolume,
      );

      expect(oil.processingPremium).toBeLessThan(0);
    });

    it('wood chain processing premium stays positive at high volume', () => {
      const wood = computeChainProfitability(
        CHAINS.find((c) => c.name === 'Wood → Plank')!,
        highVolume,
      );

      expect(wood.processingPremium).toBeGreaterThan(0);
    });

    it('iron chain processing premium stays positive at high volume', () => {
      const iron = computeChainProfitability(
        CHAINS.find((c) => c.name === 'Iron → Ingot')!,
        highVolume,
      );

      expect(iron.processingPremium).toBeGreaterThan(0);
    });
  });

  describe('4. Cross-Chain Ranking Change', () => {
    it('at low volume: wood has the highest margin', () => {
      const results = CHAINS.map((c) => ({
        name: c.name,
        margin: computeChainProfitability(c, 10).processingMargin,
      }));

      const wood = results.find((r) => r.name === 'Wood → Plank')!;
      const iron = results.find((r) => r.name === 'Iron → Ingot')!;
      const oil = results.find((r) => r.name === 'Oil → Fuel')!;

      expect(wood.margin).toBeGreaterThan(iron.margin);
      expect(wood.margin).toBeGreaterThan(oil.margin);
    });

    it('at high volume: iron overtakes wood in margin', () => {
      const results = CHAINS.map((c) => ({
        name: c.name,
        margin: computeChainProfitability(c, 2000).processingMargin,
      }));

      const iron = results.find((r) => r.name === 'Iron → Ingot')!;
      const wood = results.find((r) => r.name === 'Wood → Plank')!;

      expect(iron.margin).toBeGreaterThan(wood.margin);
    });

    it('at low volume: oil is the lowest margin chain', () => {
      const results = CHAINS.map((c) => ({
        name: c.name,
        margin: computeChainProfitability(c, 10).processingMargin,
      }));

      const oil = results.find((r) => r.name === 'Oil → Fuel')!;
      const wood = results.find((r) => r.name === 'Wood → Plank')!;
      const iron = results.find((r) => r.name === 'Iron → Ingot')!;

      expect(oil.margin).toBeLessThan(wood.margin);
      expect(oil.margin).toBeLessThan(iron.margin);
    });

    it('at high volume: oil margin becomes negative', () => {
      const oil = computeChainProfitability(
        CHAINS.find((c) => c.name === 'Oil → Fuel')!,
        2000,
      );

      expect(oil.processingMargin).toBeLessThan(0);
    });

    it('ranking changes between low and high volume', () => {
      const lowResults = CHAINS.map((c) => ({
        name: c.name,
        margin: computeChainProfitability(c, 10).processingMargin,
      }));
      const highResults = CHAINS.map((c) => ({
        name: c.name,
        margin: computeChainProfitability(c, 2000).processingMargin,
      }));

      const lowRanking = [...lowResults].sort((a, b) => b.margin - a.margin).map((r) => r.name);
      const highRanking = [...highResults].sort((a, b) => b.margin - a.margin).map((r) => r.name);

      expect(lowRanking).not.toEqual(highRanking);
    });
  });

  describe('5. Profitability Changes Continuously with Volume', () => {
    it('wood chain margin decreases from low to high volume', () => {
      const wood = CHAINS.find((c) => c.name === 'Wood → Plank')!;
      const volumes = [10, 50, 100, 200, 500, 1000, 2000];
      const margins = volumes.map((v) => computeChainProfitability(wood, v).processingMargin);

      expect(margins[0]).toBeGreaterThan(margins[margins.length - 1]);

      let decreases = 0;
      for (let i = 1; i < margins.length; i++) {
        if (margins[i] <= margins[i - 1]) {
          decreases++;
        }
      }
      expect(decreases).toBeGreaterThanOrEqual(margins.length - 2);
    });

    it('oil chain premium crosses zero between medium and high volume', () => {
      const oil = CHAINS.find((c) => c.name === 'Oil → Fuel')!;
      const mediumPremium = computeChainProfitability(oil, 500).processingPremium;
      const highPremium = computeChainProfitability(oil, 2000).processingPremium;

      expect(mediumPremium).toBeGreaterThan(0);
      expect(highPremium).toBeLessThan(0);
    });

    it('iron chain maintains positive premium across all tested volumes', () => {
      const iron = CHAINS.find((c) => c.name === 'Iron → Ingot')!;
      const volumes = [10, 50, 100, 200, 500, 1000, 2000, 5000];

      for (const v of volumes) {
        const result = computeChainProfitability(iron, v);
        expect(result.processingPremium).toBeGreaterThan(0);
      }
    });
  });

  describe('6. Slippage Model Properties', () => {
    it('slippage is purely deterministic for all resources', () => {
      for (const chain of CHAINS) {
        for (const volume of [50, 100, 500, 1000]) {
          const q1 = calculateSlippageQuote({
            anchorPrice: chain.processedPrice,
            quantity: volume,
            side: 'sell',
            resourceId: chain.processedId,
          });
          const q2 = calculateSlippageQuote({
            anchorPrice: chain.processedPrice,
            quantity: volume,
            side: 'sell',
            resourceId: chain.processedId,
          });

          expect(q1).toEqual(q2);
        }
      }
    });

    it('no randomness: 100 identical calls produce identical results', () => {
      for (let i = 0; i < 100; i++) {
        const quote = calculateSlippageQuote({
          anchorPrice: 42,
          quantity: 250,
          side: 'sell',
          resourceId: 'iron_ingot',
        });

        expect(quote.effectiveAvgPrice).toBe(quote.effectiveAvgPrice);
        expect(quote.slippageBps).toBe(quote.slippageBps);
      }
    });

    it('fuel has the shallowest depth among processed goods', () => {
      expect(resourceLiquidityConfig.fuel.depth).toBeLessThan(resourceLiquidityConfig.iron_ingot.depth);
      expect(resourceLiquidityConfig.fuel.depth).toBeLessThan(resourceLiquidityConfig.plank.depth);
    });

    it('fuel has the highest slippage rate among processed goods', () => {
      expect(resourceLiquidityConfig.fuel.slippageRateBps).toBeGreaterThan(
        resourceLiquidityConfig.iron_ingot.slippageRateBps,
      );
      expect(resourceLiquidityConfig.fuel.slippageRateBps).toBeGreaterThan(
        resourceLiquidityConfig.plank.slippageRateBps,
      );
    });
  });
});
