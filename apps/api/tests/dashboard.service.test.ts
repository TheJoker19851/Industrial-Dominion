import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getDashboardSnapshot } from '../src/modules/dashboard/dashboard.service';

function createMaybeSingleQuery<T>(data: T | null) {
  const query = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data,
      error: null,
    }),
  };

  return query;
}

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
  }>;
  building?: {
    id: string;
    building_type_id: string;
    level: number;
    created_at: string;
  } | null;
  latestJob?: {
    completes_at: string;
  } | null;
  transformJobRows?: Array<{
    id: string;
    completes_at: string;
    recipe_id: string | null;
    output_resource_id?: 'iron_ingot' | null;
    output_amount?: number | null;
  }>;
  ledgerRows?: Array<{
    id: string;
    action_type:
      | 'starter_grant'
      | 'build'
      | 'upgrade'
      | 'production_transform_started'
      | 'production_completed'
      | 'claim_production'
      | 'market_sell'
      | 'market_fee'
      | 'maintenance';
    amount: number;
    resource_id:
      | 'iron_ore'
      | 'iron_ingot'
      | 'coal'
      | 'wood'
      | 'crude_oil'
      | 'sand'
      | 'water'
      | 'crops'
      | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }>;
  newsRows?: Array<{
    id: string;
    headline_key: string;
    body_key: string;
    scope: 'system' | 'global' | 'regional' | 'corporation';
    created_at: string;
  }>;
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
    },
  ];
  const building =
    options && 'building' in options
      ? options.building
      : {
          id: 'building-123',
          building_type_id: 'ironridge_iron_extractor',
          level: 1,
          created_at: '2026-03-15T10:00:00.000Z',
        };
  const latestJob =
    options && 'latestJob' in options ? options.latestJob : null;
  const transformJobRows = options?.transformJobRows ?? [];
  const ledgerRows = options?.ledgerRows ?? [
    {
      id: 'ledger-1',
      action_type: 'claim_production' as const,
      amount: 48,
      resource_id: 'iron_ore' as const,
      created_at: '2026-03-15T12:45:00.000Z',
      metadata: {
        hoursClaimed: 2,
      },
    },
  ];
  const newsRows = options?.newsRows ?? [
    {
      id: 'news-1',
      headline_key: 'news.system.startup.headline',
      body_key: 'news.system.startup.body',
      scope: 'system' as const,
      created_at: '2026-03-15T13:30:00.000Z',
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
              select: vi.fn((fields: string) => {
                if (fields === 'quantity') {
                  return createMaybeSingleQuery(
                    inventoryRows[0]
                      ? {
                          quantity: inventoryRows[0].quantity,
                        }
                      : null,
                  );
                }

                return {
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
                };
              }),
            };
          }

          if (table === 'buildings') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({
                        data: building,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }

          if (table === 'production_jobs') {
            const extractionQuery = createMaybeSingleQuery(latestJob);
            const transformQuery = createMaybeSingleQuery(transformJobRows[0] ?? null);

            return {
              select: vi.fn((fields: string) =>
                fields.includes('output_resource_id') ? transformQuery : extractionQuery,
              ),
            };
          }

          if (table === 'ledger_entries') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      returns: vi.fn().mockResolvedValue({
                        data: ledgerRows,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }

          if (table === 'news_items') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      returns: vi.fn().mockResolvedValue({
                        data: newsRows,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
      }),
    } as unknown as FastifyInstance,
  };
}

describe('dashboard service', () => {
  it('returns player, extractor, and inventory data for the dashboard', async () => {
    const { app } = createAppMock();

    const result = await getDashboardSnapshot(app, {
      playerId: 'player-123',
      now: new Date('2026-03-15T12:45:00.000Z'),
    });

    expect(result).toEqual({
      player: {
        id: 'player-123',
        locale: 'en',
        credits: 2500,
        regionId: 'ironridge',
      },
      inventory: [
        {
          playerId: 'player-123',
          resourceId: 'iron_ore',
          quantity: 48,
        },
      ],
      extractor: {
        buildingId: 'building-123',
        buildingTypeId: 'ironridge_iron_extractor',
        level: 1,
        outputResourceId: 'iron_ore',
        outputPerHour: 24,
        claimableQuantity: 48,
        readyToClaim: true,
        nextClaimAt: '2026-03-15T13:00:00.000Z',
      },
      transformRecipes: [
        {
          recipeId: 'ironridge_iron_ingot_batch',
          buildingId: 'building-123',
          nameKey: 'transforms.ironridge_iron_ingot_batch.name',
          descriptionKey: 'transforms.ironridge_iron_ingot_batch.description',
          inputResourceId: 'iron_ore',
          inputAmount: 12,
          outputResourceId: 'iron_ingot',
          outputAmount: 6,
          durationSeconds: 3600,
          canStart: true,
          missingInputAmount: 0,
          activeJob: null,
        },
      ],
      ledger: [
        {
          id: 'ledger-1',
          actionType: 'claim_production',
          amount: 48,
          resourceId: 'iron_ore',
          createdAt: '2026-03-15T12:45:00.000Z',
          metadata: {
            hoursClaimed: 2,
          },
        },
      ],
      news: [
        {
          id: 'news-1',
          headlineKey: 'news.system.startup.headline',
          bodyKey: 'news.system.startup.body',
          scope: 'system',
          createdAt: '2026-03-15T13:30:00.000Z',
        },
      ],
    });
  });

  it('returns a safe empty dashboard when the player has not bootstrapped yet', async () => {
    const { app } = createAppMock({
      player: null,
      inventoryRows: [],
      building: null,
      ledgerRows: [],
    });

    const result = await getDashboardSnapshot(app, {
      playerId: 'player-123',
      now: new Date('2026-03-15T10:30:00.000Z'),
    });

    expect(result).toEqual({
      player: null,
      inventory: [],
      extractor: null,
      transformRecipes: [],
      ledger: [],
      news: [
        {
          id: 'news-1',
          headlineKey: 'news.system.startup.headline',
          bodyKey: 'news.system.startup.body',
          scope: 'system',
          createdAt: '2026-03-15T13:30:00.000Z',
        },
      ],
    });
  });

  it('returns active transform job state when a batch is already running', async () => {
    const { app } = createAppMock({
      transformJobRows: [
        {
          id: 'transform-job-1',
          completes_at: '2026-03-15T13:30:00.000Z',
          recipe_id: 'ironridge_iron_ingot_batch',
          output_resource_id: 'iron_ingot',
          output_amount: 6,
        },
      ],
    });

    const result = await getDashboardSnapshot(app, {
      playerId: 'player-123',
      now: new Date('2026-03-15T13:45:00.000Z'),
    });

    expect(result.transformRecipes).toEqual([
      expect.objectContaining({
        recipeId: 'ironridge_iron_ingot_batch',
        canStart: false,
        missingInputAmount: 0,
        activeJob: {
          jobId: 'transform-job-1',
          recipeId: 'ironridge_iron_ingot_batch',
          buildingId: 'building-123',
          completesAt: '2026-03-15T13:30:00.000Z',
          readyToClaim: true,
        },
      }),
    ]);
  });
});
