import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import * as supabaseClient from '../src/db/client/supabase';

const appsToClose: ReturnType<typeof buildApp>[] = [];

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

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(appsToClose.splice(0).map((app) => app.close()));
});

describe('buildApp', () => {
  function createAdminClientMock() {
    const tutorialState = {
      player_id: 'user-123',
      tutorial_id: 'starter_loop',
      completed_step_ids: ['welcome', 'place_extractor', 'claim_production'],
      inventory_viewed_at: null,
      skipped_at: null,
      completed_at: null,
    };
    const buildingRow = {
      id: 'building-123',
      player_id: 'user-123',
      region_id: 'ironridge',
      building_type_id: 'ironridge_iron_extractor',
      level: 1,
      created_at: '2026-03-15T10:00:00.000Z',
    };
    const inventoryRows = [
      {
        player_id: 'user-123',
        resource_id: 'iron_ore',
        quantity: 48,
        resources: {
          base_price: 18,
          tradable: true,
        },
      },
    ];
    const offerRows = [
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
    ];
    const ledgerRows = [
      {
        id: 'ledger-2',
        action_type: 'market_sell',
        amount: 176,
        resource_id: 'iron_ore',
        created_at: '2026-03-15T13:00:00.000Z',
        metadata: {
          quantitySold: 10,
        },
      },
      {
        id: 'ledger-1',
        action_type: 'claim_production',
        amount: 48,
        resource_id: 'iron_ore',
        created_at: '2026-03-15T12:45:00.000Z',
        metadata: {
          hoursClaimed: 2,
        },
      },
    ];
    const newsRows = [
      {
        id: 'news-2',
        headline_key: 'news.system.market.headline',
        body_key: 'news.system.market.body',
        scope: 'system',
        created_at: '2026-03-15T13:30:00.000Z',
      },
      {
        id: 'news-1',
        headline_key: 'news.system.startup.headline',
        body_key: 'news.system.startup.body',
        scope: 'system',
        created_at: '2026-03-15T12:30:00.000Z',
      },
    ];

    const playersTable = {
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValueOnce({
              data: { id: 'user-123', locale: 'en', credits: 2500, region_id: 'ironridge' },
              error: null,
            })
            .mockResolvedValue({
              data: { id: 'user-123', locale: 'en', credits: 2500, region_id: 'ironridge' },
              error: null,
            }),
        }),
      })),
    };

    const buildingsInsert = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: buildingRow.id,
            player_id: buildingRow.player_id,
            region_id: buildingRow.region_id,
            building_type_id: buildingRow.building_type_id,
            level: buildingRow.level,
          },
          error: null,
        }),
      }),
    };

    const buildingsTable = {
      select: vi.fn((fields: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          const result = {
            count: 0,
            error: null,
            eq: vi.fn().mockReturnThis(),
          };

          return result;
        }

        if (fields.includes('created_at')) {
          const buildingQuery = {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: buildingRow,
              error: null,
            }),
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: buildingRow,
                  error: null,
                }),
              }),
            }),
          };

          return {
            ...buildingQuery,
          };
        }

        return buildingsInsert;
      }),
      insert: vi.fn().mockReturnValue(buildingsInsert),
    };

    const productionJobsInsert = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'job-123',
            started_at: '2026-03-15T10:00:00.000Z',
            completes_at: '2026-03-15T12:00:00.000Z',
            claimed_at: '2026-03-15T12:45:00.000Z',
          },
          error: null,
        }),
      }),
    };

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-123',
              email: 'operator@industrialdominion.com',
            },
          },
          error: null,
        }),
      },
      rpc: vi.fn().mockImplementation((fn: string, payload: Record<string, unknown>) => {
        if (fn === 'buy_market_resource') {
          if (payload.p_quantity === 999) {
            return Promise.resolve({
              data: null,
              error: {
                message: 'Not enough credits to buy resource.',
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

        if (fn !== 'sell_inventory_resource') {
          throw new Error(`Unexpected rpc ${fn}`);
        }

        if (payload.p_quantity === 999) {
          return Promise.resolve({
            data: null,
            error: {
              message: 'Not enough inventory to sell.',
            },
          });
        }

        return Promise.resolve({
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
        });
      }),
      from: (table: string) => {
        if (table === 'players') {
          return playersTable;
        }

        if (table === 'buildings') {
          return buildingsTable;
        }

        if (table === 'production_jobs') {
          const extractionQuery = createMaybeSingleQuery(null);
          const transformQuery = createMaybeSingleQuery(null);

          return {
            select: vi.fn((fields: string) =>
              fields.includes('output_resource_id') ? transformQuery : extractionQuery,
            ),
            insert: vi.fn().mockReturnValue(productionJobsInsert),
          };
        }

        if (table === 'inventories') {
          return {
            select: vi.fn((fields: string) => {
              if (fields === 'quantity') {
                return createMaybeSingleQuery({
                  quantity: inventoryRows[0]?.quantity ?? 0,
                });
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
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        if (table === 'resources') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  returns: vi.fn().mockResolvedValue({
                    data: offerRows,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (table === 'ledger_entries') {
          return {
            select: vi.fn((fields: string, options?: { count?: string; head?: boolean }) => {
              if (options?.head) {
                const result = {
                  count: 0,
                  error: null,
                  eq: vi.fn((column: string, value: string) => {
                    if (column === 'action_type') {
                      if (value === 'starter_grant') {
                        result.count = 1;
                      }

                      if (value === 'claim_production') {
                        result.count = 1;
                      }

                      if (value === 'market_sell') {
                        result.count = 1;
                      }
                    }

                    return result;
                  }),
                };

                return result;
              }

              return {
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
              };
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        if (table === 'player_tutorial_progress') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: tutorialState,
                  error: null,
                }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: tutorialState,
                  error: null,
                }),
              }),
            }),
            update: vi.fn((patch: Record<string, unknown>) => {
              Object.assign(tutorialState, patch);

              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: tutorialState,
                      error: null,
                    }),
                  }),
                }),
              };
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
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAdminClient>;
  }

  it('serves the root status payload', async () => {
    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      name: 'industrial-dominion-api',
      status: 'ok',
    });
  });

  it('serves the health endpoint', async () => {
    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'api',
    });
  });

  it('rejects protected auth routes without a bearer token', async () => {
    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({ method: 'GET', url: '/auth/session' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'Unauthorized',
      message: 'Missing bearer token.',
    });
  });

  it('returns the authenticated user for a valid bearer token', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: 'user-123',
        email: 'operator@industrialdominion.com',
      },
    });
  });

  it('places the first extractor for a bootstrapped player', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/buildings/first-extractor',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        buildingTypeId: 'ironridge_iron_extractor',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      building: {
        id: 'building-123',
        playerId: 'user-123',
        regionId: 'ironridge',
        buildingTypeId: 'ironridge_iron_extractor',
        level: 1,
      },
      extractor: {
        id: 'ironridge_iron_extractor',
        nameKey: 'buildingTypes.ironridge_iron_extractor.name',
        descriptionKey: 'buildingTypes.ironridge_iron_extractor.description',
        category: 'extraction',
        outputResourceId: 'iron_ore',
        baseOutputPerHour: 24,
        baseMaintenancePerHour: 8,
        baseEnergyUsePerMinute: 2,
        allowedRegionIds: ['ironridge'],
      },
    });
  });

  it('returns the dashboard snapshot for an authenticated player', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:45:00.000Z'));
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      player: {
        id: 'user-123',
        locale: 'en',
        credits: 2500,
        regionId: 'ironridge',
      },
      inventory: [
        {
          playerId: 'user-123',
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
          id: 'ledger-2',
          actionType: 'market_sell',
          amount: 176,
          resourceId: 'iron_ore',
          createdAt: '2026-03-15T13:00:00.000Z',
          metadata: {
            quantitySold: 10,
          },
        },
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
          id: 'news-2',
          headlineKey: 'news.system.market.headline',
          bodyKey: 'news.system.market.body',
          scope: 'system',
          createdAt: '2026-03-15T13:30:00.000Z',
        },
        {
          id: 'news-1',
          headlineKey: 'news.system.startup.headline',
          bodyKey: 'news.system.startup.body',
          scope: 'system',
          createdAt: '2026-03-15T12:30:00.000Z',
        },
      ],
    });
  });

  it('returns the system news feed for an authenticated player', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/news?limit=2',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          id: 'news-2',
          headlineKey: 'news.system.market.headline',
          bodyKey: 'news.system.market.body',
          scope: 'system',
          createdAt: '2026-03-15T13:30:00.000Z',
        },
        {
          id: 'news-1',
          headlineKey: 'news.system.startup.headline',
          bodyKey: 'news.system.startup.body',
          scope: 'system',
          createdAt: '2026-03-15T12:30:00.000Z',
        },
      ],
    });
  });

  it('returns the ledger feed for an authenticated player', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/ledger?limit=2',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      entries: [
        {
          id: 'ledger-2',
          actionType: 'market_sell',
          amount: 176,
          resourceId: 'iron_ore',
          createdAt: '2026-03-15T13:00:00.000Z',
          metadata: {
            quantitySold: 10,
          },
        },
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
    });
  });

  it('returns the market snapshot for an authenticated player', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/market',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      player: {
        id: 'user-123',
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

  it('buys a resource from the market', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/market/buy',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        resourceId: 'coal',
        quantity: 10,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      playerCredits: 2380,
      resourceId: 'coal',
      quantityPurchased: 10,
      inventoryQuantity: 10,
      pricePerUnit: 12,
      totalCost: 120,
      orderId: 'buy-order-123',
    });
  });

  it('returns the starter tutorial state for an authenticated player', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/tutorial',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tutorialId: 'starter_loop',
      currentStepId: 'view_inventory',
      currentStepIndex: 4,
      totalSteps: 6,
      isSkipped: false,
      isCompleted: false,
      completedStepIds: ['welcome', 'place_extractor', 'claim_production'],
    });
  });

  it('supports skipping the starter tutorial', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/tutorial/skip',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      tutorialId: 'starter_loop',
      isSkipped: true,
    });
  });

  it('sells a resource from market inventory', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/market/sell',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        resourceId: 'iron_ore',
        quantity: 10,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
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

  it('claims completed production for a placed starter extractor', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T12:45:00.000Z'));
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock(),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/buildings/building-123/claim-production',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      building: {
        id: 'building-123',
        playerId: 'user-123',
        regionId: 'ironridge',
        buildingTypeId: 'ironridge_iron_extractor',
        level: 1,
      },
      extractor: {
        id: 'ironridge_iron_extractor',
        nameKey: 'buildingTypes.ironridge_iron_extractor.name',
        descriptionKey: 'buildingTypes.ironridge_iron_extractor.description',
        category: 'extraction',
        outputResourceId: 'iron_ore',
        baseOutputPerHour: 24,
        baseMaintenancePerHour: 8,
        baseEnergyUsePerMinute: 2,
        allowedRegionIds: ['ironridge'],
      },
      claimedQuantity: 48,
      inventory: {
        resourceId: 'iron_ore',
        quantity: 96,
      },
      productionJob: {
        id: 'job-123',
        startedAt: '2026-03-15T10:00:00.000Z',
        completesAt: '2026-03-15T12:00:00.000Z',
        claimedAt: '2026-03-15T12:45:00.000Z',
      },
    });
  });
});
