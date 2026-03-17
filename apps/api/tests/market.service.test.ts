import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buyResource, getMarketSnapshot, sellResource } from '../src/modules/market/market.service';

function createAppMock(options?: {
  player?: {
    id: string;
    locale: 'en' | 'fr';
    credits: number;
    region_id: 'ironridge' | 'greenhaven' | 'sunbarrel' | 'riverplain' | null;
  } | null;
  inventoryRows?: Array<{
    player_id: string;
    resource_id: 'iron_ore' | 'coal' | 'wood' | 'crude_oil' | 'sand' | 'water' | 'crops';
    quantity: number;
    resources: {
      base_price: number;
      tradable: boolean;
    } | null;
  }>;
  rpcError?: string | null;
  buyRpcError?: string | null;
}) {
  const player =
    options && 'player' in options
      ? options.player
      : {
          id: 'player-123',
          locale: 'en' as const,
          credits: 2500,
          region_id: 'ironridge' as const,
        };
  const inventoryRows = options?.inventoryRows ?? [
    {
      player_id: 'player-123',
      resource_id: 'iron_ore' as const,
      quantity: 48,
      resources: {
        base_price: 18,
        tradable: true,
      },
    },
  ];

  return {
    app: {
      getSupabaseAdminClient: () => ({
        from: (table: string) => {
          if (table === 'players') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: player,
                    error: null,
                  }),
                }),
              }),
            };
          }

          if (table === 'inventories') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  gt: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      returns: vi.fn().mockResolvedValue({
                        data: inventoryRows,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }

          if (table === 'resources') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    returns: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'coal',
                          base_price: 12,
                          tradable: true,
                        },
                        {
                          id: 'iron_ore',
                          base_price: 18,
                          tradable: true,
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
        rpc: vi.fn().mockImplementation((fn: string) => {
          if (fn === 'buy_market_resource') {
            if (options?.buyRpcError) {
              return Promise.resolve({
                data: null,
                error: {
                  message: options.buyRpcError,
                },
              });
            }

            return Promise.resolve({
              data: [
                {
                  order_id: 'buy-order-123',
                  price_per_unit: 12,
                  total_cost: 120,
                  inventory_quantity: 10,
                  player_credits: 2380,
                },
              ],
              error: null,
            });
          }

          return Promise.resolve(
            options?.rpcError
              ? {
                  data: null,
                  error: {
                    message: options.rpcError,
                  },
                }
              : {
                  data: [
                    {
                      order_id: 'order-123',
                      price_per_unit: 18,
                      gross_amount: 180,
                      fee_amount: 4,
                      net_amount: 176,
                      inventory_quantity: 38,
                      player_credits: 2676,
                    },
                  ],
                  error: null,
                },
          );
        }),
      }),
    } as unknown as FastifyInstance,
  };
}

describe('market service', () => {
  it('returns tradable inventory with sell values', async () => {
    const { app } = createAppMock();

    const result = await getMarketSnapshot(app, 'player-123');

    expect(result).toEqual({
      player: {
        id: 'player-123',
        locale: 'en',
        credits: 2500,
        regionId: 'ironridge',
      },
      marketFeeRate: 0.02,
      offers: [
        {
          resourceId: 'coal',
          basePrice: 12,
        },
        {
          resourceId: 'iron_ore',
          basePrice: 18,
        },
      ],
      inventory: [
        {
          resourceId: 'iron_ore',
          quantity: 48,
          basePrice: 18,
          grossValue: 864,
          feeAmount: 17,
          netValue: 847,
        },
      ],
    });
  });

  it('sells inventory through the market rpc', async () => {
    const { app } = createAppMock();

    const result = await sellResource(app, {
      playerId: 'player-123',
      resourceId: 'iron_ore',
      quantity: 10,
    });

    expect(result).toEqual({
      playerCredits: 2676,
      resourceId: 'iron_ore',
      quantitySold: 10,
      inventoryQuantity: 38,
      pricePerUnit: 18,
      grossAmount: 180,
      feeAmount: 4,
      netAmount: 176,
      orderId: 'order-123',
    });
  });

  it('buys inventory through the market rpc', async () => {
    const { app } = createAppMock();

    const result = await buyResource(app, {
      playerId: 'player-123',
      resourceId: 'coal',
      quantity: 10,
    });

    expect(result).toEqual({
      playerCredits: 2380,
      resourceId: 'coal',
      quantityPurchased: 10,
      inventoryQuantity: 10,
      pricePerUnit: 12,
      totalCost: 120,
      orderId: 'buy-order-123',
    });
  });

  it('surfaces market rpc validation errors', async () => {
    const { app } = createAppMock({
      rpcError: 'Not enough inventory to sell.',
    });

    await expect(
      sellResource(app, {
        playerId: 'player-123',
        resourceId: 'iron_ore',
        quantity: 99,
      }),
    ).rejects.toThrow('Not enough inventory to sell.');
  });

  it('surfaces market buy validation errors', async () => {
    const { app } = createAppMock({
      buyRpcError: 'Not enough credits to buy resource.',
    });

    await expect(
      buyResource(app, {
        playerId: 'player-123',
        resourceId: 'coal',
        quantity: 999,
      }),
    ).rejects.toThrow('Not enough credits to buy resource.');
  });
});
