import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  getStarterTutorialProgress,
  skipStarterTutorial,
  syncStarterTutorialProgress,
} from '../src/modules/tutorial/tutorial.service';

function createAppMock(options?: {
  initialCompletedStepIds?: string[];
  currentStep?: string | null;
  inventoryViewedAt?: string | null;
  skippedAt?: string | null;
  completedAt?: string | null;
  signalCounts?: {
    buildings?: number;
    claimProduction?: number;
    marketSell?: number;
    marketPurchase?: number;
    productionCompleted?: number;
    logisticsTransfer?: number;
  };
}) {
  const state = {
    current_step: options?.currentStep ?? null,
    completed_step_ids: options?.initialCompletedStepIds ?? [],
    inventory_viewed_at: options?.inventoryViewedAt ?? null,
    skipped_at: options?.skippedAt ?? null,
    completed_at: options?.completedAt ?? null,
  };

  const signalCounts = {
    buildings: options?.signalCounts?.buildings ?? 0,
    claimProduction: options?.signalCounts?.claimProduction ?? 0,
    marketSell: options?.signalCounts?.marketSell ?? 0,
    marketPurchase: options?.signalCounts?.marketPurchase ?? 0,
    productionCompleted: options?.signalCounts?.productionCompleted ?? 0,
    logisticsTransfer: options?.signalCounts?.logisticsTransfer ?? 0,
  };

  const tutorialTable = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockImplementation(async () => ({
          data: {
            player_id: 'player-123',
            tutorial_id: 'starter_loop',
            ...state,
          },
          error: null,
        })),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            player_id: 'player-123',
            tutorial_id: 'starter_loop',
            ...state,
          },
          error: null,
        }),
      }),
    }),
    update: vi.fn((patch: Record<string, unknown>) => {
      if ('current_step' in patch) {
        state.current_step = patch.current_step as string | null;
      }

      if ('completed_step_ids' in patch) {
        state.completed_step_ids = patch.completed_step_ids as string[];
      }

      if ('inventory_viewed_at' in patch) {
        state.inventory_viewed_at = patch.inventory_viewed_at as string | null;
      }

      if ('skipped_at' in patch) {
        state.skipped_at = patch.skipped_at as string | null;
      }

      if ('completed_at' in patch) {
        state.completed_at = patch.completed_at as string | null;
      }

      return {
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                player_id: 'player-123',
                tutorial_id: 'starter_loop',
                ...state,
              },
              error: null,
            }),
          }),
        }),
      };
    }),
  };

  return {
    app: {
      getSupabaseAdminClient: () => ({
        from: (table: string) => {
          if (table === 'player_tutorial_progress') {
            return tutorialTable;
          }

          if (table === 'buildings') {
            return {
              select: vi.fn(() => {
                const result = {
                  count: signalCounts.buildings,
                  error: null,
                  eq: vi.fn().mockReturnThis(),
                };

                return result;
              }),
            };
          }

          if (table === 'ledger_entries') {
            return {
              select: vi.fn(() => {
                const result = {
                  count: 0,
                  error: null,
                  eq: vi.fn((column: string, value: string) => {
                    if (column === 'action_type') {
                      if (value === 'claim_production') {
                        result.count = signalCounts.claimProduction;
                      }

                      if (value === 'market_sell') {
                        result.count = signalCounts.marketSell;
                      }

                      if (value === 'market_purchase') {
                        result.count = signalCounts.marketPurchase;
                      }

                      if (value === 'production_completed') {
                        result.count = signalCounts.productionCompleted;
                      }

                      if (value === 'logistics_transfer_out') {
                        result.count = signalCounts.logisticsTransfer;
                      }
                    }

                    return result;
                  }),
                };

                return result;
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
      }),
    } as unknown as FastifyInstance,
    tutorialTable,
  };
}

describe('tutorial service', () => {
  it('returns the initial economic tutorial state for a new player', async () => {
    const { app } = createAppMock();

    const result = await getStarterTutorialProgress(app, 'player-123');

    expect(result.currentStepId).toBe('extract_resource');
    expect(result.currentStepIndex).toBe(1);
    expect(result.totalSteps).toBe(7);
    expect(result.completedStepIds).toEqual([]);
  });

  it('progresses normally through the economic tutorial order', async () => {
    const { app } = createAppMock({
      signalCounts: {
        buildings: 1,
        claimProduction: 1,
        marketSell: 1,
        marketPurchase: 1,
        productionCompleted: 1,
      },
      inventoryViewedAt: '2026-03-17T10:00:00.000Z',
    });

    const result = await getStarterTutorialProgress(app, 'player-123');

    expect(result.completedStepIds).toEqual([
      'extract_resource',
      'claim_resource',
      'open_inventory',
      'sell_resource',
      'buy_resource',
      'produce_resource',
    ]);
    expect(result.currentStepId).toBe('transfer_resource');
    expect(result.currentStepIndex).toBe(7);
  });

  it('remains idempotent when the same completion signal is observed twice', async () => {
    const { app } = createAppMock({
      initialCompletedStepIds: ['extract_resource', 'claim_resource'],
      currentStep: 'open_inventory',
      signalCounts: {
        buildings: 1,
        claimProduction: 1,
      },
    });

    const first = await getStarterTutorialProgress(app, 'player-123');
    const second = await getStarterTutorialProgress(app, 'player-123');

    expect(first.completedStepIds).toEqual(['extract_resource', 'claim_resource']);
    expect(second.completedStepIds).toEqual(['extract_resource', 'claim_resource']);
    expect(second.currentStepId).toBe('open_inventory');
  });

  it('marks inventory viewed and advances only the next valid step', async () => {
    const { app } = createAppMock({
      initialCompletedStepIds: ['extract_resource', 'claim_resource'],
      currentStep: 'open_inventory',
      signalCounts: {
        buildings: 1,
        claimProduction: 1,
      },
    });

    const result = await syncStarterTutorialProgress(app, {
      playerId: 'player-123',
      markInventoryViewed: true,
    });

    expect(result.completedStepIds).toEqual([
      'extract_resource',
      'claim_resource',
      'open_inventory',
    ]);
    expect(result.currentStepId).toBe('sell_resource');
  });

  it('supports skipping the tutorial', async () => {
    const { app } = createAppMock();

    const result = await skipStarterTutorial(app, 'player-123');

    expect(result.isSkipped).toBe(true);
  });
});
