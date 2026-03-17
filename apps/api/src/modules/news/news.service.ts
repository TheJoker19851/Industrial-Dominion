import type { FastifyInstance } from 'fastify';
import type { NewsFeedItem, NewsFeedSnapshot } from '@industrial-dominion/shared';

type NewsRow = {
  id: string;
  headline_key: string;
  body_key: string;
  scope: 'system' | 'global' | 'regional' | 'corporation';
  created_at: string;
};

export async function getSystemNewsFeed(
  app: FastifyInstance,
  input?: {
    limit?: number;
  },
): Promise<NewsFeedSnapshot> {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('news_items')
    .select('id, headline_key, body_key, scope, created_at')
    .eq('scope', 'system')
    .order('created_at', { ascending: false })
    .limit(input?.limit ?? 5)
    .returns<NewsRow[]>();

  if (error) {
    throw new Error(`Failed to load news feed: ${error.message}`);
  }

  return {
    items: (data ?? []).map<NewsFeedItem>((entry) => ({
      id: entry.id,
      headlineKey: entry.headline_key,
      bodyKey: entry.body_key,
      scope: entry.scope,
      createdAt: entry.created_at,
    })),
  };
}
