import { describe, expect, it } from 'vitest';
import { getMarketSnapshot, buyResource, sellResource } from '../src/modules/market/market.service';
import { calculateSlippageQuote } from '@industrial-dominion/shared';
import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';

function createSlippageMock(options?: {
  player?: {
    id: string;
    locale: 'en' | 'fr';
    credits: number;
    region_id: 'ironridge' | 'greenhaven' | 'sunbarrel' | 'riverplain' | null;
  } | null;
  inventoryRows?: Array<{
    player_id: string;
    location_id: string;
    resource_id: 'iron_ore' | 'iron_ingot' | 'coal' | 'wood' | 'crude_oil' | 'sand' | 'water' | 'crops';
    quantity: number;
    resources: { base_price: number; tradable: boolean } | null;
  }>;
  orderBookRows?: Array<{
    id: string;
    resource_id: 'iron_ore' | 'iron_ingot' | 'coal' | 'wood' | 'crude_oil' | 'sand' | 'water' | 'crops';
    side: 'buy' | 'sell';
    price_per_unit: number;
    quantity: number;
    remaining_quantity: number;
    status: 'open' | 'filled' | 'cancelled';
    created_at: string;
  }>;
}) {
  const player = options?.player ?? {
    id: 'player-slippage',
    locale: 'en' as const,
    credits: 10000,
    region_id: 'ironridge' as const,
  };

  const inventoryRows = options?.inventoryRows ?? [];
  const orderBookRows = options?.orderBookRows ?? [];

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
            const q = {
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnValue({
                returns: vi.fn().mockResolvedValue({ data: inventoryRows, error: null }),
              }),
            };
            return { select: vi.fn().mockReturnValue(q) };
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
              { id: 'iron_ingot', base_price: 42, tradable: true },
              { id: 'coal', base_price: 12, tradable: true },
            ];
            let selectedId = '';
            const q: Record<string, (...args: unknown[]) => unknown> = {
              eq: vi.fn((col: string, val: string) => {
                if (col === 'id') selectedId = val;
                if (col === 'tradable')
                  return {
                    order: vi.fn().mockReturnValue({
                      returns: vi.fn().mockResolvedValue({ data: resources, error: null }),
                    }),
                  };
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
                    return {
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          returns: vi.fn().mockResolvedValue({ data: [], error: null }),
                        }),
                      }),
                    };
                  }
                  if (col === 'status') {
                    selectedStatus = val;
                    return {
                      gt: vi.fn().mockImplementation(() => ({
                        returns: vi.fn().mockResolvedValue({
                          data: orderBookRows.filter(
                            (o: { status: string; remaining_quantity: number }) =>
                              o.status === selectedStatus &&
                              o.remaining_quantity > 0,
                          ),
                          error: null,
                        }),
                      })),
                    };
                  }
                  throw new Error(`Unexpected market_orders filter ${col}`);
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
        rpc: vi.fn().mockImplementation((fn: string, payload?: Record<string, unknown>) => {
          if (fn === 'buy_market_resource_at_location') {
            const price = Number(payload?.p_price_per_unit ?? 13);
            const qty = Number(payload?.p_quantity ?? 10);
            return Promise.resolve({
              data: [
                {
                  order_id: 'buy-order-slippage',
                  price_per_unit: price,
                  total_cost: price * qty,
                  inventory_quantity: qty,
                  player_credits: 10000 - price * qty,
                  location_id: 'loc-primary',
                  market_context_key: 'region_anchor',
                },
              ],
              error: null,
            });
          }
          if (fn === 'sell_inventory_resource_at_location') {
            const price = Number(payload?.p_price_per_unit ?? 15);
            const qty = Number(payload?.p_quantity ?? 10);
            const gross = price * qty;
            const feeRate = Number(payload?.p_fee_rate ?? 0.02);
            const fee = Math.round(gross * feeRate);
            return Promise.resolve({
              data: [
                {
                  order_id: 'sell-order-slippage',
                  price_per_unit: price,
                  gross_amount: gross,
                  fee_amount: fee,
                  net_amount: gross - fee,
                  inventory_quantity: 0,
                  player_credits: 10000 + gross - fee,
                  location_id: 'loc-primary',
                  market_context_key: 'region_anchor',
                },
              ],
              error: null,
            });
          }
          throw new Error(`Unexpected rpc ${fn}`);
        }),
      }),
    } as unknown as FastifyInstance,
  };
}

describe('TASK-055: Market Slippage Integration', () => {
  describe('1. Snapshot Inventory with Slippage', () => {
    it('small inventory (within depth) has no slippage field', async () => {
      const { app } = createSlippageMock({
        inventoryRows: [
          {
            player_id: 'player-slippage',
            location_id: 'loc-primary',
            resource_id: 'iron_ore',
            quantity: 10,
            resources: { base_price: 18, tradable: true },
          },
        ],
      });

      const snapshot = await getMarketSnapshot(app, 'player-slippage');
      expect(snapshot.inventory).toHaveLength(1);
      expect(snapshot.inventory[0]?.slippage).toBeUndefined();
      expect(snapshot.inventory[0]?.effectivePrice).toBe(15);
    });

    it('large inventory (beyond depth) includes slippage', async () => {
      const { app } = createSlippageMock({
        inventoryRows: [
          {
            player_id: 'player-slippage',
            location_id: 'loc-primary',
            resource_id: 'iron_ingot',
            quantity: 200,
            resources: { base_price: 42, tradable: true },
          },
        ],
      });

      const snapshot = await getMarketSnapshot(app, 'player-slippage');
      expect(snapshot.inventory).toHaveLength(1);
      const item = snapshot.inventory[0]!;

      expect(item.slippage).toBeDefined();
      expect(item.slippage!.side).toBe('sell');
      expect(item.slippage!.effectiveAvgPrice).toBeLessThan(item.slippage!.anchorPrice);
      expect(item.slippage!.slippageBps).toBeGreaterThan(0);
      expect(item.slippage!.slippagePercent).toBeGreaterThan(0);
      expect(item.slippage!.anchorPrice).toBe(item.effectivePrice);
    });
  });

  describe('2. Buy with Slippage', () => {
    it('small buy (within depth) has no slippage', async () => {
      const { app } = createSlippageMock();

      const result = await buyResource(app, {
        playerId: 'player-slippage',
        resourceId: 'iron_ore',
        quantity: 10,
        marketContextKey: 'region_anchor',
      });

      expect(result.slippage).toBeUndefined();
    });

    it('large buy (beyond depth) includes slippage', async () => {
      const { app } = createSlippageMock();

      const result = await buyResource(app, {
        playerId: 'player-slippage',
        resourceId: 'iron_ore',
        quantity: 200,
        marketContextKey: 'region_anchor',
      });

      expect(result.slippage).toBeDefined();
      expect(result.slippage!.side).toBe('buy');
      expect(result.slippage!.effectiveAvgPrice).toBeGreaterThan(result.slippage!.anchorPrice);
      expect(result.slippage!.slippageBps).toBeGreaterThan(0);
    });

    it('buy slippage increases total cost', async () => {
      const { app } = createSlippageMock();

      const result = await buyResource(app, {
        playerId: 'player-slippage',
        resourceId: 'iron_ingot',
        quantity: 200,
        marketContextKey: 'region_anchor',
      });

      expect(result.slippage).toBeDefined();
      const anchorTotal = result.slippage!.anchorPrice * 200;
      expect(result.totalCost).toBeGreaterThan(anchorTotal);
    });
  });

  describe('3. Sell with Slippage', () => {
    it('small sell (within depth) has no slippage', async () => {
      const { app } = createSlippageMock();

      const result = await sellResource(app, {
        playerId: 'player-slippage',
        resourceId: 'iron_ore',
        quantity: 10,
        marketContextKey: 'region_anchor',
      });

      expect(result.slippage).toBeUndefined();
    });

    it('large sell (beyond depth) includes slippage', async () => {
      const { app } = createSlippageMock();

      const result = await sellResource(app, {
        playerId: 'player-slippage',
        resourceId: 'iron_ingot',
        quantity: 200,
        marketContextKey: 'region_anchor',
      });

      expect(result.slippage).toBeDefined();
      expect(result.slippage!.side).toBe('sell');
      expect(result.slippage!.effectiveAvgPrice).toBeLessThan(result.slippage!.anchorPrice);
      expect(result.slippage!.slippageBps).toBeGreaterThan(0);
    });

    it('sell slippage reduces gross amount', async () => {
      const { app } = createSlippageMock();

      const result = await sellResource(app, {
        playerId: 'player-slippage',
        resourceId: 'iron_ingot',
        quantity: 200,
        marketContextKey: 'region_anchor',
      });

      expect(result.slippage).toBeDefined();
      const anchorTotal = result.slippage!.anchorPrice * 200;
      expect(result.grossAmount).toBeLessThan(anchorTotal);
    });
  });

  describe('4. Slippage Quote Consistency', () => {
    it('snapshot slippage matches direct calculation', async () => {
      const quantity = 150;
      const { app } = createSlippageMock({
        inventoryRows: [
          {
            player_id: 'player-slippage',
            location_id: 'loc-primary',
            resource_id: 'iron_ingot',
            quantity,
            resources: { base_price: 42, tradable: true },
          },
        ],
      });

      const snapshot = await getMarketSnapshot(app, 'player-slippage');
      const item = snapshot.inventory[0]!;
      expect(item.slippage).toBeDefined();

      const direct = calculateSlippageQuote({
        anchorPrice: item.effectivePrice,
        quantity,
        side: 'sell',
        resourceId: 'iron_ingot',
      });

      expect(item.slippage).toEqual(direct);
    });
  });

  describe('5. Resource-Specific Depth Behavior', () => {
    it('plank hits slippage earlier than iron_ingot at same quantity', () => {
      const plankQuote = calculateSlippageQuote({
        anchorPrice: 26,
        quantity: 50,
        side: 'sell',
        resourceId: 'plank',
      });
      const ingotQuote = calculateSlippageQuote({
        anchorPrice: 42,
        quantity: 50,
        side: 'sell',
        resourceId: 'iron_ingot',
      });

      expect(plankQuote.slippageBps).toBeGreaterThan(ingotQuote.slippageBps);
    });

    it('fuel hits slippage earliest among processed goods', () => {
      const fuel = calculateSlippageQuote({
        anchorPrice: 48,
        quantity: 30,
        side: 'sell',
        resourceId: 'fuel',
      });
      const ingot = calculateSlippageQuote({
        anchorPrice: 42,
        quantity: 30,
        side: 'sell',
        resourceId: 'iron_ingot',
      });
      const plank = calculateSlippageQuote({
        anchorPrice: 26,
        quantity: 30,
        side: 'sell',
        resourceId: 'plank',
      });

      expect(fuel.slippageBps).toBeGreaterThan(ingot.slippageBps);
      expect(fuel.slippageBps).toBeGreaterThan(plank.slippageBps);
    });
  });
});
