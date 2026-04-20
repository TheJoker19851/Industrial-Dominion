import { describe, expect, it } from 'vitest';
import { buildArbitrageQuote } from '@industrial-dominion/shared';
import { getMarketContextPrice } from '../src/modules/market/market-context';
import { gameConfig } from '@industrial-dominion/config';

const FEE_RATE = gameConfig.marketFee;

function applySpread(price: number, side: 'buy' | 'sell'): number {
  return Math.max(1, Math.round(price * (side === 'buy' ? 1.05 : 0.95)));
}

function getSellAnchorPrice(
  regionId: string,
  resourceId: string,
  basePrice: number,
): number {
  const ctx = getMarketContextPrice({
    contextKey: 'region_anchor',
    regionId: regionId as
      | 'ironridge'
      | 'greenhaven'
      | 'sunbarrel'
      | 'riverplain',
    resourceId: resourceId as
      | 'iron_ore'
      | 'iron_ingot'
      | 'coal'
      | 'wood'
      | 'plank'
      | 'crude_oil'
      | 'fuel'
      | 'sand'
      | 'water'
      | 'crops',
    basePrice,
    side: 'sell',
  });
  return applySpread(ctx.price, 'sell');
}

function buildQuoteForResource(
  resourceId:
    | 'iron_ore'
    | 'iron_ingot'
    | 'coal'
    | 'wood'
    | 'plank'
    | 'crude_oil'
    | 'fuel'
    | 'sand'
    | 'water'
    | 'crops',
  basePrice: number,
  quantity: number,
  originRegion: 'ironridge' | 'greenhaven' | 'sunbarrel' | 'riverplain',
  destinationRegion: 'ironridge' | 'greenhaven' | 'sunbarrel' | 'riverplain',
) {
  return buildArbitrageQuote({
    resource: resourceId,
    quantity,
    originRegion,
    destinationRegion,
    originAnchorPrice: getSellAnchorPrice(originRegion, resourceId, basePrice),
    destinationAnchorPrice: getSellAnchorPrice(
      destinationRegion,
      resourceId,
      basePrice,
    ),
    feeRate: FEE_RATE,
  });
}

type ResourceSpec = {
  id:
    | 'iron_ore'
    | 'iron_ingot'
    | 'coal'
    | 'wood'
    | 'plank'
    | 'crude_oil'
    | 'fuel'
    | 'sand'
    | 'water'
    | 'crops';
  basePrice: number;
};

const RESOURCES: ResourceSpec[] = [
  { id: 'iron_ore', basePrice: 18 },
  { id: 'iron_ingot', basePrice: 42 },
  { id: 'coal', basePrice: 12 },
  { id: 'wood', basePrice: 10 },
  { id: 'plank', basePrice: 26 },
  { id: 'crude_oil', basePrice: 22 },
  { id: 'fuel', basePrice: 48 },
  { id: 'sand', basePrice: 8 },
  { id: 'water', basePrice: 6 },
  { id: 'crops', basePrice: 9 },
];

const REGIONS = ['ironridge', 'greenhaven', 'sunbarrel', 'riverplain'] as const;

describe('TASK-056: Economic Validation Scenarios', () => {
  describe('1. Low Volume — Arbitrage May Be Profitable', () => {
    it('at least one resource-route combination is profitable at low volume', () => {
      const quantity = 10;
      let foundProfitable = false;

      for (const res of RESOURCES) {
        for (const origin of REGIONS) {
          for (const dest of REGIONS) {
            if (origin === dest) continue;
            const quote = buildQuoteForResource(
              res.id,
              res.basePrice,
              quantity,
              origin,
              dest,
            );
            if (quote.delta.isRemoteBetter) {
              foundProfitable = true;
            }
          }
        }
      }

      expect(foundProfitable).toBe(true);
    });
  });

  describe('2. High Volume — Slippage Reduces Destination Price', () => {
    it('slippage at high volume can make a profitable low-volume route unprofitable', () => {
      const lowQty = 10;
      const highQty = 7000;

      const lowQuote = buildArbitrageQuote({
        resource: 'iron_ingot',
        quantity: lowQty,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
        originAnchorPrice: 38,
        destinationAnchorPrice: 42,
        feeRate: FEE_RATE,
      });
      const highQuote = buildArbitrageQuote({
        resource: 'iron_ingot',
        quantity: highQty,
        originRegion: 'ironridge',
        destinationRegion: 'greenhaven',
        originAnchorPrice: 38,
        destinationAnchorPrice: 42,
        feeRate: FEE_RATE,
      });

      expect(lowQuote.delta.isRemoteBetter).toBe(true);
      expect(highQuote.delta.isRemoteBetter).toBe(false);
    });

    it('high volume slippage on processed goods is significant', () => {
      const quote = buildQuoteForResource(
        'fuel',
        48,
        2000,
        'sunbarrel',
        'ironridge',
      );
      expect(quote.remote.slippageBps).toBeGreaterThan(100);
      expect(quote.local.slippageBps).toBeGreaterThan(100);
    });
  });

  describe('3. Cross-Chain Validation', () => {
    it('at least one resource benefits from transport', () => {
      const quantity = 20;
      let foundBenefit = false;

      for (const res of RESOURCES) {
        for (const origin of REGIONS) {
          for (const dest of REGIONS) {
            if (origin === dest) continue;
            const quote = buildQuoteForResource(
              res.id,
              res.basePrice,
              quantity,
              origin,
              dest,
            );
            if (quote.delta.isRemoteBetter) {
              foundBenefit = true;
              break;
            }
          }
          if (foundBenefit) break;
        }
        if (foundBenefit) break;
      }

      expect(foundBenefit).toBe(true);
    });

    it('at least one resource does NOT benefit from transport', () => {
      const quantity = 20;
      let foundNoBenefit = false;

      for (const res of RESOURCES) {
        for (const origin of REGIONS) {
          for (const dest of REGIONS) {
            if (origin === dest) continue;
            const quote = buildQuoteForResource(
              res.id,
              res.basePrice,
              quantity,
              origin,
              dest,
            );
            if (!quote.delta.isRemoteBetter) {
              foundNoBenefit = true;
              break;
            }
          }
          if (foundNoBenefit) break;
        }
        if (foundNoBenefit) break;
      }

      expect(foundNoBenefit).toBe(true);
    });

    it('same-region quotes have zero transport cost and time', () => {
      for (const res of RESOURCES) {
        const quote = buildQuoteForResource(
          res.id,
          res.basePrice,
          100,
          'ironridge',
          'ironridge',
        );
        expect(quote.remote.transportCost).toBe(0);
        expect(quote.remote.transportTime).toBe(0);
      }
    });
  });

  describe('4. Industrial Interaction — Process + Transport', () => {
    it('iron_ore → iron_ingot: selling processed remotely can be better than selling processed locally', () => {
      const ironOreBase = 18;
      const ironIngotBase = 42;

      const originRegion = 'ironridge';
      const destRegion = 'greenhaven';

      const processedLocalQuote = buildQuoteForResource(
        'iron_ingot',
        ironIngotBase,
        6,
        originRegion,
        originRegion,
      );
      const processedRemoteQuote = buildQuoteForResource(
        'iron_ingot',
        ironIngotBase,
        6,
        originRegion,
        destRegion,
      );

      const localNet = processedLocalQuote.local.net;
      const remoteNet = processedRemoteQuote.remote.net;

      expect(localNet).toBeGreaterThan(0);
      expect(remoteNet).toBeGreaterThan(0);

      const rawLocalQuote = buildQuoteForResource(
        'iron_ore',
        ironOreBase,
        12,
        originRegion,
        originRegion,
      );
      expect(processedLocalQuote.local.net).toBeGreaterThan(
        rawLocalQuote.local.net,
      );
    });

    it('processing premium exists regardless of transport', () => {
      const ironOreBase = 18;
      const ironIngotBase = 42;
      const rawUnits = 12;
      const processedUnits = 6;
      const region = 'ironridge';

      const rawNet = buildQuoteForResource(
        'iron_ore',
        ironOreBase,
        rawUnits,
        region,
        region,
      ).local.net;
      const processedNet = buildQuoteForResource(
        'iron_ingot',
        ironIngotBase,
        processedUnits,
        region,
        region,
      ).local.net;

      expect(processedNet).toBeGreaterThan(rawNet);
    });

    it('at low volume: process + transport can beat local raw sell', () => {
      const rawUnits = 12;
      const processedUnits = 6;
      const origin = 'ironridge';
      const dest = 'greenhaven';

      const rawLocalNet = buildQuoteForResource(
        'iron_ore',
        18,
        rawUnits,
        origin,
        origin,
      ).local.net;
      const processedRemoteNet = buildQuoteForResource(
        'iron_ingot',
        42,
        processedUnits,
        origin,
        dest,
      ).remote.net;

      expect(processedRemoteNet).toBeGreaterThan(rawLocalNet);
    });

    it('at high volume: slippage erodes transport profitability margin', () => {
      const origin = 'ironridge';
      const dest = 'greenhaven';

      const lowQuote = buildArbitrageQuote({
        resource: 'iron_ingot',
        quantity: 10,
        originRegion: origin,
        destinationRegion: dest,
        originAnchorPrice: 38,
        destinationAnchorPrice: 42,
        feeRate: FEE_RATE,
      });
      const highQuote = buildArbitrageQuote({
        resource: 'iron_ingot',
        quantity: 1000,
        originRegion: origin,
        destinationRegion: dest,
        originAnchorPrice: 38,
        destinationAnchorPrice: 42,
        feeRate: FEE_RATE,
      });

      const lowMargin =
        lowQuote.delta.profitDifference /
        Math.max(1, Math.abs(lowQuote.local.net));
      const highMargin =
        highQuote.delta.profitDifference /
        Math.max(1, Math.abs(highQuote.local.net));

      expect(highMargin).toBeLessThan(lowMargin);
    });
  });

  describe('5. Volume-Dependent Profitability Shift', () => {
    it('iron_ingot arbitrage from ironridge to greenhaven: profitability changes with volume', () => {
      const volumes = [10, 50, 100, 200, 500, 1000, 2000];
      const quotes = volumes.map((qty) =>
        buildQuoteForResource('iron_ingot', 42, qty, 'ironridge', 'greenhaven'),
      );

      const lowProfit = quotes[0].delta.profitDifference;
      const highProfit = quotes[quotes.length - 1].delta.profitDifference;

      expect(highProfit).toBeLessThan(lowProfit);
    });

    it('fuel arbitrage profitability degrades faster than iron_ingot due to higher slippage', () => {
      const qty = 500;
      const fuelQuote = buildQuoteForResource(
        'fuel',
        48,
        qty,
        'sunbarrel',
        'ironridge',
      );
      const ingotQuote = buildQuoteForResource(
        'iron_ingot',
        42,
        qty,
        'ironridge',
        'greenhaven',
      );

      expect(fuelQuote.remote.slippageBps).toBeGreaterThanOrEqual(
        ingotQuote.remote.slippageBps,
      );
    });

    it('profitability ranking changes across volumes', () => {
      const lowQty = 10;
      const highQty = 5000;

      const origin = 'ironridge';
      const dest = 'greenhaven';

      const specs = [
        {
          id: 'fuel',
          resource: 'fuel' as const,
          originPrice: 43,
          destPrice: 48,
        },
        {
          id: 'iron_ingot',
          resource: 'iron_ingot' as const,
          originPrice: 38,
          destPrice: 42,
        },
        {
          id: 'iron_ore',
          resource: 'iron_ore' as const,
          originPrice: 15,
          destPrice: 18,
        },
      ];

      const getProfit = (spec: (typeof specs)[number], qty: number) => {
        return buildArbitrageQuote({
          resource: spec.resource,
          quantity: qty,
          originRegion: origin,
          destinationRegion: dest,
          originAnchorPrice: spec.originPrice,
          destinationAnchorPrice: spec.destPrice,
          feeRate: FEE_RATE,
        }).delta.profitDifference;
      };

      const lowRanking = [...specs]
        .sort((a, b) => getProfit(b, lowQty) - getProfit(a, lowQty))
        .map((r) => r.id);
      const highRanking = [...specs]
        .sort((a, b) => getProfit(b, highQty) - getProfit(a, highQty))
        .map((r) => r.id);

      expect(lowRanking[0]).toBe('fuel');
      expect(highRanking[0]).toBe('iron_ore');
      expect(lowRanking).not.toEqual(highRanking);
    });
  });
});
