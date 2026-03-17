import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  getStarterTutorialProgress,
  skipStarterTutorial,
  syncStarterTutorialProgress,
} from '../src/modules/tutorial/tutorial.service';

function createAppMock(options?: {
  initialCompletedStepIds?: string[];
  inventoryViewedAt?: string | null;
  skippedAt?: string | null;
  completedAt?: string | null;
  signalCounts?: {
    starterGrant?: number;
    buildings?: number;
    claimProduction?: number;
    marketSell?: number;
  };
}) {
  const state = {
    completed_step_ids: options?.initialCompletedStepIds ?? ['welcome', 'place_extractor', 'claim_production'],
    inventory_viewed_at: options?.inventoryViewedAt ?? null,
    skipped_at: options?.skippedAt ?? null,
    completed_at: options?.completedAt ?? null,
  };

  const signalCounts = {
    starterGrant: options?.signalCounts?.starterGrant ?? 1,
    buildings: options?.signalCounts?.buildings ?? 1,
    claimProduction: options?.signalCounts?.claimProduction ?? 1,
    marketSell: options?.signalCounts?.marketSell ?? 0,
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
                      if (value === 'starter_grant') {
                        result.count = signalCounts.starterGrant;
                      }

                      if (value === 'claim_production') {
                        result.count = signalCounts.claimProduction;
                      }

                      if (value === 'market_sell') {
                        result.count = signalCounts.marketSell;
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
  };
}

describe('tutorial service', () => {
  it('returns the next starter tutorial step for the current real loop', async () => {
    const { app } = createAppMock();

    const result = await getStarterTutorialProgress(app, 'player-123');

    expect(result.currentStepId).toBe('view_inventory');
    expect(result.currentStepIndex).toBe(4);
    expect(result.isCompleted).toBe(false);
    expect(result.isSkipped).toBe(false);
  });

  it('advances to the market sell step when inventory has been viewed', async () => {
    const { app } = createAppMock();

    const result = await syncStarterTutorialProgress(app, {
      playerId: 'player-123',
      markInventoryViewed: true,
    });

    expect(result.completedStepIds).toEqual([
      'welcome',
      'place_extractor',
      'claim_production',
      'view_inventory',
    ]);
    expect(result.currentStepId).toBe('sell_resource');
  });

  it('marks the tutorial complete after the first market sale', async () => {
    const { app } = createAppMock({
      initialCompletedStepIds: [
        'welcome',
        'place_extractor',
        'claim_production',
        'view_inventory',
      ],
      inventoryViewedAt: '2026-03-15T12:45:00.000Z',
      signalCounts: {
        marketSell: 1,
      },
    });

    const result = await getStarterTutorialProgress(app, 'player-123');

    expect(result.isCompleted).toBe(true);
    expect(result.currentStepId).toBe('complete');
    expect(result.currentStepIndex).toBe(6);
  });

  it('supports skipping the tutorial', async () => {
    const { app } = createAppMock();

    const result = await skipStarterTutorial(app, 'player-123');

    expect(result.isSkipped).toBe(true);
  });
});
