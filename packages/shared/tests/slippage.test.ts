import { describe, expect, it } from 'vitest';
import {
  calculateSlippageQuote,
  resourceLiquidityConfig,
} from '../src/economics/slippage';
import type { ResourceId } from '../src/types/game';

describe('TASK-055: Market Depth & Slippage — Unit Tests', () => {
  describe('1. Liquidity Config Integrity', () => {
    it('every ResourceId has a liquidity config entry', () => {
      const allResourceIds: ResourceId[] = [
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

      for (const id of allResourceIds) {
        expect(resourceLiquidityConfig[id]).toBeDefined();
        expect(resourceLiquidityConfig[id].depth).toBeGreaterThan(0);
        expect(resourceLiquidityConfig[id].slippageRateBps).toBeGreaterThan(0);
      }
    });

    it('processed goods have shallower depth than their raw input', () => {
      expect(resourceLiquidityConfig.iron_ingot.depth).toBeLessThan(
        resourceLiquidityConfig.iron_ore.depth,
      );
      expect(resourceLiquidityConfig.plank.depth).toBeLessThan(
        resourceLiquidityConfig.wood.depth,
      );
      expect(resourceLiquidityConfig.fuel.depth).toBeLessThan(
        resourceLiquidityConfig.crude_oil.depth,
      );
    });

    it('processed goods have higher slippage rates than their raw input', () => {
      expect(resourceLiquidityConfig.iron_ingot.slippageRateBps).toBeGreaterThan(
        resourceLiquidityConfig.iron_ore.slippageRateBps,
      );
      expect(resourceLiquidityConfig.plank.slippageRateBps).toBeGreaterThan(
        resourceLiquidityConfig.wood.slippageRateBps,
      );
      expect(resourceLiquidityConfig.fuel.slippageRateBps).toBeGreaterThan(
        resourceLiquidityConfig.crude_oil.slippageRateBps,
      );
    });
  });

  describe('2. Zero Slippage Within Depth', () => {
    it('iron_ore: no slippage for quantity within depth', () => {
      const quote = calculateSlippageQuote({
        anchorPrice: 18,
        quantity: 50,
        side: 'buy',
        resourceId: 'iron_ore',
      });

      expect(quote.anchorPrice).toBe(18);
      expect(quote.effectiveAvgPrice).toBe(18);
      expect(quote.totalGross).toBe(900);
      expect(quote.slippageBps).toBe(0);
      expect(quote.slippagePercent).toBe(0);
    });

    it('iron_ore: no slippage at exactly depth', () => {
      const depth = resourceLiquidityConfig.iron_ore.depth;
      const quote = calculateSlippageQuote({
        anchorPrice: 18,
        quantity: depth,
        side: 'buy',
        resourceId: 'iron_ore',
      });

      expect(quote.slippageBps).toBe(0);
      expect(quote.effectiveAvgPrice).toBe(18);
    });

    it('water: no slippage for 100 units (depth = 100)', () => {
      const quote = calculateSlippageQuote({
        anchorPrice: 6,
        quantity: 100,
        side: 'sell',
        resourceId: 'water',
      });

      expect(quote.slippageBps).toBe(0);
    });

    it('returns zero slippage for zero anchor price', () => {
      const quote = calculateSlippageQuote({
        anchorPrice: 0,
        quantity: 200,
        side: 'buy',
        resourceId: 'iron_ore',
      });

      expect(quote.effectiveAvgPrice).toBe(0);
      expect(quote.slippageBps).toBe(0);
    });
  });

  describe('3. Slippage Beyond Depth — Buy Side', () => {
    it('iron_ore: slippage applies when quantity exceeds depth', () => {
      const quote = calculateSlippageQuote({
        anchorPrice: 18,
        quantity: 100,
        side: 'buy',
        resourceId: 'iron_ore',
      });

      expect(quote.anchorPrice).toBe(18);
      expect(quote.totalGross).toBeGreaterThan(18 * 100);
      expect(quote.slippageBps).toBeGreaterThan(0);
      expect(quote.slippagePercent).toBeGreaterThan(0);
      expect(quote.side).toBe('buy');
    });

    it('slippage increases with quantity (deterministic)', () => {
      const q200 = calculateSlippageQuote({
        anchorPrice: 18,
        quantity: 200,
        side: 'buy',
        resourceId: 'iron_ore',
      });
      const q500 = calculateSlippageQuote({
        anchorPrice: 18,
        quantity: 500,
        side: 'buy',
        resourceId: 'iron_ore',
      });

      expect(q500.slippageBps).toBeGreaterThan(q200.slippageBps);
      expect(q500.totalGross / 500).toBeGreaterThan(q200.totalGross / 200);
    });

    it('slippage is deterministic: same inputs always produce same output', () => {
      const input = {
        anchorPrice: 42,
        quantity: 150,
        side: 'buy' as const,
        resourceId: 'iron_ingot' as const,
      };

      const q1 = calculateSlippageQuote(input);
      const q2 = calculateSlippageQuote(input);

      expect(q1).toEqual(q2);
    });

    it('iron_ingot has higher slippage rate than iron_ore', () => {
      const ore = calculateSlippageQuote({
        anchorPrice: 18,
        quantity: 200,
        side: 'buy',
        resourceId: 'iron_ore',
      });
      const ingot = calculateSlippageQuote({
        anchorPrice: 42,
        quantity: 200,
        side: 'buy',
        resourceId: 'iron_ingot',
      });

      expect(ingot.slippagePercent).toBeGreaterThan(ore.slippagePercent);
    });
  });

  describe('4. Slippage Beyond Depth — Sell Side', () => {
    it('sell side: total gross is below anchor total', () => {
      const quote = calculateSlippageQuote({
        anchorPrice: 26,
        quantity: 100,
        side: 'sell',
        resourceId: 'plank',
      });

      expect(quote.totalGross).toBeLessThan(26 * 100);
      expect(quote.slippageBps).toBeGreaterThan(0);
      expect(quote.side).toBe('sell');
    });

    it('sell side: slippage increases with quantity', () => {
      const q50 = calculateSlippageQuote({
        anchorPrice: 26,
        quantity: 50,
        side: 'sell',
        resourceId: 'plank',
      });
      const q200 = calculateSlippageQuote({
        anchorPrice: 26,
        quantity: 200,
        side: 'sell',
        resourceId: 'plank',
      });

      expect(q200.effectiveAvgPrice).toBeLessThan(q50.effectiveAvgPrice);
    });

    it('fuel has the highest slippage among processed goods at 100 units', () => {
      const fuel = calculateSlippageQuote({
        anchorPrice: 48,
        quantity: 100,
        side: 'sell',
        resourceId: 'fuel',
      });
      const ingot = calculateSlippageQuote({
        anchorPrice: 42,
        quantity: 100,
        side: 'sell',
        resourceId: 'iron_ingot',
      });
      const plank = calculateSlippageQuote({
        anchorPrice: 26,
        quantity: 100,
        side: 'sell',
        resourceId: 'plank',
      });

      expect(fuel.slippagePercent).toBeGreaterThan(ingot.slippagePercent);
      expect(fuel.slippagePercent).toBeGreaterThan(plank.slippagePercent);
    });
  });

  describe('5. Price Floor', () => {
    it('total gross never drops below quantity (minimum 1 per unit)', () => {
      const quote = calculateSlippageQuote({
        anchorPrice: 1,
        quantity: 500,
        side: 'sell',
        resourceId: 'water',
      });

      expect(quote.totalGross).toBeGreaterThanOrEqual(500);
    });
  });

  describe('6. Cheap Resources Slippage', () => {
    it('water at overflow: total gross is below anchor total', () => {
      const quote = calculateSlippageQuote({
        anchorPrice: 6,
        quantity: 200,
        side: 'sell',
        resourceId: 'water',
      });

      expect(quote.anchorPrice).toBe(6);
      expect(quote.totalGross).toBeLessThan(6 * 200);
      expect(quote.slippageBps).toBeGreaterThan(0);
    });

    it('sand at moderate overflow shows slippage in total', () => {
      const quote = calculateSlippageQuote({
        anchorPrice: 8,
        quantity: 200,
        side: 'sell',
        resourceId: 'sand',
      });

      expect(quote.anchorPrice).toBe(8);
      expect(quote.totalGross).toBeLessThan(8 * 200);
    });
  });

  describe('7. Symmetry and Determinism', () => {
    it('buy and sell slippage magnitudes are symmetric at same parameters', () => {
      const buy = calculateSlippageQuote({
        anchorPrice: 18,
        quantity: 150,
        side: 'buy',
        resourceId: 'iron_ore',
      });
      const sell = calculateSlippageQuote({
        anchorPrice: 18,
        quantity: 150,
        side: 'sell',
        resourceId: 'iron_ore',
      });

      expect(buy.slippageBps).toBe(sell.slippageBps);
      const buyDelta = buy.totalGross - 18 * 150;
      const sellDelta = 18 * 150 - sell.totalGross;
      expect(buyDelta).toBe(sellDelta);
    });

    it('same call repeated 1000 times always returns the same result', () => {
      const input = {
        anchorPrice: 42,
        quantity: 250,
        side: 'sell' as const,
        resourceId: 'iron_ingot' as const,
      };

      const first = calculateSlippageQuote(input);

      for (let i = 0; i < 999; i++) {
        const result = calculateSlippageQuote(input);
        expect(result).toEqual(first);
      }
    });
  });

  describe('8. Gradual Slippage Progression', () => {
    it('slippage grows monotonically with quantity for iron_ore buy', () => {
      const quantities = [61, 70, 80, 100, 150, 200, 300, 500];
      let prevSlippage = 0;

      for (const qty of quantities) {
        const quote = calculateSlippageQuote({
          anchorPrice: 18,
          quantity: qty,
          side: 'buy',
          resourceId: 'iron_ore',
        });

        expect(quote.slippageBps).toBeGreaterThanOrEqual(prevSlippage);
        prevSlippage = quote.slippageBps;
      }
    });

    it('slippage grows monotonically with quantity for plank sell', () => {
      const quantities = [21, 30, 50, 80, 100, 150, 250];
      let prevEffective = Infinity;

      for (const qty of quantities) {
        const quote = calculateSlippageQuote({
          anchorPrice: 26,
          quantity: qty,
          side: 'sell',
          resourceId: 'plank',
        });

        expect(quote.effectiveAvgPrice).toBeLessThanOrEqual(prevEffective);
        prevEffective = quote.effectiveAvgPrice;
      }
    });
  });
});
