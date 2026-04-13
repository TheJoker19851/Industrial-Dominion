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
  function createAdminClientMock(options?: {
    starterExtractorCount?: number;
    starterProcessingInstallationCount?: number;
    dynamicStarterBuildingCounts?: boolean;
    seedInitialExtractor?: boolean;
  }) {
    const starterExtractorCount = options?.starterExtractorCount ?? 0;
    const starterProcessingInstallationCount =
      options?.starterProcessingInstallationCount ?? 0;
    const dynamicStarterBuildingCounts = options?.dynamicStarterBuildingCounts ?? false;
    const seedInitialExtractor = options?.seedInitialExtractor ?? true;
    const tutorialState = {
      player_id: 'user-123',
      tutorial_id: 'starter_loop',
      current_step: 'open_inventory',
      completed_step_ids: ['extract_resource', 'claim_resource'],
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
    const buildingRows = seedInitialExtractor ? [buildingRow] : [];
    const inventoryRows = [
      {
        player_id: 'user-123',
        location_id: 'location-primary',
        resource_id: 'iron_ore',
        quantity: 48,
        resources: {
          base_price: 18,
          tradable: true,
        },
      },
    ];
    const locationRows = [
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
    const orderRows = [
      {
        id: 'limit-order-open',
        resource_id: 'iron_ingot',
        side: 'sell',
        price_per_unit: 20,
        quantity: 5,
        remaining_quantity: 5,
        status: 'open',
        created_at: '2026-03-17T18:00:00.000Z',
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

    let lastInsertedBuildingTypeId = buildingRow.building_type_id;
    const buildingsInsert = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockImplementation(() =>
          Promise.resolve({
            data: {
              id:
                lastInsertedBuildingTypeId === 'starter_processing_installation'
                  ? 'building-processor-1'
                  : buildingRow.id,
              player_id: buildingRow.player_id,
              region_id: buildingRow.region_id,
              building_type_id: lastInsertedBuildingTypeId,
              level: buildingRow.level,
            },
            error: null,
          }),
        ),
      }),
    };

    const buildingsTable = {
      select: vi.fn((fields: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          const result = {
            count: 0,
            error: null,
            eq: vi.fn().mockReturnThis(),
            in: vi.fn((_column: string, values: string[]) => {
              const dynamicCount = buildingRows.filter((entry) =>
                values.includes(entry.building_type_id),
              ).length;
              const count = values.includes('starter_processing_installation')
                ? dynamicStarterBuildingCounts
                  ? dynamicCount
                  : starterProcessingInstallationCount
                : dynamicStarterBuildingCounts
                  ? dynamicCount
                  : starterExtractorCount;

              return Promise.resolve({
                count,
                error: null,
              });
            }),
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
                returns: vi.fn().mockResolvedValue({
                  data: buildingRows,
                  error: null,
                }),
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: buildingRows[0] ?? null,
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
      insert: vi.fn((payload: Record<string, unknown>) => {
        if (typeof payload.building_type_id === 'string') {
          lastInsertedBuildingTypeId = payload.building_type_id;

          if (!buildingRows.some((entry) => entry.building_type_id === payload.building_type_id)) {
            buildingRows.push({
              ...buildingRow,
              id:
                payload.building_type_id === 'starter_processing_installation'
                  ? 'building-processor-1'
                  : buildingRow.id,
              building_type_id: payload.building_type_id,
            });
          }
        }

        return buildingsInsert;
      }),
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
        if (fn === 'create_production_job') {
          if (payload.p_runs === 99) {
            return Promise.resolve({
              data: null,
              error: {
                message: 'Not enough input inventory to start production.',
              },
            });
          }

          return Promise.resolve({
            data: [
              {
                job_id: 'production-job-123',
                building_id: 'building-123',
                recipe_key: 'iron_ingot_from_iron_ore',
                runs: payload.p_runs,
                input_resource_id: 'iron_ore',
                input_amount: Number(payload.p_runs) * 2,
                input_inventory_quantity: 48 - Number(payload.p_runs) * 2,
                output_resource_id: 'iron_ingot',
                output_amount: Number(payload.p_runs),
                output_inventory_quantity: Number(payload.p_runs),
                completed_at: '2026-03-17T12:00:00.000Z',
              },
            ],
            error: null,
          });
        }

        if (fn === 'buy_market_resource_at_location') {
          if (payload.p_quantity === 999) {
            return Promise.resolve({
              data: null,
              error: {
                message: 'Not enough credits to buy resource.',
              },
            });
          }

          const quantity = Number(payload.p_quantity);
          const pricePerUnit = Number(payload.p_price_per_unit);
          const totalCost = quantity * pricePerUnit;

          return Promise.resolve({
            data: [
              {
                order_id: 'buy-order-123',
                price_per_unit: pricePerUnit,
                total_cost: totalCost,
                inventory_quantity: quantity,
                player_credits: 2500 - totalCost,
                location_id: 'location-primary',
                market_context_key: 'region_anchor',
              },
            ],
            error: null,
          });
        }

        if (fn === 'create_logistics_transfer') {
          if (payload.p_from_location_id === payload.p_to_location_id) {
            return Promise.resolve({
              data: null,
              error: {
                message: 'Transfer source and destination must be different.',
              },
            });
          }

          if (payload.p_quantity === 999) {
            return Promise.resolve({
              data: null,
              error: {
                message: 'Not enough inventory in the source location.',
              },
            });
          }

          return Promise.resolve({
            data: [
              {
                transfer_id: 'transfer-123',
                from_location_id: payload.p_from_location_id,
                to_location_id: payload.p_to_location_id,
                resource_id: payload.p_item_key,
                quantity: payload.p_quantity,
                from_inventory_quantity: 24,
                to_inventory_quantity: 24,
                created_at: '2026-03-17T15:00:00.000Z',
              },
            ],
            error: null,
          });
        }

        if (fn === 'create_market_limit_order') {
          if (payload.p_quantity === 999) {
            return Promise.resolve({
              data: null,
              error: {
                message: 'Not enough credits to place buy order.',
              },
            });
          }

          return Promise.resolve({
            data: [
              {
                order_id: 'limit-order-123',
                resource_id: payload.p_resource_id,
                side: payload.p_side,
                price_per_unit: payload.p_price_per_unit,
                quantity: payload.p_quantity,
                remaining_quantity: 0,
                status: 'filled',
                player_credits: 2350,
                inventory_quantity: 58,
                matched_order_id: 'matched-order-123',
                trade_id: 'trade-123',
                created_at: '2026-03-17T18:00:00.000Z',
              },
            ],
            error: null,
          });
        }

        if (fn !== 'sell_inventory_resource_at_location') {
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

        const quantity = Number(payload.p_quantity);
        const pricePerUnit = Number(payload.p_price_per_unit);
        const grossAmount = quantity * pricePerUnit;
        const feeAmount = Math.round(grossAmount * Number(payload.p_fee_rate ?? 0));

        return Promise.resolve({
          data: [
            {
              order_id: 'order-123',
              price_per_unit: pricePerUnit,
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

              return inventoryQuery;
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        if (table === 'resources') {
          let selectedResourceId = 'coal';
          const resourceQuery = {
            eq: vi.fn((column: string, value: string) => {
              if (column === 'id') {
                selectedResourceId = value;
              }

              return resourceQuery;
            }),
            maybeSingle: vi.fn().mockImplementation(() =>
              Promise.resolve({
                data: offerRows.find((entry) => entry.id === selectedResourceId) ?? null,
                error: null,
              }),
            ),
            order: vi.fn().mockReturnValue({
              returns: vi.fn().mockResolvedValue({
                data: offerRows,
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
                        data: orderRows.filter(
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

                      if (value === 'market_purchase') {
                        result.count = 0;
                      }

                      if (value === 'production_completed') {
                        result.count = 0;
                      }

                      if (value === 'logistics_transfer_out') {
                        result.count = 0;
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

        if (table === 'player_locations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  returns: vi.fn().mockResolvedValue({
                    data: locationRows,
                    error: null,
                  }),
                }),
              }),
            }),
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

  it('places the first starter processing installation for a player with an extractor', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock({
        starterExtractorCount: 1,
        starterProcessingInstallationCount: 0,
      }),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/buildings/first-processing-installation',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        buildingTypeId: 'starter_processing_installation',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      building: {
        id: 'building-processor-1',
        playerId: 'user-123',
        regionId: 'ironridge',
        buildingTypeId: 'starter_processing_installation',
        level: 1,
      },
      processingInstallation: {
        id: 'starter_processing_installation',
        nameKey: 'buildingTypes.starter_processing_installation.name',
        descriptionKey: 'buildingTypes.starter_processing_installation.description',
        category: 'processing',
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
      processingInstallation: null,
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
          canStart: false,
          missingInputAmount: 0,
          activeJob: null,
        },
      ],
      logisticsLocations: [
        {
          locationId: 'location-primary',
          key: 'primary_storage',
          nameKey: 'locations.primary_storage.name',
          inventory: [
            {
              resourceId: 'iron_ore',
              quantity: 48,
            },
          ],
        },
        {
          locationId: 'location-remote',
          key: 'remote_storage',
          nameKey: 'locations.remote_storage.name',
          inventory: [],
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
            bestBid: null,
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
            referencePrice: null,
            deltaAbsolute: null,
            deltaPercent: null,
            relation: 'unavailable',
          },
        },
      ],
      orders: [
        {
          id: 'limit-order-open',
          resourceId: 'iron_ingot',
          side: 'sell',
          pricePerUnit: 20,
          quantity: 5,
          remainingQuantity: 5,
          status: 'open',
          createdAt: '2026-03-17T18:00:00.000Z',
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
        marketContextKey: 'region_anchor',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
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

  it('creates a limit order from the market endpoint', async () => {
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
      url: '/market/orders',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        resourceId: 'iron_ingot',
        side: 'sell',
        price: 20,
        quantity: 5,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      orderId: 'limit-order-123',
      resourceId: 'iron_ingot',
      side: 'sell',
      pricePerUnit: 20,
      quantity: 5,
      remainingQuantity: 0,
      status: 'filled',
      playerCredits: 2350,
      inventoryQuantity: 58,
      matchedOrderId: 'matched-order-123',
      tradeId: 'trade-123',
      createdAt: '2026-03-17T18:00:00.000Z',
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
      currentStepId: 'open_inventory',
      currentStepIndex: 3,
      totalSteps: 7,
      isSkipped: false,
      isCompleted: false,
      completedStepIds: ['extract_resource', 'claim_resource'],
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
        marketContextKey: 'region_anchor',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
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

  it('creates an instant production job for a valid recipe', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock({
        starterProcessingInstallationCount: 1,
      }),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/production/jobs',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        recipeKey: 'iron_ingot_from_iron_ore',
        runs: 2,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      jobId: 'production-job-123',
      buildingId: 'building-123',
      recipeKey: 'iron_ingot_from_iron_ore',
      runs: 2,
      inputResourceId: 'iron_ore',
      inputAmount: 4,
      inputInventoryQuantity: 44,
      outputResourceId: 'iron_ingot',
      outputAmount: 2,
      outputInventoryQuantity: 2,
      completedAt: '2026-03-17T12:00:00.000Z',
    });
  });

  it('creates a logistics transfer between player locations', async () => {
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
      url: '/logistics/transfers',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        fromLocationId: '11111111-1111-1111-1111-111111111111',
        toLocationId: '22222222-2222-2222-2222-222222222222',
        itemKey: 'iron_ore',
        quantity: 24,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      transferId: 'transfer-123',
      fromLocationId: '11111111-1111-1111-1111-111111111111',
      toLocationId: '22222222-2222-2222-2222-222222222222',
      resourceId: 'iron_ore',
      quantity: 24,
      fromInventoryQuantity: 24,
      toInventoryQuantity: 24,
      createdAt: '2026-03-17T15:00:00.000Z',
    });
  });

  it('validates production job payloads', async () => {
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
      url: '/production/jobs',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        recipeKey: 'iron_ingot_from_iron_ore',
        runs: 0,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Bad Request',
      message: 'Invalid production job payload.',
    });
  });

  it('returns a clear error when production inventory is insufficient', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock({
        starterProcessingInstallationCount: 1,
      }),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/production/jobs',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        recipeKey: 'iron_ingot_from_iron_ore',
        runs: 99,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Bad Request',
      message: 'Not enough input inventory to start production.',
    });
  });

  it('rejects production when the starter processing installation is missing', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock({
        starterProcessingInstallationCount: 0,
      }),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);

    const response = await app.inject({
      method: 'POST',
      url: '/production/jobs',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        recipeKey: 'iron_ingot_from_iron_ore',
        runs: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Bad Request',
      message: 'Starter processing installation required for production.',
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

  it('runs a coherent starter-loop smoke with processor gating and dashboard consistency', async () => {
    vi.spyOn(supabaseClient, 'createSupabaseAdminClient').mockReturnValue(
      createAdminClientMock({
        dynamicStarterBuildingCounts: true,
        seedInitialExtractor: false,
      }),
    );
    vi.spyOn(supabaseClient, 'createSupabaseAuthClient').mockReturnValue({
      auth: {},
    } as unknown as ReturnType<typeof supabaseClient.createSupabaseAuthClient>);

    const app = buildApp();
    appsToClose.push(app);
    const authHeaders = {
      authorization: 'Bearer valid-token',
    };

    const placeExtractorResponse = await app.inject({
      method: 'POST',
      url: '/buildings/first-extractor',
      headers: authHeaders,
      payload: {
        buildingTypeId: 'ironridge_iron_extractor',
      },
    });

    expect(placeExtractorResponse.statusCode).toBe(200);
    expect(placeExtractorResponse.json()).toMatchObject({
      building: {
        buildingTypeId: 'ironridge_iron_extractor',
      },
    });

    const dashboardBeforeProcessorResponse = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: authHeaders,
    });

    expect(dashboardBeforeProcessorResponse.statusCode).toBe(200);
    expect(dashboardBeforeProcessorResponse.json()).toMatchObject({
      processingInstallation: null,
      transformRecipes: [
        expect.objectContaining({
          recipeId: 'ironridge_iron_ingot_batch',
          canStart: false,
        }),
      ],
    });

    const blockedProductionResponse = await app.inject({
      method: 'POST',
      url: '/production/jobs',
      headers: authHeaders,
      payload: {
        recipeKey: 'iron_ingot_from_iron_ore',
        runs: 1,
      },
    });

    expect(blockedProductionResponse.statusCode).toBe(400);
    expect(blockedProductionResponse.json()).toEqual({
      error: 'Bad Request',
      message: 'Starter processing installation required for production.',
    });

    const placeProcessorResponse = await app.inject({
      method: 'POST',
      url: '/buildings/first-processing-installation',
      headers: authHeaders,
      payload: {
        buildingTypeId: 'starter_processing_installation',
      },
    });

    expect(placeProcessorResponse.statusCode).toBe(200);
    expect(placeProcessorResponse.json()).toMatchObject({
      building: {
        buildingTypeId: 'starter_processing_installation',
      },
    });

    const productionResponse = await app.inject({
      method: 'POST',
      url: '/production/jobs',
      headers: authHeaders,
      payload: {
        recipeKey: 'iron_ingot_from_iron_ore',
        runs: 2,
      },
    });

    expect(productionResponse.statusCode).toBe(200);
    expect(productionResponse.json()).toMatchObject({
      recipeKey: 'iron_ingot_from_iron_ore',
      runs: 2,
      outputResourceId: 'iron_ingot',
    });

    const claimResponse = await app.inject({
      method: 'POST',
      url: '/buildings/building-123/claim-production',
      headers: authHeaders,
    });

    expect(claimResponse.statusCode).toBe(200);
    expect(claimResponse.json()).toMatchObject({
      inventory: {
        resourceId: 'iron_ore',
      },
    });

    const sellResponse = await app.inject({
      method: 'POST',
      url: '/market/sell',
      headers: authHeaders,
      payload: {
        resourceId: 'iron_ore',
        quantity: 10,
        marketContextKey: 'region_anchor',
      },
    });

    expect(sellResponse.statusCode).toBe(200);
    expect(sellResponse.json()).toMatchObject({
      quantitySold: 10,
      resourceId: 'iron_ore',
    });

    const buyResponse = await app.inject({
      method: 'POST',
      url: '/market/buy',
      headers: authHeaders,
      payload: {
        resourceId: 'coal',
        quantity: 10,
        marketContextKey: 'region_anchor',
      },
    });

    expect(buyResponse.statusCode).toBe(200);
    expect(buyResponse.json()).toMatchObject({
      quantityPurchased: 10,
      resourceId: 'coal',
    });

    const transferResponse = await app.inject({
      method: 'POST',
      url: '/logistics/transfers',
      headers: authHeaders,
      payload: {
        fromLocationId: '11111111-1111-1111-1111-111111111111',
        toLocationId: '22222222-2222-2222-2222-222222222222',
        itemKey: 'iron_ore',
        quantity: 24,
      },
    });

    expect(transferResponse.statusCode).toBe(200);
    expect(transferResponse.json()).toMatchObject({
      resourceId: 'iron_ore',
      quantity: 24,
    });

    const dashboardAfterProcessorResponse = await app.inject({
      method: 'GET',
      url: '/dashboard',
      headers: authHeaders,
    });

    expect(dashboardAfterProcessorResponse.statusCode).toBe(200);
    expect(dashboardAfterProcessorResponse.json()).toMatchObject({
      processingInstallation: {
        buildingTypeId: 'starter_processing_installation',
      },
      transformRecipes: [
        expect.objectContaining({
          recipeId: 'ironridge_iron_ingot_batch',
          canStart: true,
        }),
      ],
      ledger: [
        expect.objectContaining({
          actionType: 'market_sell',
        }),
        expect.objectContaining({
          actionType: 'claim_production',
        }),
      ],
    });
  });
});
