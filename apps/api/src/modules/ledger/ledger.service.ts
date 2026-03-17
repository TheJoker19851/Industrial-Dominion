import type { FastifyInstance } from 'fastify';
import type {
  LedgerActionType,
  LedgerFeedEntry,
  LedgerFeedSnapshot,
  ResourceId,
} from '@industrial-dominion/shared';

type LedgerRow = {
  id: string;
  action_type: LedgerActionType;
  amount: number;
  resource_id: ResourceId | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

export async function getLedgerFeed(
  app: FastifyInstance,
  input: {
    playerId: string;
    limit?: number;
  },
): Promise<LedgerFeedSnapshot> {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('ledger_entries')
    .select('id, action_type, amount, resource_id, created_at, metadata')
    .eq('player_id', input.playerId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 10)
    .returns<LedgerRow[]>();

  if (error) {
    throw new Error(`Failed to load ledger feed: ${error.message}`);
  }

  return {
    entries: (data ?? []).map<LedgerFeedEntry>((entry) => ({
      id: entry.id,
      actionType: entry.action_type,
      amount: entry.amount,
      resourceId: entry.resource_id ?? undefined,
      createdAt: entry.created_at,
      metadata: entry.metadata ?? {},
    })),
  };
}
