import { describe, expect, it } from 'vitest';
import { getMarketSnapshot } from '../src/modules/market/market.service';
import { getMarketContextPrice } from '../src/modules/market/market-context';
import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

function createValidationMock(options: {
  playerRegionId?: string;
  orderBookRows?: Array<{
    id: string;
    resource_id: string;
    side: 'buy' | 'sell';
    price_per_unit: number;
    quantity: number;
    remaining_quantity: number;
    status: string;
    created_at: string;
  }>;
}) {
  const player = {
    id: 'player-validator',
    locale: 'en' as const,
    credits: 5000,
    region_id: (options.playerRegionId ?? 'ironridge') as 'ironridge',
  };

  const orderBookRows = options.orderBookRows ?? [];

  return {
    app: {
      getSupabaseAdminClient: () => ({
        from: (table: string) => {
          if (table === 'players') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: player, error: null }),
                }),
              }),
            };
          }
          if (table === 'inventories') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockReturnThis(),
                gt: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnValue({
                  returns: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            };
          }
          if (table === 'player_locations') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    returns: vi.fn().mockResolvedValue({
                      data: [
                        { id: 'loc-primary', key: 'primary_storage', name_key: 'locations.primary_storage.name' },
                        { id: 'loc-remote', key: 'remote_storage', name_key: 'locations.remote_storage.name' },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === 'resources') {
            const resources = [
              { id: 'iron_ore', base_price: 18, tradable: true },
              { id: 'coal', base_price: 12, tradable: true },
              { id: 'wood', base_price: 10, tradable: true },
              { id: 'crude_oil', base_price: 22, tradable: true },
              { id: 'sand', base_price: 8, tradable: true },
              { id: 'water', base_price: 6, tradable: true },
              { id: 'crops', base_price: 9, tradable: true },
            ];
            let selectedId = '';
            const q: Record<string, any> = {
              eq: vi.fn((col: string, val: string) => {
                if (col === 'id') selectedId = val;
                if (col === 'tradable') return { order: vi.fn().mockReturnValue({ returns: vi.fn().mockResolvedValue({ data: resources, error: null }) }) };
                return q;
              }),
              maybeSingle: vi.fn().mockImplementation(() => {
                const r = resources.find((r) => r.id === selectedId);
                return Promise.resolve({ data: r ?? null, error: null });
              }),
              order: vi.fn().mockReturnValue({
                returns: vi.fn().mockResolvedValue({ data: resources, error: null }),
              }),
            };
            return { select: vi.fn().mockReturnValue(q) };
          }
          if (table === 'market_orders') {
            let selectedStatus: string | null = null;
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn((col: string, val: string) => {
                  if (col === 'player_id') {
                    return { order: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ returns: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) };
                  }
                  if (col === 'status') {
                    selectedStatus = val;
                    return {
                      gt: vi.fn().mockImplementation((gtCol: string, gtVal: number) => ({
                        returns: vi.fn().mockResolvedValue({
                          data: orderBookRows.filter(
                            (o: any) => o.status === selectedStatus && (gtCol !== 'remaining_quantity' || o.remaining_quantity > gtVal),
                          ),
                          error: null,
                        }),
                      })),
                    };
                  }
                  throw new Error(`Unexpected market_orders filter ${col}=${val}`);
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as unknown as FastifyInstance,
  };
}

describe('TASK-049: Market Decision Validation', () => {
  describe('Scenario 1: Instant Buy vs Limit Order (Buy Side)', () => {
    it('instant buy price exceeds best ask — player can get a better deal via limit order', async () => {
      const { app } = createValidationMock({
        playerRegionId: 'ironridge',
        orderBookRows: [
          {
            id: 'sell-coal-1',
            resource_id: 'coal',
            side: 'sell',
            price_per_unit: 11,
            quantity: 10,
            remaining_quantity: 10,
            status: 'open',
            created_at: '2026-04-12T10:00:00.000Z',
          },
        ],
      });

      const snapshot = await getMarketSnapshot(app, 'player-validator');
      const coalOffer = snapshot.offers.find((o) => o.resourceId === 'coal');

      expect(coalOffer).toBeDefined();
      const regionAnchorPrice = coalOffer!.contextPrices.find((c) => c.contextKey === 'region_anchor');
      expect(regionAnchorPrice).toBeDefined();

      const instantBuyPrice = regionAnchorPrice!.price;
      const bestAsk = coalOffer!.topOfBook.bestAsk;

      expect(bestAsk).toBe(11);
      expect(instantBuyPrice).toBeGreaterThan(bestAsk!);

      const delta = instantBuyPrice - bestAsk!;
      const deltaPercent = delta / bestAsk!;

      expect(delta).toBeGreaterThanOrEqual(1);
      expect(deltaPercent).toBeGreaterThanOrEqual(0.05);

      expect(regionAnchorPrice!.bookComparison.relation).toBe('worse');
      expect(regionAnchorPrice!.bookComparison.referencePrice).toBe(11);
      expect(regionAnchorPrice!.bookComparison.deltaAbsolute).toBe(delta);
    });
  });

  describe('Scenario 2: Quick Sell vs Best Bid', () => {
    it('quick sell price is below best bid — player can get a better deal via limit sell', async () => {
      const { app } = createValidationMock({
        playerRegionId: 'ironridge',
        orderBookRows: [
          {
            id: 'buy-iron-1',
            resource_id: 'iron_ore',
            side: 'buy',
            price_per_unit: 17,
            quantity: 10,
            remaining_quantity: 10,
            status: 'open',
            created_at: '2026-04-12T10:00:00.000Z',
          },
        ],
      });

      const snapshot = await getMarketSnapshot(app, 'player-validator');
      const ironOffer = snapshot.offers.find((o) => o.resourceId === 'iron_ore');

      expect(ironOffer).toBeDefined();

      const regionAnchorPrice = ironOffer!.contextPrices.find((c) => c.contextKey === 'region_anchor');
      const instantBuyAtAnchor = regionAnchorPrice!.price;

      const sellContextPrice = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'ironridge',
        resourceId: 'iron_ore',
        basePrice: 18,
        side: 'sell',
      });
      const quickSellPrice = Math.max(1, Math.round(sellContextPrice.price * 0.95));

      const bestBid = ironOffer!.topOfBook.bestBid;
      expect(bestBid).toBe(17);

      expect(quickSellPrice).toBeLessThan(bestBid!);

      const delta = bestBid! - quickSellPrice;
      const deltaPercent = delta / bestBid!;

      expect(delta).toBeGreaterThanOrEqual(1);
      expect(deltaPercent).toBeGreaterThanOrEqual(0.05);
    });
  });

  describe('Scenario 3: Cross-Context Comparison', () => {
    it('same resource has meaningful price difference across contexts', async () => {
      const { app } = createValidationMock({
        playerRegionId: 'ironridge',
        orderBookRows: [],
      });

      const snapshot = await getMarketSnapshot(app, 'player-validator');
      const ironOffer = snapshot.offers.find((o) => o.resourceId === 'iron_ore');
      const coalOffer = snapshot.offers.find((o) => o.resourceId === 'coal');

      expect(ironOffer).toBeDefined();

      const ironAnchor = ironOffer!.contextPrices.find((c) => c.contextKey === 'region_anchor')!;
      const ironHub = ironOffer!.contextPrices.find((c) => c.contextKey === 'trade_hub')!;

      expect(ironAnchor.price).not.toBe(ironHub.price);
      const ironDelta = Math.abs(ironAnchor.price - ironHub.price);
      const ironDeltaPct = ironDelta / Math.min(ironAnchor.price, ironHub.price);
      expect(ironDeltaPct).toBeGreaterThanOrEqual(0.15);

      expect(coalOffer).toBeDefined();
      const coalAnchor = coalOffer!.contextPrices.find((c) => c.contextKey === 'region_anchor')!;
      const coalHub = coalOffer!.contextPrices.find((c) => c.contextKey === 'trade_hub')!;
      const coalDelta = Math.abs(coalAnchor.price - coalHub.price);
      expect(coalDelta).toBe(0);
    });
  });

  describe('Scenario 4: Decision Quality Check', () => {
    it('premium resources (coal, wood, crude_oil) have meaningful instant spread', () => {
      const premiumResources = [
        { id: 'coal' as const, basePrice: 12 },
        { id: 'wood' as const, basePrice: 10 },
        { id: 'crude_oil' as const, basePrice: 22 },
      ];

      for (const res of premiumResources) {
        const buyContext = getMarketContextPrice({
          contextKey: 'region_anchor',
          regionId: 'ironridge',
          resourceId: res.id,
          basePrice: res.basePrice,
          side: 'buy',
        });
        const sellContext = getMarketContextPrice({
          contextKey: 'region_anchor',
          regionId: 'ironridge',
          resourceId: res.id,
          basePrice: res.basePrice,
          side: 'sell',
        });

        const instantBuy = Math.max(1, Math.round(buyContext.price * 1.05));
        const instantSell = Math.max(1, Math.round(sellContext.price * 0.95));

        const spread = instantBuy - instantSell;
        const midPrice = (instantBuy + instantSell) / 2;
        const spreadPct = spread / midPrice;

        expect(spread).toBeGreaterThanOrEqual(1);
        expect(spreadPct).toBeGreaterThanOrEqual(0.05);
      }
    });

    it('cheap resources (water, sand, crops) have zero spread due to rounding', () => {
      const cheapResources = [
        { id: 'water' as const, basePrice: 6 },
        { id: 'sand' as const, basePrice: 8 },
        { id: 'crops' as const, basePrice: 9 },
      ];

      for (const res of cheapResources) {
        const buyContext = getMarketContextPrice({
          contextKey: 'region_anchor',
          regionId: 'ironridge',
          resourceId: res.id,
          basePrice: res.basePrice,
          side: 'buy',
        });
        const sellContext = getMarketContextPrice({
          contextKey: 'region_anchor',
          regionId: 'ironridge',
          resourceId: res.id,
          basePrice: res.basePrice,
          side: 'sell',
        });

        const instantBuy = Math.max(1, Math.round(buyContext.price * 1.05));
        const instantSell = Math.max(1, Math.round(sellContext.price * 0.95));

        expect(instantBuy).toBe(instantSell);
      }
    });

    it('player using limit order on coal can beat instant trade', () => {
      const buyCtx = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'ironridge',
        resourceId: 'coal',
        basePrice: 12,
        side: 'buy',
      });
      const sellCtx = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'ironridge',
        resourceId: 'coal',
        basePrice: 12,
        side: 'sell',
      });

      const instantBuy = Math.max(1, Math.round(buyCtx.price * 1.05));
      const instantSell = Math.max(1, Math.round(sellCtx.price * 0.95));

      const midPrice = Math.round((instantBuy + instantSell) / 2);

      expect(midPrice).toBeLessThan(instantBuy);
      expect(midPrice).toBeGreaterThan(instantSell);

      const buyerSavings = instantBuy - midPrice;
      const sellerGain = midPrice - instantSell;

      expect(buyerSavings).toBeGreaterThanOrEqual(1);
      expect(sellerGain).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Scenario 5: Static vs Dynamic Check', () => {
    it('context modifiers produce prices different from base price for focus resources', () => {
      const focusCheck = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'ironridge',
        resourceId: 'iron_ore',
        basePrice: 18,
        side: 'buy',
      });

      expect(focusCheck.price).not.toBe(18);
      expect(focusCheck.modifierPercent).toBe(-0.15);

      const hubCheck = getMarketContextPrice({
        contextKey: 'trade_hub',
        regionId: 'ironridge',
        resourceId: 'iron_ore',
        basePrice: 18,
        side: 'sell',
      });

      expect(hubCheck.price).not.toBe(18);
      expect(hubCheck.modifierPercent).toBe(0.05);
    });

    it('instant spread adds further variation beyond context alone', () => {
      const ctx = getMarketContextPrice({
        contextKey: 'region_anchor',
        regionId: 'ironridge',
        resourceId: 'iron_ore',
        basePrice: 18,
        side: 'buy',
      });

      const withSpread = Math.max(1, Math.round(ctx.price * 1.05));

      expect(withSpread).not.toBe(ctx.price);
      expect(withSpread).toBeGreaterThan(ctx.price);
    });

    it('order book is entirely player-driven (not derived from base prices)', async () => {
      const { app } = createValidationMock({
        playerRegionId: 'ironridge',
        orderBookRows: [
          { id: 'b1', resource_id: 'iron_ore', side: 'buy', price_per_unit: 5, quantity: 10, remaining_quantity: 10, status: 'open', created_at: '2026-04-12T10:00:00.000Z' },
          { id: 's1', resource_id: 'iron_ore', side: 'sell', price_per_unit: 100, quantity: 10, remaining_quantity: 10, status: 'open', created_at: '2026-04-12T10:00:00.000Z' },
        ],
      });

      const snapshot = await getMarketSnapshot(app, 'player-validator');
      const ironOffer = snapshot.offers.find((o) => o.resourceId === 'iron_ore');

      expect(ironOffer!.topOfBook.bestBid).toBe(5);
      expect(ironOffer!.topOfBook.bestAsk).toBe(100);
    });
  });
});
