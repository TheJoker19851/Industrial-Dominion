import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  claimProduction,
  claimTransform,
  placeFirstExtractor,
  placeFirstProcessingInstallation,
  startTransform,
} from '../src/modules/buildings/buildings.service';

function createMaybeSingleQuery<T>(data: T | null) {
  const query = {
    eq: vi.fn().mockReturnThis(),
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
  playerRegionId?: 'ironridge' | 'greenhaven' | 'sunbarrel' | 'riverplain' | null;
  existingExtractorCount?: number;
  existingProcessingInstallationCount?: number;
  latestProductionCompletesAt?: string | null;
  buildingCreatedAt?: string;
  inventoryQuantity?: number;
}) {
  const playerRegionId =
    options && 'playerRegionId' in options ? options.playerRegionId : 'ironridge';
  const existingExtractorCount = options?.existingExtractorCount ?? 0;
  const existingProcessingInstallationCount =
    options?.existingProcessingInstallationCount ?? 0;
  const buildingCreatedAt = options?.buildingCreatedAt ?? '2026-03-15T10:00:00.000Z';
  const latestProductionCompletesAt =
    options && 'latestProductionCompletesAt' in options
      ? options.latestProductionCompletesAt
      : null;
  const inventoryQuantity = options?.inventoryQuantity ?? 0;

  const playersSelect = {
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data:
          playerRegionId === undefined
            ? null
            : {
                id: 'player-123',
                region_id: playerRegionId,
              },
        error: null,
      }),
    }),
  };

  const buildingsClaimQuery = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: 'building-123',
        player_id: 'player-123',
        region_id: playerRegionId,
        building_type_id: 'ironridge_iron_extractor',
        level: 1,
        created_at: buildingCreatedAt,
      },
      error: null,
    }),
  };

  const buildingsCountSelect = {
    eq: vi.fn().mockReturnThis(),
    in: vi.fn((_column: string, values: string[]) =>
      Promise.resolve({
        count: values.includes('starter_processing_installation')
          ? existingProcessingInstallationCount
          : existingExtractorCount,
        error: null,
      }),
    ),
  };

  let lastInsertedBuildingTypeId = 'ironridge_iron_extractor';
  const buildingsInsert = {
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockImplementation(() =>
        Promise.resolve({
          data: {
            id:
              lastInsertedBuildingTypeId === 'starter_processing_installation'
                ? 'building-processor-1'
                : 'building-123',
            player_id: 'player-123',
            region_id: playerRegionId,
            building_type_id: lastInsertedBuildingTypeId,
            level: 1,
          },
          error: null,
        }),
      ),
    }),
  };

  const productionJobsQuery = createMaybeSingleQuery(
    latestProductionCompletesAt
      ? {
          completes_at: latestProductionCompletesAt,
        }
      : null,
  );

  const productionJobsInsert = {
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'job-123',
          started_at: latestProductionCompletesAt ?? buildingCreatedAt,
          completes_at: '2026-03-15T12:00:00.000Z',
          claimed_at: '2026-03-15T12:45:00.000Z',
        },
        error: null,
      }),
    }),
  };

  const inventorySelect = {
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data:
              inventoryQuantity > 0
                ? {
                    quantity: inventoryQuantity,
                  }
                : null,
            error: null,
          }),
        }),
      }),
    }),
  };

  const inventoryUpsert = vi.fn().mockResolvedValue({ error: null });
  const ledgerInsert = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockImplementation((fn: string) => {
    if (fn === 'start_transform_job') {
      return Promise.resolve({
        data: [
          {
            job_id: 'transform-job-123',
            building_id: 'building-123',
            recipe_id: 'ironridge_iron_ingot_batch',
            input_resource_id: 'iron_ore',
            input_inventory_quantity: 36,
            output_resource_id: 'iron_ingot',
            output_amount: 6,
            completes_at: '2026-03-15T13:00:00.000Z',
          },
        ],
        error: null,
      });
    }

    if (fn === 'claim_transform_job') {
      return Promise.resolve({
        data: [
          {
            job_id: 'transform-job-123',
            building_id: 'building-123',
            recipe_id: 'ironridge_iron_ingot_batch',
            output_resource_id: 'iron_ingot',
            output_amount: 6,
            inventory_quantity: 6,
            claimed_at: '2026-03-15T13:15:00.000Z',
          },
        ],
        error: null,
      });
    }

    throw new Error(`Unexpected rpc ${fn}`);
  });

  return {
    app: {
      getSupabaseAdminClient: () => ({
        rpc,
        from: (table: string) => {
          if (table === 'players') {
            return {
              select: vi.fn().mockReturnValue(playersSelect),
            };
          }

          if (table === 'buildings') {
            return {
              select: vi.fn((_fields: string, options?: { count?: string; head?: boolean }) =>
                options?.head
                  ? buildingsCountSelect
                  : _fields.includes('created_at')
                    ? buildingsClaimQuery
                    : buildingsInsert,
              ),
              insert: vi.fn((payload: Record<string, unknown>) => {
                if (typeof payload.building_type_id === 'string') {
                  lastInsertedBuildingTypeId = payload.building_type_id;
                }

                return buildingsInsert;
              }),
            };
          }

          if (table === 'production_jobs') {
            return {
              select: vi.fn().mockReturnValue(productionJobsQuery),
              insert: vi.fn().mockReturnValue(productionJobsInsert),
            };
          }

          if (table === 'inventories') {
            return {
              select: vi.fn().mockReturnValue(inventorySelect),
              upsert: inventoryUpsert,
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

          if (table === 'ledger_entries') {
            return {
              insert: ledgerInsert,
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
      }),
    } as unknown as FastifyInstance,
    ledgerInsert,
    inventoryUpsert,
    rpc,
  };
}

describe('buildings service', () => {
  it('places the first extractor for a bootstrapped player', async () => {
    const { app, ledgerInsert } = createAppMock();

    const result = await placeFirstExtractor(app, {
      playerId: 'player-123',
      buildingTypeId: 'ironridge_iron_extractor',
    });

    expect(result.building).toEqual({
      id: 'building-123',
      playerId: 'player-123',
      regionId: 'ironridge',
      buildingTypeId: 'ironridge_iron_extractor',
      level: 1,
    });
    expect(result.extractor.outputResourceId).toBe('iron_ore');
    expect(ledgerInsert).toHaveBeenCalled();
  });

  it('rejects placement before bootstrap completes', async () => {
    const { app } = createAppMock({ playerRegionId: null });

    await expect(
      placeFirstExtractor(app, {
        playerId: 'player-123',
        buildingTypeId: 'ironridge_iron_extractor',
      }),
    ).rejects.toThrow('Player must complete bootstrap before placing an extractor.');
  });

  it('rejects placement when a first extractor already exists', async () => {
    const { app } = createAppMock({ existingExtractorCount: 1 });

    await expect(
      placeFirstExtractor(app, {
        playerId: 'player-123',
        buildingTypeId: 'ironridge_iron_extractor',
      }),
    ).rejects.toThrow('Player already placed the first extractor.');
  });

  it('places the first starter processing installation after an extractor exists', async () => {
    const { app, ledgerInsert } = createAppMock({
      existingExtractorCount: 1,
      existingProcessingInstallationCount: 0,
    });

    const result = await placeFirstProcessingInstallation(app, {
      playerId: 'player-123',
      buildingTypeId: 'starter_processing_installation',
    });

    expect(result.building).toEqual({
      id: 'building-processor-1',
      playerId: 'player-123',
      regionId: 'ironridge',
      buildingTypeId: 'starter_processing_installation',
      level: 1,
    });
    expect(result.processingInstallation.id).toBe('starter_processing_installation');
    expect(ledgerInsert).toHaveBeenCalled();
  });

  it('rejects starter processing installation placement before bootstrap completes', async () => {
    const { app } = createAppMock({ playerRegionId: null });

    await expect(
      placeFirstProcessingInstallation(app, {
        playerId: 'player-123',
        buildingTypeId: 'starter_processing_installation',
      }),
    ).rejects.toThrow('Player must complete bootstrap before placing a processing installation.');
  });

  it('rejects starter processing installation placement before extractor placement', async () => {
    const { app } = createAppMock({
      existingExtractorCount: 0,
      existingProcessingInstallationCount: 0,
    });

    await expect(
      placeFirstProcessingInstallation(app, {
        playerId: 'player-123',
        buildingTypeId: 'starter_processing_installation',
      }),
    ).rejects.toThrow(
      'Player must place the first extractor before placing a processing installation.',
    );
  });

  it('rejects duplicate starter processing installation placement', async () => {
    const { app } = createAppMock({
      existingExtractorCount: 1,
      existingProcessingInstallationCount: 1,
    });

    await expect(
      placeFirstProcessingInstallation(app, {
        playerId: 'player-123',
        buildingTypeId: 'starter_processing_installation',
      }),
    ).rejects.toThrow('Player already placed the first processing installation.');
  });

  it('claims completed production into inventory for a starter extractor', async () => {
    const { app, inventoryUpsert, ledgerInsert } = createAppMock({
      buildingCreatedAt: '2026-03-15T10:00:00.000Z',
      inventoryQuantity: 5,
    });

    const result = await claimProduction(app, {
      playerId: 'player-123',
      buildingId: 'building-123',
      now: new Date('2026-03-15T12:45:00.000Z'),
    });

    expect(result.claimedQuantity).toBe(48);
    expect(result.inventory).toEqual({
      resourceId: 'iron_ore',
      quantity: 53,
    });
    expect(inventoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        player_id: 'player-123',
        location_id: 'location-primary',
        resource_id: 'iron_ore',
        quantity: 53,
      }),
      { onConflict: 'player_id,location_id,resource_id' },
    );
    expect(ledgerInsert).toHaveBeenCalled();
  });

  it('rejects a claim when less than one full hour has elapsed', async () => {
    const { app } = createAppMock({
      buildingCreatedAt: '2026-03-15T10:00:00.000Z',
    });

    await expect(
      claimProduction(app, {
        playerId: 'player-123',
        buildingId: 'building-123',
        now: new Date('2026-03-15T10:45:00.000Z'),
      }),
    ).rejects.toThrow('No production is ready to claim yet.');
  });

  it('starts a transform job by consuming real input inventory', async () => {
    const { app, rpc } = createAppMock({
      inventoryQuantity: 48,
      existingProcessingInstallationCount: 1,
    });

    const result = await startTransform(app, {
      playerId: 'player-123',
      buildingId: 'building-123',
      recipeId: 'ironridge_iron_ingot_batch',
    });

    expect(result).toEqual({
      jobId: 'transform-job-123',
      buildingId: 'building-123',
      recipeId: 'ironridge_iron_ingot_batch',
      inputResourceId: 'iron_ore',
      inputInventoryQuantity: 36,
      outputResourceId: 'iron_ingot',
      outputAmount: 6,
      completesAt: '2026-03-15T13:00:00.000Z',
    });
    expect(rpc).toHaveBeenCalledWith('start_transform_job', {
      p_player_id: 'player-123',
      p_building_id: 'building-123',
      p_recipe_id: 'ironridge_iron_ingot_batch',
    });
  });

  it('rejects transform start when the starter processing installation is missing', async () => {
    const { app, rpc } = createAppMock({
      existingProcessingInstallationCount: 0,
    });

    await expect(
      startTransform(app, {
        playerId: 'player-123',
        buildingId: 'building-123',
        recipeId: 'ironridge_iron_ingot_batch',
      }),
    ).rejects.toThrow('Starter processing installation required for production.');

    expect(rpc).not.toHaveBeenCalled();
  });

  it('claims completed transform output into inventory', async () => {
    const { app, rpc } = createAppMock();

    const result = await claimTransform(app, {
      playerId: 'player-123',
      jobId: 'transform-job-123',
    });

    expect(result).toEqual({
      jobId: 'transform-job-123',
      buildingId: 'building-123',
      recipeId: 'ironridge_iron_ingot_batch',
      outputResourceId: 'iron_ingot',
      outputAmount: 6,
      inventoryQuantity: 6,
      claimedAt: '2026-03-15T13:15:00.000Z',
    });
    expect(rpc).toHaveBeenCalledWith('claim_transform_job', {
      p_player_id: 'player-123',
      p_job_id: 'transform-job-123',
    });
  });
});
