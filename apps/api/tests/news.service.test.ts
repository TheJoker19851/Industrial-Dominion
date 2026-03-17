import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getSystemNewsFeed } from '../src/modules/news/news.service';

function createAppMock() {
  return {
    app: {
      getSupabaseAdminClient: () => ({
        from: (table: string) => {
          if (table === 'news_items') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      returns: vi.fn().mockResolvedValue({
                        data: [
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

describe('news service', () => {
  it('returns recent system news items', async () => {
    const { app } = createAppMock();

    const result = await getSystemNewsFeed(app, {
      limit: 2,
    });

    expect(result).toEqual({
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
});
