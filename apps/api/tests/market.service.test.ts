import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  buyResource,
  createMarketOrder,
  getMarketSnapshot,
  sellResource,
} from '../src/modules/market/market.service';

function createAppMock(options?: {
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
    resources: {
      base_price: number;
      tradable: boolean;
    } | null;
  }>;
  orderRows?: Array<{
    id: string;
    resource_id: 'iron_ore' | 'iron_ingot' | 'coal' | 'wood' | 'crude_oil' | 'sand' | 'water' | 'crops';
    side: 'buy' | 'sell';
    price_per_unit: number;
    quantity: number;
    remaining_quantity: number;
    status: 'open' | 'filled' | 'cancelled';
    created_at: string;
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
  rpcError?: string | null;
  buyRpcError?: string | null;
  orderRpcError?: string | null;
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
      location_id: 'location-primary',
      resource_id: 'iron_ore' as const,
      quantity: 48,
      resources: {
        base_price: 18,
        tradable: true,
      },
    },
  ];
  const orderRows = options?.orderRows ?? [
    {
      id: 'order-open-1',
      resource_id: 'iron_ore' as const,
      side: 'buy' as const,
      price_per_unit: 15,
      quantity: 10,
      remaining_quantity: 10,
      status: 'open' as const,
      created_at: '2026-03-17T18:00:00.000Z',
    },
  ];
  const orderBookRows = options?.orderBookRows ?? orderRows;

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
            const inventoryQuery = {
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              gt: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnValue({
                returns: vi.fn().mockResolvedValue({
                  data: inventoryRows,
                  error: null,
                }),
              }),
            };

            return {
              select: vi.fn().mockReturnValue(inventoryQuery),
            };
          }

          if (table === 'player_locations') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    returns: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: 'location-primary',
                          key: 'primary_storage',
                          name_key: 'locations.primary_storage.name',
                        },
                        {
                          id: 'location-remote',
                          key: 'remote_storage',
                          name_key: 'locations.remote_storage.name',
                        },
                      ],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }

          if (table === 'resources') {
            let selectedResourceId: 'coal' | 'iron_ore' = 'coal';
            const resourceQuery = {
              eq: vi.fn((column: string, value: string) => {
                if (column === 'id' && (value === 'coal' || value === 'iron_ore')) {
                  selectedResourceId = value;
                }

                return resourceQuery;
              }),
              maybeSingle: vi.fn().mockImplementation(() =>
                Promise.resolve({
                  data:
                    selectedResourceId === 'iron_ore'
                      ? {
                          id: 'iron_ore',
                          base_price: 18,
                          tradable: true,
                        }
                      : {
                          id: 'coal',
                          base_price: 12,
                          tradable: true,
                        },
                  error: null,
                }),
              ),
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
            };

            return {
              select: vi.fn().mockReturnValue(resourceQuery),
            };
          }

          if (table === 'market_orders') {
            let selectedStatus: 'open' | 'filled' | 'cancelled' | null = null;

            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn((column: string, value: string) => {
                  if (column === 'player_id') {
                    return {
                      order: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          returns: vi.fn().mockResolvedValue({
                            data: orderRows,
                            error: null,
                          }),
                        }),
                      }),
                    };
                  }

                  if (column === 'status' && (value === 'open' || value === 'filled' || value === 'cancelled')) {
                    selectedStatus = value;

                    return {
                      gt: vi.fn().mockImplementation((gtColumn: string, minimumValue: number) => ({
                        returns: vi.fn().mockResolvedValue({
                          data: orderBookRows.filter(
                            (entry) =>
                              entry.status === selectedStatus &&
                              (gtColumn !== 'remaining_quantity' ||
                                entry.remaining_quantity > minimumValue),
                          ),
                          error: null,
                        }),
                      })),
                    };
                  }

                  throw new Error(`Unexpected market_orders filter ${column}`);
                }),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
        rpc: vi.fn().mockImplementation((fn: string, payload?: Record<string, unknown>) => {
          if (fn === 'create_market_limit_order') {
            if (options?.orderRpcError) {
              return Promise.resolve({
                data: null,
                error: {
                  message: options.orderRpcError,
                },
              });
            }

            return Promise.resolve({
              data: [
                {
                  order_id: 'limit-order-123',
                  resource_id: 'iron_ore',
                  side: 'buy',
                  price_per_unit: 15,
                  quantity: 10,
                  remaining_quantity: 0,
                  status: 'filled',
                  player_credits: 2350,
                  inventory_quantity: 58,
                  matched_order_id: 'sell-order-321',
                  trade_id: 'trade-123',
                  created_at: '2026-03-17T18:00:00.000Z',
                },
              ],
              error: null,
            });
          }

          if (fn === 'buy_market_resource_at_location') {
            if (options?.buyRpcError) {
              return Promise.resolve({
                data: null,
                error: {
                  message: options.buyRpcError,
                },
              });
            }

            return Promise.resolve({
              data: payload
                ? [
                    {
                      order_id: 'buy-order-123',
                      price_per_unit: Number(payload.p_price_per_unit),
                      total_cost: Number(payload.p_price_per_unit) * Number(payload.p_quantity),
                      inventory_quantity: Number(payload.p_quantity),
                      player_credits:
                        2500 - Number(payload.p_price_per_unit) * Number(payload.p_quantity),
                      location_id: 'location-primary',
                      market_context_key: 'region_anchor',
                    },
                  ]
                : [
                    {
                      order_id: 'buy-order-123',
                      price_per_unit: 13,
                      total_cost: 130,
                      inventory_quantity: 10,
                      player_credits: 2370,
                      location_id: 'location-primary',
                      market_context_key: 'region_anchor',
                    },
                  ],
              error: null,
            });
          }

          if (fn === 'sell_inventory_resource_at_location') {
            if (!payload) {
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
                          price_per_unit: 15,
                          gross_amount: 150,
                          fee_amount: 3,
                          net_amount: 147,
                          inventory_quantity: 38,
                          player_credits: 2647,
                          location_id: 'location-primary',
                          market_context_key: 'region_anchor',
                        },
                      ],
                      error: null,
                    },
              );
            }

            const quantity = Number(payload.p_quantity);
            const price = Number(payload.p_price_per_unit);
            const grossAmount = price * quantity;
            const feeAmount = Math.round(grossAmount * Number(payload.p_fee_rate ?? 0));

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
                        price_per_unit: price,
                        gross_amount: grossAmount,
                        fee_amount: feeAmount,
                        net_amount: grossAmount - feeAmount,
                        inventory_quantity: 48 - quantity,
                        player_credits: 2500 + grossAmount - feeAmount,
                        location_id: 'location-primary',
                        market_context_key: 'region_anchor',
                      },
                    ],
                    error: null,
                  },
            );
          }

          throw new Error(`Unexpected rpc ${fn}`);
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
      contexts: [
        {
          key: 'region_anchor',
          labelKey: 'regions.ironridge.name',
          descriptionKey: 'market.contextDescriptions.region_anchor',
          locationId: 'location-primary',
          locationNameKey: 'locations.primary_storage.name',
          focusResourceId: 'iron_ore',
        },
        {
          key: 'trade_hub',
          labelKey: 'dashboard.network.tradeHubTitle',
          descriptionKey: 'market.contextDescriptions.trade_hub',
          locationId: 'location-remote',
          locationNameKey: 'locations.remote_storage.name',
          focusResourceId: 'iron_ingot',
        },
      ],
      marketFeeRate: 0.02,
      offers: [
        {
          resourceId: 'coal',
          basePrice: 12,
          contextPrices: [
            {
              contextKey: 'region_anchor',
              price: 13,
              modifierPercent: 0.08,
              bookComparison: {
                referencePrice: null,
                deltaAbsolute: null,
                deltaPercent: null,
                relation: 'unavailable',
              },
            },
            {
              contextKey: 'trade_hub',
              price: 13,
              modifierPercent: 0.08,
              bookComparison: {
                referencePrice: null,
                deltaAbsolute: null,
                deltaPercent: null,
                relation: 'unavailable',
              },
            },
          ],
          topOfBook: {
            bestBid: null,
            bestAsk: null,
          },
        },
        {
          resourceId: 'iron_ore',
          basePrice: 18,
          contextPrices: [
            {
              contextKey: 'region_anchor',
              price: 16,
              modifierPercent: -0.11,
              bookComparison: {
                referencePrice: null,
                deltaAbsolute: null,
                deltaPercent: null,
                relation: 'unavailable',
              },
            },
            {
              contextKey: 'trade_hub',
              price: 20,
              modifierPercent: 0.11,
              bookComparison: {
                referencePrice: null,
                deltaAbsolute: null,
                deltaPercent: null,
                relation: 'unavailable',
              },
            },
          ],
          topOfBook: {
            bestBid: 15,
            bestAsk: null,
          },
        },
      ],
      inventory: [
        {
          resourceId: 'iron_ore',
          quantity: 48,
          basePrice: 18,
          effectivePrice: 15,
          grossValue: 720,
          feeAmount: 14,
          netValue: 706,
          marketContextKey: 'region_anchor',
          locationId: 'location-primary',
          locationNameKey: 'locations.primary_storage.name',
          bookComparison: {
            referencePrice: 15,
            deltaAbsolute: 0,
            deltaPercent: 0,
            relation: 'equal',
          },
        },
      ],
      orders: [
        {
          id: 'order-open-1',
          resourceId: 'iron_ore',
          side: 'buy',
          pricePerUnit: 15,
          quantity: 10,
          remainingQuantity: 10,
          status: 'open',
          createdAt: '2026-03-17T18:00:00.000Z',
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
      marketContextKey: 'region_anchor',
    });

    expect(result).toEqual({
      playerCredits: 2647,
      resourceId: 'iron_ore',
      quantitySold: 10,
      inventoryQuantity: 38,
      pricePerUnit: 15,
      grossAmount: 150,
      feeAmount: 3,
      netAmount: 147,
      orderId: 'order-123',
      marketContextKey: 'region_anchor',
      locationId: 'location-primary',
    });
  });

  it('buys inventory through the market rpc', async () => {
    const { app } = createAppMock();

    const result = await buyResource(app, {
      playerId: 'player-123',
      resourceId: 'coal',
      quantity: 10,
      marketContextKey: 'region_anchor',
    });

    expect(result).toEqual({
      playerCredits: 2370,
      resourceId: 'coal',
      quantityPurchased: 10,
      inventoryQuantity: 10,
      pricePerUnit: 13,
      totalCost: 130,
      orderId: 'buy-order-123',
      marketContextKey: 'region_anchor',
      locationId: 'location-primary',
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
        marketContextKey: 'region_anchor',
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
        marketContextKey: 'region_anchor',
      }),
    ).rejects.toThrow('Not enough credits to buy resource.');
  });

  it('creates and immediately matches a limit order through the market rpc', async () => {
    const { app } = createAppMock();

    const result = await createMarketOrder(app, {
      playerId: 'player-123',
      resourceId: 'iron_ore',
      side: 'buy',
      price: 15,
      quantity: 10,
    });

    expect(result).toEqual({
      orderId: 'limit-order-123',
      resourceId: 'iron_ore',
      side: 'buy',
      pricePerUnit: 15,
      quantity: 10,
      remainingQuantity: 0,
      status: 'filled',
      playerCredits: 2350,
      inventoryQuantity: 58,
      matchedOrderId: 'sell-order-321',
      tradeId: 'trade-123',
      createdAt: '2026-03-17T18:00:00.000Z',
    });
  });

  it('surfaces limit order validation errors', async () => {
    const { app } = createAppMock({
      orderRpcError: 'Not enough credits to place buy order.',
    });

    await expect(
      createMarketOrder(app, {
        playerId: 'player-123',
        resourceId: 'iron_ore',
        side: 'buy',
        price: 15,
        quantity: 10,
      }),
    ).rejects.toThrow('Not enough credits to place buy order.');
  });

  it('keeps instant trade quotes valid when no player orders exist', async () => {
    const { app } = createAppMock({
      orderRows: [],
      orderBookRows: [],
    });

    const result = await getMarketSnapshot(app, 'player-123');

    expect(result.orders).toEqual([]);
    expect(result.offers[0]?.contextPrices[0]?.price).toBe(13);
    expect(result.offers[0]?.topOfBook).toEqual({
      bestBid: null,
      bestAsk: null,
    });
    expect(result.offers[0]?.contextPrices[0]?.bookComparison).toEqual({
      referencePrice: null,
      deltaAbsolute: null,
      deltaPercent: null,
      relation: 'unavailable',
    });
    expect(result.inventory[0]?.bookComparison).toEqual({
      referencePrice: null,
      deltaAbsolute: null,
      deltaPercent: null,
      relation: 'unavailable',
    });
    expect(result.inventory[0]?.effectivePrice).toBe(15);
  });

  it('computes top-of-book from open orders across both sides', async () => {
    const { app } = createAppMock({
      orderBookRows: [
        {
          id: 'buy-1',
          resource_id: 'coal',
          side: 'buy',
          price_per_unit: 10,
          quantity: 5,
          remaining_quantity: 5,
          status: 'open',
          created_at: '2026-03-17T18:00:00.000Z',
        },
        {
          id: 'buy-2',
          resource_id: 'coal',
          side: 'buy',
          price_per_unit: 12,
          quantity: 5,
          remaining_quantity: 5,
          status: 'open',
          created_at: '2026-03-17T19:00:00.000Z',
        },
        {
          id: 'sell-1',
          resource_id: 'coal',
          side: 'sell',
          price_per_unit: 15,
          quantity: 4,
          remaining_quantity: 4,
          status: 'open',
          created_at: '2026-03-17T18:30:00.000Z',
        },
        {
          id: 'sell-2',
          resource_id: 'coal',
          side: 'sell',
          price_per_unit: 14,
          quantity: 3,
          remaining_quantity: 3,
          status: 'open',
          created_at: '2026-03-17T19:30:00.000Z',
        },
      ],
    });

    const result = await getMarketSnapshot(app, 'player-123');
    const coalOffer = result.offers.find((entry) => entry.resourceId === 'coal');

    expect(coalOffer?.topOfBook).toEqual({
      bestBid: 12,
      bestAsk: 14,
    });
    expect(coalOffer?.contextPrices[0]?.bookComparison).toEqual({
      referencePrice: 14,
      deltaAbsolute: 1,
      deltaPercent: 0.07,
      relation: 'better',
    });
  });

  it('ignores non-open and zero-remaining orders in top-of-book', async () => {
    const { app } = createAppMock({
      orderBookRows: [
        {
          id: 'buy-filled',
          resource_id: 'iron_ore',
          side: 'buy',
          price_per_unit: 50,
          quantity: 4,
          remaining_quantity: 0,
          status: 'filled',
          created_at: '2026-03-17T18:00:00.000Z',
        },
        {
          id: 'sell-cancelled',
          resource_id: 'iron_ore',
          side: 'sell',
          price_per_unit: 3,
          quantity: 4,
          remaining_quantity: 4,
          status: 'cancelled',
          created_at: '2026-03-17T18:30:00.000Z',
        },
        {
          id: 'buy-open-zero-remaining',
          resource_id: 'iron_ore',
          side: 'buy',
          price_per_unit: 22,
          quantity: 4,
          remaining_quantity: 0,
          status: 'open',
          created_at: '2026-03-17T19:00:00.000Z',
        },
      ],
    });

    const result = await getMarketSnapshot(app, 'player-123');
    const ironOreOffer = result.offers.find((entry) => entry.resourceId === 'iron_ore');

    expect(ironOreOffer?.topOfBook).toEqual({
      bestBid: null,
      bestAsk: null,
    });
    expect(ironOreOffer?.contextPrices[0]?.bookComparison?.relation).toBe('unavailable');
    expect(result.inventory[0]?.bookComparison?.relation).toBe('unavailable');
  });

  it('returns top-of-book for single-sided books', async () => {
    const { app } = createAppMock({
      orderBookRows: [
        {
          id: 'sell-open-1',
          resource_id: 'iron_ore',
          side: 'sell',
          price_per_unit: 18,
          quantity: 2,
          remaining_quantity: 2,
          status: 'open',
          created_at: '2026-03-17T18:00:00.000Z',
        },
        {
          id: 'sell-open-2',
          resource_id: 'iron_ore',
          side: 'sell',
          price_per_unit: 17,
          quantity: 2,
          remaining_quantity: 2,
          status: 'open',
          created_at: '2026-03-17T18:30:00.000Z',
        },
      ],
    });

    const result = await getMarketSnapshot(app, 'player-123');
    const ironOreOffer = result.offers.find((entry) => entry.resourceId === 'iron_ore');

    expect(ironOreOffer?.topOfBook).toEqual({
      bestBid: null,
      bestAsk: 17,
    });
    expect(ironOreOffer?.contextPrices[0]?.bookComparison).toEqual({
      referencePrice: 17,
      deltaAbsolute: 1,
      deltaPercent: 0.06,
      relation: 'better',
    });
    expect(ironOreOffer?.contextPrices[1]?.bookComparison).toEqual({
      referencePrice: 17,
      deltaAbsolute: 3,
      deltaPercent: 0.18,
      relation: 'worse',
    });
  });

  it('marks instant buy as worse when quote is above best ask', async () => {
    const { app } = createAppMock({
      orderBookRows: [
        {
          id: 'sell-coal-1',
          resource_id: 'coal',
          side: 'sell',
          price_per_unit: 12,
          quantity: 5,
          remaining_quantity: 5,
          status: 'open',
          created_at: '2026-03-17T18:00:00.000Z',
        },
      ],
    });

    const result = await getMarketSnapshot(app, 'player-123');
    const coalOffer = result.offers.find((entry) => entry.resourceId === 'coal');

    expect(coalOffer?.contextPrices[0]?.bookComparison).toEqual({
      referencePrice: 12,
      deltaAbsolute: 1,
      deltaPercent: 0.08,
      relation: 'worse',
    });
  });

  it('marks quick-sell as worse when quote is below best bid', async () => {
    const { app } = createAppMock({
      orderBookRows: [
        {
          id: 'buy-iron-1',
          resource_id: 'iron_ore',
          side: 'buy',
          price_per_unit: 18,
          quantity: 5,
          remaining_quantity: 5,
          status: 'open',
          created_at: '2026-03-17T18:00:00.000Z',
        },
      ],
    });

    const result = await getMarketSnapshot(app, 'player-123');

    expect(result.inventory[0]?.bookComparison).toEqual({
      referencePrice: 18,
      deltaAbsolute: 3,
      deltaPercent: 0.17,
      relation: 'worse',
    });
  });
});
