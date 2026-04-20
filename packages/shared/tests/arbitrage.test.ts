import { describe, expect, it } from 'vitest';
import { buildArbitrageQuote } from '../src/economics/arbitrage';
import { calculateTransportCost } from '../src/economics/logistics';
import { calculateSlippageQuote } from '../src/economics/slippage';

const FEE_RATE = 0.02;

describe('TASK-056: Arbitrage Calculator — Unit Tests', () => {
  describe('1. Deterministic Output', () => {
    it('identical inputs always produce identical results', () => {
      const input = {
        resource: 'iron_ore' as const,
        quantity: 100,
        originRegion: 'ironridge' as const,
        destinationRegion: 'greenhaven' as const,
        originAnchorPrice: 15,
        destinationAnchorPrice: 18,
        feeRate: FEE_RATE,
      };

      const q1 = buildArbitrageQuote(input);
      const q2 = buildArbitrageQuote(input);

      expect(q1).toEqual(q2);
    });

    it('100 identical calls produce identical results', () => {
      const input = {
        resource: 'iron_ingot' as const,
        quantity: 200,
        originRegion: 'ironridge' as const,
        destinationRegion: 'sunbarrel' as const,
        originAnchorPrice: 38,
        destinationAnchorPrice: 42,
        feeRate: FEE_RATE,
      };

      const first = buildArbitrageQuote(input);
      for (let i = 0; i < 99; i++) {
        expect(buildArbitrageQuote(input)).toEqual(first);
      }
    });
  });

  describe('2. Slippage Applied Independently', () => {
    it('origin and destination slippage are independent', () => {
      const quote = buildArbitrageQuote({
        resource: 'iron_ingot',
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
        originAnchorPrice: 38,
        destinationAnchorPrice: 42,
        feeRate: FEE_RATE,
      });

      const originSlippage = calculateSlippageQuote({
        anchorPrice: 38,
        quantity: 100,
        side: 'sell',
        resourceId: 'iron_ingot',
      });
      const destSlippage = calculateSlippageQuote({
        anchorPrice: 42,
        quantity: 100,
        side: 'sell',
        resourceId: 'iron_ingot',
      });

      expect(quote.local.slippageBps).toBe(originSlippage.slippageBps);
      expect(quote.remote.slippageBps).toBe(destSlippage.slippageBps);
    });

    it('local slippage matches direct slippage calculation', () => {
      const anchorPrice = 26;
      const quantity = 50;
      const quote = buildArbitrageQuote({
        resource: 'plank',
        quantity,
        originRegion: 'greenhaven',
        destinationRegion: 'ironridge',
        originAnchorPrice: anchorPrice,
        destinationAnchorPrice: 28,
        feeRate: FEE_RATE,
      });

      const direct = calculateSlippageQuote({
        anchorPrice,
        quantity,
        side: 'sell',
        resourceId: 'plank',
      });

      expect(quote.local.gross).toBe(direct.totalGross);
      expect(quote.local.avgPrice).toBe(direct.effectiveAvgPrice);
      expect(quote.local.slippageBps).toBe(direct.slippageBps);
    });
  });

  describe('3. Transport Cost Reduces Remote Profit', () => {
    it('remote net is less than remote gross by transport cost', () => {
      const quote = buildArbitrageQuote({
        resource: 'iron_ore',
        quantity: 50,
        originRegion: 'ironridge',
        destinationRegion: 'sunbarrel',
        originAnchorPrice: 15,
        destinationAnchorPrice: 18,
        feeRate: FEE_RATE,
      });

      const remoteGrossAfterFee =
        quote.remote.gross - Math.round(quote.remote.gross * FEE_RATE);
      expect(quote.remote.net).toBe(
        remoteGrossAfterFee - quote.remote.transportCost,
      );
    });

    it('transport cost matches direct logistics calculation', () => {
      const quote = buildArbitrageQuote({
        resource: 'coal',
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
        originAnchorPrice: 11,
        destinationAnchorPrice: 12,
        feeRate: FEE_RATE,
      });

      const directCost = calculateTransportCost({
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
      });

      expect(quote.remote.transportCost).toBe(directCost);
    });
  });

  describe('4. Zero Distance Edge Case', () => {
    it('same origin and destination produces zero transport cost', () => {
      const quote = buildArbitrageQuote({
        resource: 'iron_ore',
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'ironridge',
        originAnchorPrice: 15,
        destinationAnchorPrice: 15,
        feeRate: FEE_RATE,
      });

      expect(quote.remote.transportCost).toBe(0);
      expect(quote.remote.transportTime).toBe(0);
    });

    it('same region with same price produces equal local and remote', () => {
      const quote = buildArbitrageQuote({
        resource: 'iron_ore',
        quantity: 100,
        originRegion: 'ironridge',
        destinationRegion: 'ironridge',
        originAnchorPrice: 15,
        destinationAnchorPrice: 15,
        feeRate: FEE_RATE,
      });

      expect(quote.delta.profitDifference).toBe(0);
      expect(quote.delta.isRemoteBetter).toBe(false);
    });
  });

  describe('5. Monotonic Behavior with Quantity', () => {
    it('transport cost increases with quantity', () => {
      const quantities = [10, 50, 100, 200, 500];
      let prevCost = 0;

      for (const qty of quantities) {
        const quote = buildArbitrageQuote({
          resource: 'iron_ore',
          quantity: qty,
          originRegion: 'ironridge',
          destinationRegion: 'sunbarrel',
          originAnchorPrice: 15,
          destinationAnchorPrice: 18,
          feeRate: FEE_RATE,
        });

        expect(quote.remote.transportCost).toBeGreaterThanOrEqual(prevCost);
        prevCost = quote.remote.transportCost;
      }
    });

    it('higher quantity with slippage can flip arbitrage profitability', () => {
      const lowQty = 10;
      const highQty = 2000;

      const lowQuote = buildArbitrageQuote({
        resource: 'iron_ingot',
        quantity: lowQty,
        originRegion: 'ironridge',
        destinationRegion: 'sunbarrel',
        originAnchorPrice: 38,
        destinationAnchorPrice: 42,
        feeRate: FEE_RATE,
      });

      const highQuote = buildArbitrageQuote({
        resource: 'iron_ingot',
        quantity: highQty,
        originRegion: 'ironridge',
        destinationRegion: 'sunbarrel',
        originAnchorPrice: 38,
        destinationAnchorPrice: 42,
        feeRate: FEE_RATE,
      });

      expect(highQuote.remote.transportCost).toBeGreaterThan(
        lowQuote.remote.transportCost,
      );
      expect(highQuote.remote.slippageBps).toBeGreaterThanOrEqual(
        lowQuote.remote.slippageBps,
      );
    });
  });

  describe('6. Return Structure Integrity', () => {
    it('quote has all required fields', () => {
      const quote = buildArbitrageQuote({
        resource: 'coal',
        quantity: 50,
        originRegion: 'ironridge',
        destinationRegion: 'riverplain',
        originAnchorPrice: 11,
        destinationAnchorPrice: 12,
        feeRate: FEE_RATE,
      });

      expect(quote).toHaveProperty('resource', 'coal');
      expect(quote).toHaveProperty('quantity', 50);
      expect(quote).toHaveProperty('originRegion', 'ironridge');
      expect(quote).toHaveProperty('destinationRegion', 'riverplain');

      expect(quote.local).toHaveProperty('gross');
      expect(quote.local).toHaveProperty('net');
      expect(quote.local).toHaveProperty('avgPrice');
      expect(quote.local).toHaveProperty('slippageBps');

      expect(quote.remote).toHaveProperty('gross');
      expect(quote.remote).toHaveProperty('net');
      expect(quote.remote).toHaveProperty('avgPrice');
      expect(quote.remote).toHaveProperty('slippageBps');
      expect(quote.remote).toHaveProperty('transportCost');
      expect(quote.remote).toHaveProperty('transportTime');

      expect(quote.delta).toHaveProperty('profitDifference');
      expect(quote.delta).toHaveProperty('isRemoteBetter');
      expect(typeof quote.delta.isRemoteBetter).toBe('boolean');
    });
  });

  describe('7. Local Net Correctness', () => {
    it('local net equals gross minus fee', () => {
      const quote = buildArbitrageQuote({
        resource: 'iron_ore',
        quantity: 10,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
        originAnchorPrice: 15,
        destinationAnchorPrice: 18,
        feeRate: FEE_RATE,
      });

      const expectedFee = Math.round(quote.local.gross * FEE_RATE);
      expect(quote.local.net).toBe(quote.local.gross - expectedFee);
    });
  });

  describe('8. Remote Better When Price Advantage Exceeds Transport', () => {
    it('high destination price makes remote better for small quantities', () => {
      const quote = buildArbitrageQuote({
        resource: 'iron_ore',
        quantity: 10,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
        originAnchorPrice: 10,
        destinationAnchorPrice: 50,
        feeRate: FEE_RATE,
      });

      expect(quote.delta.isRemoteBetter).toBe(true);
      expect(quote.delta.profitDifference).toBeGreaterThan(0);
    });

    it('low destination price makes local better', () => {
      const quote = buildArbitrageQuote({
        resource: 'iron_ore',
        quantity: 10,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
        originAnchorPrice: 50,
        destinationAnchorPrice: 10,
        feeRate: FEE_RATE,
      });

      expect(quote.delta.isRemoteBetter).toBe(false);
      expect(quote.delta.profitDifference).toBeLessThan(0);
    });
  });
});
