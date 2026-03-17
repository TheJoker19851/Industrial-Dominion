import type { LedgerFeedEntry } from '@industrial-dominion/shared';

export function getLedgerAmountTone(entry: LedgerFeedEntry) {
  if (entry.actionType === 'market_fee' || entry.actionType === 'market_purchase') {
    return 'negative';
  }

  if (entry.actionType === 'claim_production' || entry.actionType === 'market_sell') {
    return 'positive';
  }

  if (entry.actionType === 'production_completed') {
    return 'positive';
  }

  return 'neutral';
}
