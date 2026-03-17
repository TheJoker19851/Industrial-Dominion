import { describe, expect, it } from 'vitest';
import { getLedgerAmountTone } from '../src/features/dashboard/ledger-feed';

describe('ledger feed helpers', () => {
  it('marks positive actions correctly', () => {
    expect(
      getLedgerAmountTone({
        id: '1',
        actionType: 'claim_production',
        amount: 48,
        createdAt: '2026-03-15T12:45:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toBe('positive');
  });

  it('marks market fees as negative', () => {
    expect(
      getLedgerAmountTone({
        id: '2',
        actionType: 'market_fee',
        amount: 4,
        createdAt: '2026-03-15T13:00:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toBe('negative');
  });

  it('marks market purchases as negative', () => {
    expect(
      getLedgerAmountTone({
        id: '3',
        actionType: 'market_purchase',
        amount: -120,
        createdAt: '2026-03-16T12:00:00.000Z',
        metadata: {},
        resourceId: 'coal',
      }),
    ).toBe('negative');
  });

  it('marks completed transform output as positive', () => {
    expect(
      getLedgerAmountTone({
        id: '4',
        actionType: 'production_completed',
        amount: 6,
        createdAt: '2026-03-17T12:00:00.000Z',
        metadata: {},
        resourceId: 'iron_ingot',
      }),
    ).toBe('positive');
  });
});
