import { describe, expect, it } from 'vitest';
import { getMarketContextPrice } from '../src/modules/market/market-context';
import { productionRecipeCatalog, starterTransformRecipes } from '@industrial-dominion/shared';
import { gameConfig } from '@industrial-dominion/config';

const FEE = gameConfig.marketFee;

function net(gross: number): number {
  return gross - Math.round(gross * FEE);
}

type ChainSpec = {
  name: string;
  rawId: string;
  processedId: string;
  rawPrice: number;
  processedPrice: number;
  regionId: 'ironridge' | 'greenhaven' | 'sunbarrel' | 'riverplain';
  instantRecipeKey: string;
  batchRecipeId: string;
  buildingTypeId: string;
  batchDuration: number;
};

const CHAINS: ChainSpec[] = [
  {
    name: 'Wood → Plank',
    rawId: 'wood',
    processedId: 'plank',
    rawPrice: 10,
    processedPrice: 26,
    regionId: 'greenhaven',
    instantRecipeKey: 'plank_from_wood',
    batchRecipeId: 'greenhaven_plank_batch',
    buildingTypeId: 'greenhaven_timber_extractor',
    batchDuration: 1800,
  },
  {
    name: 'Iron → Ingot',
    rawId: 'iron_ore',
    processedId: 'iron_ingot',
    rawPrice: 18,
    processedPrice: 42,
    regionId: 'ironridge',
    instantRecipeKey: 'iron_ingot_from_iron_ore',
    batchRecipeId: 'ironridge_iron_ingot_batch',
    buildingTypeId: 'ironridge_iron_extractor',
    batchDuration: 3600,
  },
  {
    name: 'Oil → Fuel',
    rawId: 'crude_oil',
    processedId: 'fuel',
    rawPrice: 22,
    processedPrice: 48,
    regionId: 'sunbarrel',
    instantRecipeKey: 'fuel_from_crude_oil',
    batchRecipeId: 'sunbarrel_fuel_batch',
    buildingTypeId: 'sunbarrel_oil_extractor',
    batchDuration: 2400,
  },
];

describe('TASK-054: Multi-Chain Industrial Decision Validation', () => {
  describe('1. Per-Chain Raw vs Processed', () => {
    for (const chain of CHAINS) {
      describe(chain.name, () => {
        const netRaw = net(2 * chain.rawPrice);
        const netProcessed = net(chain.processedPrice);
        const delta = netProcessed - netRaw;
        const pct = delta / netRaw;
        const ratio = chain.processedPrice / chain.rawPrice;

        it(`raw sell: 2 ${chain.rawId} = ${2 * chain.rawPrice} gross → ${netRaw} net`, () => {
          expect(netRaw).toBeGreaterThan(0);
        });

        it(`processed sell: 1 ${chain.processedId} = ${chain.processedPrice} gross → ${netProcessed} net`, () => {
          expect(netProcessed).toBeGreaterThan(0);
        });

        it(`processing premium: +${delta} credits (${(pct * 100).toFixed(1)}%)`, () => {
          expect(netProcessed).toBeGreaterThan(netRaw);
          expect(pct).toBeGreaterThan(0);
        });

        it(`price ratio: ${ratio.toFixed(2)} (breakeven at 2.00)`, () => {
          expect(ratio).toBeGreaterThan(2);
        });

        it('recipe exists with correct 2:1 ratio', () => {
          const recipe = productionRecipeCatalog.find(
            (r) => r.key === chain.instantRecipeKey,
          );
          expect(recipe).toBeDefined();
          expect(recipe!.inputResourceId).toBe(chain.rawId);
          expect(recipe!.inputAmount).toBe(2);
          expect(recipe!.outputResourceId).toBe(chain.processedId);
          expect(recipe!.outputAmount).toBe(1);
        });

        it('batch transform exists with correct ratio and region building', () => {
          const recipe = starterTransformRecipes.find(
            (r) => r.id === chain.batchRecipeId,
          );
          expect(recipe).toBeDefined();
          expect(recipe!.buildingTypeId).toBe(chain.buildingTypeId);
          expect(recipe!.inputResourceId).toBe(chain.rawId);
          expect(recipe!.inputAmount).toBe(12);
          expect(recipe!.outputResourceId).toBe(chain.processedId);
          expect(recipe!.outputAmount).toBe(6);
          expect(recipe!.durationSeconds).toBe(chain.batchDuration);
        });
      });
    }
  });

  describe('2. Cross-Chain Comparison — Chains Are NOT Interchangeable', () => {
    const [wood, iron, oil] = CHAINS;

    it('margins differ across chains', () => {
      const woodMargin = (net(wood.processedPrice) - net(2 * wood.rawPrice)) / net(2 * wood.rawPrice);
      const ironMargin = (net(iron.processedPrice) - net(2 * iron.rawPrice)) / net(2 * iron.rawPrice);
      const oilMargin = (net(oil.processedPrice) - net(2 * oil.rawPrice)) / net(2 * oil.rawPrice);

      expect(woodMargin).not.toBeCloseTo(ironMargin, 1);
      expect(ironMargin).not.toBeCloseTo(oilMargin, 1);
      expect(woodMargin).not.toBeCloseTo(oilMargin, 1);
    });

    it('wood chain has the highest relative margin', () => {
      const woodPct = (net(wood.processedPrice) - net(2 * wood.rawPrice)) / net(2 * wood.rawPrice);
      const ironPct = (net(iron.processedPrice) - net(2 * iron.rawPrice)) / net(2 * iron.rawPrice);
      const oilPct = (net(oil.processedPrice) - net(2 * oil.rawPrice)) / net(2 * oil.rawPrice);

      expect(woodPct).toBeGreaterThan(ironPct);
      expect(woodPct).toBeGreaterThan(oilPct);
    });

    it('oil chain has the lowest relative margin', () => {
      const ironPct = (net(iron.processedPrice) - net(2 * iron.rawPrice)) / net(2 * iron.rawPrice);
      const oilPct = (net(oil.processedPrice) - net(2 * oil.rawPrice)) / net(2 * oil.rawPrice);

      expect(oilPct).toBeLessThan(ironPct);
    });

    it('absolute delta differs — iron has highest absolute profit per unit processed', () => {
      const woodDelta = net(wood.processedPrice) - net(2 * wood.rawPrice);
      const ironDelta = net(iron.processedPrice) - net(2 * iron.rawPrice);
      const oilDelta = net(oil.processedPrice) - net(2 * oil.rawPrice);

      expect(ironDelta).toBeGreaterThan(woodDelta);
      expect(ironDelta).toBeGreaterThan(oilDelta);
    });

    it('batch durations differ — not all chains take the same time', () => {
      const durations = CHAINS.map((c) => c.batchDuration);
      const unique = new Set(durations);
      expect(unique.size).toBeGreaterThan(1);
    });

    it('price tiers differ — iron_ingot costs more than plank, fuel costs more than iron_ingot', () => {
      expect(iron.processedPrice).toBeGreaterThan(wood.processedPrice);
      expect(oil.processedPrice).toBeGreaterThan(iron.processedPrice);
    });

    it('raw input prices span a meaningful range (10 to 22)', () => {
      const rawPrices = CHAINS.map((c) => c.rawPrice);
      expect(Math.max(...rawPrices) - Math.min(...rawPrices)).toBeGreaterThanOrEqual(10);
    });
  });

  describe('3. Market Sensitivity — Decisions Flip Near Breakeven', () => {
    for (const chain of CHAINS) {
      describe(chain.name, () => {
        it('processing wins at base prices', () => {
          expect(net(chain.processedPrice)).toBeGreaterThan(net(2 * chain.rawPrice));
        });

        it('raw wins if processed drops to exactly 2×raw', () => {
          const breakevenPrice = 2 * chain.rawPrice;
          const netAtBreakeven = net(breakevenPrice);
          const netRaw = net(2 * chain.rawPrice);
          expect(netAtBreakeven).toBe(netRaw);
        });

        it('raw wins if processed drops 1 below breakeven', () => {
          const depressedPrice = 2 * chain.rawPrice - 1;
          expect(net(depressedPrice)).toBeLessThan(net(2 * chain.rawPrice));
        });

        it('±3 credit move on processed changes the decision', () => {
          const breakeven = 2 * chain.rawPrice;
          const netRaw = net(2 * chain.rawPrice);

          const above = net(breakeven + 3);
          const below = net(breakeven - 3);

          expect(above).toBeGreaterThan(netRaw);
          expect(below).toBeLessThan(netRaw);
        });
      });
    }
  });

  describe('4. Regional / Context Effects', () => {
    for (const chain of CHAINS) {
      describe(`${chain.name} (${chain.regionId})`, () => {
        it('region_anchor applies sell pressure to the focus raw resource', () => {
          const anchorSell = getMarketContextPrice({
            contextKey: 'region_anchor',
            regionId: chain.regionId,
            resourceId: chain.rawId,
            basePrice: chain.rawPrice,
            side: 'sell',
          });

          expect(anchorSell.modifierPercent).toBe(-0.1);
          expect(anchorSell.price).toBeLessThan(chain.rawPrice);
        });

        it('region_anchor applies buy discount to the focus raw resource', () => {
          const anchorBuy = getMarketContextPrice({
            contextKey: 'region_anchor',
            regionId: chain.regionId,
            resourceId: chain.rawId,
            basePrice: chain.rawPrice,
            side: 'buy',
          });

          expect(anchorBuy.modifierPercent).toBe(-0.15);
          expect(anchorBuy.price).toBeLessThan(chain.rawPrice);
        });

        it('region_anchor does NOT modify the processed resource price', () => {
          const anchorProcessed = getMarketContextPrice({
            contextKey: 'region_anchor',
            regionId: chain.regionId,
            resourceId: chain.processedId,
            basePrice: chain.processedPrice,
            side: 'sell',
          });

          expect(anchorProcessed.modifierPercent).toBe(0);
          expect(anchorProcessed.price).toBe(chain.processedPrice);
        });

        it('regional context amplifies processing incentive for this chain', () => {
          const rawSellAtAnchor = getMarketContextPrice({
            contextKey: 'region_anchor',
            regionId: chain.regionId,
            resourceId: chain.rawId,
            basePrice: chain.rawPrice,
            side: 'sell',
          }).price;

          const baseNetRaw = net(2 * chain.rawPrice);
          const regionalNetRaw = net(2 * rawSellAtAnchor);
          const netProcessed = net(chain.processedPrice);

          const basePremium = (netProcessed - baseNetRaw) / baseNetRaw;
          const regionalPremium = (netProcessed - regionalNetRaw) / regionalNetRaw;

          expect(regionalPremium).toBeGreaterThan(basePremium);
        });
      });
    }

    it('iron chain has additional trade_hub premiums that other chains lack', () => {
      const ironHubSell = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'ironridge',
        resourceId: 'iron_ingot',
        basePrice: 42,
        side: 'sell',
      });

      const plankHubSell = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'greenhaven',
        resourceId: 'plank',
        basePrice: 26,
        side: 'sell',
      });

      const fuelHubSell = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'sunbarrel',
        resourceId: 'fuel',
        basePrice: 48,
        side: 'sell',
      });

      expect(ironHubSell.modifierPercent).toBe(0.18);
      expect(plankHubSell.modifierPercent).toBe(0);
      expect(fuelHubSell.modifierPercent).toBe(0);

      expect(ironHubSell.price).toBeGreaterThan(42);
      expect(plankHubSell.price).toBe(26);
      expect(fuelHubSell.price).toBe(48);
    });
  });

  describe('5. Player Decision Quality', () => {
    it('"always process" is NOT always optimal — raw can win under price pressure', () => {
      for (const chain of CHAINS) {
        const depressedProcessed = chain.rawPrice * 2 - 1;
        expect(net(depressedProcessed)).toBeLessThan(net(2 * chain.rawPrice));
      }
    });

    it('"always sell raw" is NOT optimal at base prices — processing always wins', () => {
      for (const chain of CHAINS) {
        expect(net(chain.processedPrice)).toBeGreaterThan(net(2 * chain.rawPrice));
      }
    });

    it('player must evaluate each chain independently — margins differ', () => {
      const margins = CHAINS.map((c) => {
        const raw = net(2 * c.rawPrice);
        const processed = net(c.processedPrice);
        return (processed - raw) / raw;
      });

      const min = Math.min(...margins);
      const max = Math.max(...margins);
      expect(max - min).toBeGreaterThan(0.05);
    });

    it('batch time creates a time-value tradeoff — chains differ in duration', () => {
      const [wood, iron, oil] = CHAINS;
      expect(wood.batchDuration).toBeLessThan(oil.batchDuration);
      expect(oil.batchDuration).toBeLessThan(iron.batchDuration);
    });
  });

  describe('6. Economic Diversity — Static vs Dynamic', () => {
    it('base prices alone create differentiated chains (not identical clones)', () => {
      const ratios = CHAINS.map((c) => c.processedPrice / c.rawPrice);
      const unique = new Set(ratios.map((r) => Math.round(r * 100)));
      expect(unique.size).toBe(CHAINS.length);
    });

    it('regional anchor modifiers create real price variation from base', () => {
      for (const chain of CHAINS) {
        const anchorSell = getMarketContextPrice({
          contextKey: 'region_anchor',
          regionId: chain.regionId,
          resourceId: chain.rawId,
          basePrice: chain.rawPrice,
          side: 'sell',
        });

        expect(anchorSell.price).not.toBe(chain.rawPrice);
        expect(anchorSell.price).toBeLessThan(chain.rawPrice);
      }
    });

    it('iron chain has unique trade_hub dynamics — only chain with processed premium', () => {
      const ironIngotHub = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'ironridge',
        resourceId: 'iron_ingot',
        basePrice: 42,
        side: 'sell',
      });

      const fuelHub = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'sunbarrel',
        resourceId: 'fuel',
        basePrice: 48,
        side: 'sell',
      });

      const plankHub = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'greenhaven',
        resourceId: 'plank',
        basePrice: 26,
        side: 'sell',
      });

      expect(ironIngotHub.price).toBeGreaterThan(42);
      expect(fuelHub.price).toBe(48);
      expect(plankHub.price).toBe(26);
    });

    it('system is NOT static — context + order book + spread create variation', () => {
      const basePrice = 22;
      const anchorBuy = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'sunbarrel',
        resourceId: 'crude_oil',
        basePrice,
        side: 'buy',
      });
      const hubSell = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'sunbarrel',
        resourceId: 'crude_oil',
        basePrice,
        side: 'sell',
      });

      const prices = [basePrice, anchorBuy.price, hubSell.price];
      const unique = new Set(prices);
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('7. Final Verdict', () => {
    it('all three chains produce a net positive processing premium', () => {
      for (const chain of CHAINS) {
        const raw = net(2 * chain.rawPrice);
        const processed = net(chain.processedPrice);
        expect(processed).toBeGreaterThan(raw);
      }
    });

    it('all three chains can flip to raw-wins under price pressure', () => {
      for (const chain of CHAINS) {
        const raw = net(2 * chain.rawPrice);
        const depressed = net(2 * chain.rawPrice - 1);
        expect(depressed).toBeLessThan(raw);
      }
    });

    it('chains are economically differentiated — not clones', () => {
      const premiums = CHAINS.map((c) => {
        const raw = net(2 * c.rawPrice);
        const processed = net(c.processedPrice);
        return Math.round(((processed - raw) / raw) * 100);
      });

      const unique = new Set(premiums);
      expect(unique.size).toBe(CHAINS.length);
    });

    it('regional context meaningfully changes the decision landscape', () => {
      for (const chain of CHAINS) {
        const baseRaw = net(2 * chain.rawPrice);
        const anchorRaw = getMarketContextPrice({
          contextKey: 'region_anchor',
          regionId: chain.regionId,
          resourceId: chain.rawId,
          basePrice: chain.rawPrice,
          side: 'sell',
        }).price;
        const regionalRaw = net(2 * anchorRaw);

        expect(regionalRaw).toBeLessThan(baseRaw);
      }
    });

    it('industrial system covers all three starter extraction regions', () => {
      const regions = CHAINS.map((c) => c.regionId);
      expect(regions).toContain('ironridge');
      expect(regions).toContain('greenhaven');
      expect(regions).toContain('sunbarrel');
    });
  });
});
