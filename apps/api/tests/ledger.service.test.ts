import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getLedgerFeed } from '../src/modules/ledger/ledger.service';

function createAppMock() {
  return {
    app: {
      getSupabaseAdminClient: () => ({
        from: (table: string) => {
          if (table === 'ledger_entries') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      returns: vi.fn().mockResolvedValue({
                        data: [
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
                        ],
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

describe('ledger service', () => {
  it('returns recent ledger entries in feed shape', async () => {
    const { app } = createAppMock();

    const result = await getLedgerFeed(app, {
      playerId: 'player-123',
      limit: 5,
    });

    expect(result).toEqual({
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
});
