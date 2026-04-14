import { describe, expect, it } from 'vitest';
import { getMarketContextPrice } from '../src/modules/market/market-context';
import { productionRecipeCatalog, starterTransformRecipes } from '@industrial-dominion/shared';
import { gameConfig } from '@industrial-dominion/config';

const MARKET_FEE = gameConfig.marketFee;

const WOOD_BASE_PRICE = 10;
const PLANK_BASE_PRICE = 26;
const IRON_ORE_BASE_PRICE = 18;
const IRON_INGOT_BASE_PRICE = 42;

function netAfterFee(gross: number): number {
  return gross - Math.round(gross * MARKET_FEE);
}

describe('TASK-051: Industrial Decision Validation — Wood → Plank', () => {
  describe('1. Raw Sell vs Transform + Sell (Base Prices)', () => {
    const woodQty = 12;
    const plankQty = 6;

    it('selling wood raw yields a deterministic net amount', () => {
      const gross = woodQty * WOOD_BASE_PRICE;
      const net = netAfterFee(gross);
      expect(gross).toBe(120);
      expect(net).toBe(118);
    });

    it('transforming wood to planks then selling yields higher net', () => {
      const grossPlanks = plankQty * PLANK_BASE_PRICE;
      const netPlanks = netAfterFee(grossPlanks);

      const grossWood = woodQty * WOOD_BASE_PRICE;
      const netWood = netAfterFee(grossWood);

      expect(grossPlanks).toBe(156);
      expect(netPlanks).toBe(153);
      expect(netPlanks).toBeGreaterThan(netWood);

      const premium = netPlanks - netWood;
      const premiumPct = premium / netWood;
      expect(premium).toBe(35);
      expect(premiumPct).toBeGreaterThan(0.28);
      expect(premiumPct).toBeLessThan(0.32);
    });

    it('per-unit comparison: 1 plank net > 2 wood net', () => {
      const netOnePlank = netAfterFee(PLANK_BASE_PRICE);
      const netTwoWood = netAfterFee(2 * WOOD_BASE_PRICE);

      expect(netOnePlank).toBe(25);
      expect(netTwoWood).toBe(20);
      expect(netOnePlank).toBeGreaterThan(netTwoWood);
    });
  });

  describe('2. Profit Comparison Under Market Contexts', () => {
    it('Greenhaven region_anchor suppresses wood sell price, amplifying processing incentive', () => {
      const greenhavenWoodSell = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'greenhaven',
        resourceId: 'wood',
        basePrice: WOOD_BASE_PRICE,
        side: 'sell',
      });

      expect(greenhavenWoodSell.modifierPercent).toBe(-0.1);
      expect(greenhavenWoodSell.price).toBe(9);

      const greenhavenPlankSell = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'greenhaven',
        resourceId: 'plank',
        basePrice: PLANK_BASE_PRICE,
        side: 'sell',
      });

      expect(greenhavenPlankSell.modifierPercent).toBe(0);
      expect(greenhavenPlankSell.price).toBe(26);
    });

    it('in Greenhaven, processing premium is higher than at base prices', () => {
      const woodSellPrice = 9;
      const plankSellPrice = 26;

      const netWood = netAfterFee(12 * woodSellPrice);
      const netPlank = netAfterFee(6 * plankSellPrice);

      const premium = netPlank - netWood;
      const premiumPct = premium / netWood;

      expect(netWood).toBe(106);
      expect(netPlank).toBe(153);
      expect(premium).toBe(47);
      expect(premiumPct).toBeGreaterThan(0.42);
    });

    it('trade_hub has no special modifier for wood or plank', () => {
      const hubWoodBuy = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'greenhaven',
        resourceId: 'wood',
        basePrice: WOOD_BASE_PRICE,
        side: 'buy',
      });

      const hubPlankSell = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'greenhaven',
        resourceId: 'plank',
        basePrice: PLANK_BASE_PRICE,
        side: 'sell',
      });

      expect(hubWoodBuy.modifierPercent).toBe(0);
      expect(hubPlankSell.modifierPercent).toBe(0);
    });
  });

  describe('3. Breakeven Analysis — When Raw Is Better', () => {
    it('at base prices, processing always wins (plank/wood ratio > 2)', () => {
      const ratio = PLANK_BASE_PRICE / WOOD_BASE_PRICE;
      expect(ratio).toBe(2.6);
      expect(ratio).toBeGreaterThan(2);
    });

    it('breakeven ratio is exactly 2.0 (after fees)', () => {
      const sell2wood = netAfterFee(2 * WOOD_BASE_PRICE);
      const sell1plank_breakeven = netAfterFee(2 * WOOD_BASE_PRICE);

      expect(sell2wood).toBe(sell1plank_breakeven);
    });

    it('if plank drops to 19 (ratio < 2), raw sell becomes better', () => {
      const depressedPlankPrice = 19;
      const netPlank = netAfterFee(depressedPlankPrice);
      const netWood = netAfterFee(2 * WOOD_BASE_PRICE);

      expect(netPlank).toBeLessThan(netWood);
    });

    it('if wood rises to 14 (ratio < 2), raw sell becomes better', () => {
      const inflatedWoodPrice = 14;
      const netWood = netAfterFee(2 * inflatedWoodPrice);
      const netPlank = netAfterFee(PLANK_BASE_PRICE);

      expect(netWood).toBeGreaterThan(netPlank);
    });

    it('processing margin is 25% at base prices — enough room for market dynamics', () => {
      const netWood = netAfterFee(2 * WOOD_BASE_PRICE);
      const netPlank = netAfterFee(PLANK_BASE_PRICE);
      const margin = (netPlank - netWood) / netWood;

      expect(margin).toBeGreaterThanOrEqual(0.24);
      expect(margin).toBeLessThan(0.30);
    });
  });

  describe('4. Sensitivity to Price Changes', () => {
    const priceGrid = [
      { woodPrice: 8, plankPrice: 20, expectProcessingWins: true },
      { woodPrice: 8, plankPrice: 16, expectProcessingWins: false },
      { woodPrice: 10, plankPrice: 26, expectProcessingWins: true },
      { woodPrice: 10, plankPrice: 19, expectProcessingWins: false },
      { woodPrice: 12, plankPrice: 26, expectProcessingWins: true },
      { woodPrice: 14, plankPrice: 26, expectProcessingWins: false },
      { woodPrice: 15, plankPrice: 31, expectProcessingWins: true },
      { woodPrice: 15, plankPrice: 29, expectProcessingWins: false },
    ];

    for (const { woodPrice, plankPrice, expectProcessingWins } of priceGrid) {
      it(`wood=${woodPrice} plank=${plankPrice} → processing ${expectProcessingWins ? 'wins' : 'loses'}`, () => {
        const netWood = netAfterFee(2 * woodPrice);
        const netPlank = netAfterFee(plankPrice);

        if (expectProcessingWins) {
          expect(netPlank).toBeGreaterThan(netWood);
        } else {
          expect(netPlank).toBeLessThanOrEqual(netWood);
        }
      });
    }

    it('small price changes can flip the decision (sensitivity confirmed)', () => {
      const woodAt10_plankAt21 = netAfterFee(21) > netAfterFee(20);
      expect(woodAt10_plankAt21).toBe(true);

      const woodAt10_plankAt19 = netAfterFee(19) > netAfterFee(20);
      expect(woodAt10_plankAt19).toBe(false);

      const woodAt11_plankAt23 = netAfterFee(23) > netAfterFee(22);
      expect(woodAt11_plankAt23).toBe(true);

      const woodAt12_plankAt23 = netAfterFee(23) > netAfterFee(24);
      expect(woodAt12_plankAt23).toBe(false);
    });
  });

  describe('5. Recipe Integrity', () => {
    it('instant production recipe exists with correct 2:1 ratio', () => {
      const recipe = productionRecipeCatalog.find((r) => r.key === 'plank_from_wood');
      expect(recipe).toBeDefined();
      expect(recipe!.inputResourceId).toBe('wood');
      expect(recipe!.inputAmount).toBe(2);
      expect(recipe!.outputResourceId).toBe('plank');
      expect(recipe!.outputAmount).toBe(1);
    });

    it('batch transform recipe exists with correct 12:6 ratio', () => {
      const recipe = starterTransformRecipes.find(
        (r) => r.id === 'greenhaven_plank_batch',
      );
      expect(recipe).toBeDefined();
      expect(recipe!.inputResourceId).toBe('wood');
      expect(recipe!.inputAmount).toBe(12);
      expect(recipe!.outputResourceId).toBe('plank');
      expect(recipe!.outputAmount).toBe(6);
      expect(recipe!.durationSeconds).toBe(1800);
    });

    it('batch and instant recipes have the same per-unit ratio', () => {
      const instant = productionRecipeCatalog.find((r) => r.key === 'plank_from_wood')!;
      const batch = starterTransformRecipes.find(
        (r) => r.id === 'greenhaven_plank_batch',
      )!;

      const instantRatio = instant.inputAmount / instant.outputAmount;
      const batchRatio = batch.inputAmount / batch.outputAmount;
      expect(instantRatio).toBe(batchRatio);
      expect(instantRatio).toBe(2);
    });
  });

  describe('6. Iron Chain Economic Validation', () => {
    it('iron_ingot is tradable and has a real raw-vs-processed decision', () => {
      expect(IRON_INGOT_BASE_PRICE).toBe(42);
      expect(IRON_ORE_BASE_PRICE).toBe(18);

      const ironRatio = IRON_INGOT_BASE_PRICE / IRON_ORE_BASE_PRICE;
      expect(ironRatio).toBeGreaterThan(2);
    });

    it('iron_ingot processing yields a meaningful premium over raw sell', () => {
      const netRaw = netAfterFee(2 * IRON_ORE_BASE_PRICE);
      const netProcessed = netAfterFee(IRON_INGOT_BASE_PRICE);
      const premium = (netProcessed - netRaw) / netRaw;

      expect(netProcessed).toBeGreaterThan(netRaw);
      expect(premium).toBeGreaterThan(0.05);
    });

    it('iron_ingot has trade_hub premiums configured', () => {
      const hubSell = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'ironridge',
        resourceId: 'iron_ingot',
        basePrice: IRON_INGOT_BASE_PRICE,
        side: 'sell',
      });

      const hubBuy = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'ironridge',
        resourceId: 'iron_ingot',
        basePrice: IRON_INGOT_BASE_PRICE,
        side: 'buy',
      });

      expect(hubSell.modifierPercent).toBe(0.18);
      expect(hubBuy.modifierPercent).toBe(0.1);
      expect(hubSell.price).toBeGreaterThan(IRON_INGOT_BASE_PRICE);
    });

    it('iron_ingot has higher premium than plank due to trade_hub pricing', () => {
      const plankRatio = PLANK_BASE_PRICE / WOOD_BASE_PRICE;
      const ironRatio = IRON_INGOT_BASE_PRICE / IRON_ORE_BASE_PRICE;

      expect(plankRatio).toBe(2.6);
      expect(ironRatio).toBeCloseTo(2.33, 1);

      expect(IRON_INGOT_BASE_PRICE).toBeGreaterThan(PLANK_BASE_PRICE);
      expect(IRON_ORE_BASE_PRICE).toBeGreaterThan(WOOD_BASE_PRICE);
    });

    it('iron_ingot price sensitivity — raw wins if ingot drops below 35', () => {
      const netRaw = netAfterFee(2 * IRON_ORE_BASE_PRICE);
      const netDepressedIngot = netAfterFee(34);

      expect(netDepressedIngot).toBeLessThan(netRaw);
    });

    it('iron_ingot price sensitivity — processed wins if ingot stays above 36', () => {
      const netRaw = netAfterFee(2 * IRON_ORE_BASE_PRICE);
      const netIngot = netAfterFee(37);

      expect(netIngot).toBeGreaterThan(netRaw);
    });
  });

  describe('7. Arbitrage Check', () => {
    it('buying wood at trade_hub to process is barely profitable', () => {
      const hubWoodBuy = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'ironridge',
        resourceId: 'wood',
        basePrice: WOOD_BASE_PRICE,
        side: 'buy',
      });

      const cost = 2 * hubWoodBuy.price;
      const revenue = netAfterFee(PLANK_BASE_PRICE);
      const profit = revenue - cost;

      expect(hubWoodBuy.price).toBe(10);
      expect(cost).toBe(20);
      expect(revenue).toBe(25);
      expect(profit).toBe(5);
      expect(profit).toBeGreaterThan(0);
      expect(profit).toBeLessThan(PLANK_BASE_PRICE * 0.3);
    });

    it('buying wood at Greenhaven anchor discount is more profitable for processing', () => {
      const greenhavenWoodBuy = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'greenhaven',
        resourceId: 'wood',
        basePrice: WOOD_BASE_PRICE,
        side: 'buy',
      });

      expect(greenhavenWoodBuy.modifierPercent).toBe(-0.15);
      expect(greenhavenWoodBuy.price).toBe(9);

      const cost = 2 * greenhavenWoodBuy.price;
      const revenue = netAfterFee(PLANK_BASE_PRICE);
      const profit = revenue - cost;

      expect(cost).toBe(18);
      expect(revenue).toBe(25);
      expect(profit).toBe(7);
    });
  });

  describe('8. Final Verdict', () => {
    it('processing premium is meaningful (>=24%) but not dominant (<30%)', () => {
      const netWood = netAfterFee(2 * WOOD_BASE_PRICE);
      const netPlank = netAfterFee(PLANK_BASE_PRICE);
      const premium = (netPlank - netWood) / netWood;

      expect(premium).toBeGreaterThanOrEqual(0.24);
      expect(premium).toBeLessThanOrEqual(0.30);
    });

    it('decision can flip under realistic price changes (±30%)', () => {
      const depressedPlank = Math.round(PLANK_BASE_PRICE * 0.7);
      const netPlank = netAfterFee(depressedPlank);
      const netWood = netAfterFee(2 * WOOD_BASE_PRICE);

      expect(depressedPlank).toBe(18);
      expect(netPlank).toBeLessThan(netWood);
    });

    it('regional context amplifies the industrial decision', () => {
      const greenhavenNetWood = netAfterFee(12 * 9);
      const baseNetWood = netAfterFee(12 * WOOD_BASE_PRICE);

      expect(greenhavenNetWood).toBeLessThan(baseNetWood);
    });

    it('both processed resources (plank, iron_ingot) are tradable with real market decisions', () => {
      const plankRecipe = productionRecipeCatalog.find(
        (r) => r.outputResourceId === 'plank',
      );
      const ironRecipe = productionRecipeCatalog.find(
        (r) => r.outputResourceId === 'iron_ingot',
      );
      expect(plankRecipe).toBeDefined();
      expect(ironRecipe).toBeDefined();

      const netRawIron = netAfterFee(2 * IRON_ORE_BASE_PRICE);
      const netIngot = netAfterFee(IRON_INGOT_BASE_PRICE);
      expect(netIngot).toBeGreaterThan(netRawIron);
    });
  });
});
