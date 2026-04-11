import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createProductionJob } from '../src/modules/production/production.service';

function createAppMock(options?: { hasProcessingInstallation?: boolean }) {
  const hasProcessingInstallation = options?.hasProcessingInstallation ?? true;
  const rpc = vi.fn().mockImplementation((fn: string, payload: Record<string, unknown>) => {
    if (fn !== 'create_production_job') {
      throw new Error(`Unexpected rpc ${fn}`);
    }

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
          runs: 3,
          input_resource_id: 'iron_ore',
          input_amount: 6,
          input_inventory_quantity: 10,
          output_resource_id: 'iron_ingot',
          output_amount: 3,
          output_inventory_quantity: 3,
          completed_at: '2026-03-17T12:00:00.000Z',
        },
      ],
      error: null,
    });
  });

  return {
    app: {
      getSupabaseAdminClient: () => ({
        from: (table: string) => {
          if (table !== 'buildings') {
            throw new Error(`Unexpected table ${table}`);
          }

          return {
            select: vi.fn((_fields: string, options?: { count?: string; head?: boolean }) => {
              if (!options?.head) {
                throw new Error('Expected head count query for buildings');
              }

              const query = {
                eq: vi.fn().mockReturnThis(),
                in: vi.fn().mockResolvedValue({
                  count: hasProcessingInstallation ? 1 : 0,
                  error: null,
                }),
              };

              return query;
            }),
          };
        },
        rpc,
      }),
    } as unknown as FastifyInstance,
    rpc,
  };
}

describe('production service', () => {
  it('creates an instant production job and returns the resulting inventory state', async () => {
    const { app, rpc } = createAppMock();

    const result = await createProductionJob(app, {
      playerId: 'player-123',
      recipeKey: 'iron_ingot_from_iron_ore',
      runs: 3,
    });

    expect(result).toEqual({
      jobId: 'production-job-123',
      buildingId: 'building-123',
      recipeKey: 'iron_ingot_from_iron_ore',
      runs: 3,
      inputResourceId: 'iron_ore',
      inputAmount: 6,
      inputInventoryQuantity: 10,
      outputResourceId: 'iron_ingot',
      outputAmount: 3,
      outputInventoryQuantity: 3,
      completedAt: '2026-03-17T12:00:00.000Z',
    });
    expect(rpc).toHaveBeenCalledWith('create_production_job', {
      p_player_id: 'player-123',
      p_recipe_key: 'iron_ingot_from_iron_ore',
      p_runs: 3,
    });
  });

  it('rejects production when the player lacks enough input inventory', async () => {
    const { app } = createAppMock();

    await expect(
      createProductionJob(app, {
        playerId: 'player-123',
        recipeKey: 'iron_ingot_from_iron_ore',
        runs: 99,
      }),
    ).rejects.toThrow('Not enough input inventory to start production.');
  });

  it('rejects invalid requests before calling the database rpc', async () => {
    const { app, rpc } = createAppMock();

    await expect(
      createProductionJob(app, {
        playerId: 'player-123',
        recipeKey: 'unknown_recipe',
        runs: 1,
      }),
    ).rejects.toThrow('Production recipe not found.');

    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects production when the starter processing installation is missing', async () => {
    const { app, rpc } = createAppMock({ hasProcessingInstallation: false });

    await expect(
      createProductionJob(app, {
        playerId: 'player-123',
        recipeKey: 'iron_ingot_from_iron_ore',
        runs: 1,
      }),
    ).rejects.toThrow('Starter processing installation required for production.');

    expect(rpc).not.toHaveBeenCalled();
  });
});
