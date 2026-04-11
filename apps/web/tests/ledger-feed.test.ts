import { describe, expect, it } from 'vitest';
import {
  getLedgerActionBadgeKey,
  getLedgerAmountDisplayKind,
  getLedgerSignedAmount,
  getLedgerAmountTone,
  getLedgerBuildingTypeId,
  getLedgerToneLabelKey,
} from '../src/features/dashboard/ledger-feed';

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

  it('marks logistics transfers with direction-aware tones', () => {
    expect(
      getLedgerAmountTone({
        id: '5',
        actionType: 'logistics_transfer_out',
        amount: 12,
        createdAt: '2026-03-17T14:00:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toBe('negative');

    expect(
      getLedgerAmountTone({
        id: '6',
        actionType: 'logistics_transfer_in',
        amount: 12,
        createdAt: '2026-03-17T14:00:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toBe('positive');
  });

  it('uses badge display for build and transform-start actions', () => {
    expect(
      getLedgerAmountDisplayKind({
        id: '7',
        actionType: 'build',
        amount: 0,
        createdAt: '2026-03-17T14:10:00.000Z',
        metadata: {},
      }),
    ).toBe('badge');

    expect(
      getLedgerAmountDisplayKind({
        id: '8',
        actionType: 'production_transform_started',
        amount: 0,
        createdAt: '2026-03-17T14:10:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toBe('badge');
  });

  it('uses currency display for market entries and numeric for inventory entries', () => {
    expect(
      getLedgerAmountDisplayKind({
        id: '9',
        actionType: 'market_sell',
        amount: 120,
        createdAt: '2026-03-17T14:10:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toBe('currency');

    expect(
      getLedgerAmountDisplayKind({
        id: '10',
        actionType: 'production_completed',
        amount: 6,
        createdAt: '2026-03-17T14:10:00.000Z',
        metadata: {},
        resourceId: 'iron_ingot',
      }),
    ).toBe('number');
  });

  it('resolves badge keys for build and transform-start actions', () => {
    expect(
      getLedgerActionBadgeKey({
        id: '11',
        actionType: 'build',
        amount: 0,
        createdAt: '2026-03-17T14:10:00.000Z',
        metadata: {},
      }),
    ).toBe('dashboard.ledgerBadgePlaced');

    expect(
      getLedgerActionBadgeKey({
        id: '12',
        actionType: 'production_transform_started',
        amount: 0,
        createdAt: '2026-03-17T14:10:00.000Z',
        metadata: {},
      }),
    ).toBe('dashboard.ledgerBadgeStarted');
  });

  it('reads building type ids from ledger metadata safely', () => {
    expect(
      getLedgerBuildingTypeId({
        id: '13',
        actionType: 'build',
        amount: 0,
        createdAt: '2026-03-17T14:10:00.000Z',
        metadata: {
          buildingTypeId: 'starter_processing_installation',
        },
      }),
    ).toBe('starter_processing_installation');

    expect(
      getLedgerBuildingTypeId({
        id: '14',
        actionType: 'build',
        amount: 0,
        createdAt: '2026-03-17T14:10:00.000Z',
        metadata: {
          buildingTypeId: 42,
        },
      }),
    ).toBeNull();
  });

  it('returns signed absolute values for positive and negative outcomes', () => {
    expect(
      getLedgerSignedAmount({
        id: '15',
        actionType: 'claim_production',
        amount: 48,
        createdAt: '2026-03-18T10:00:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toEqual({
      sign: '+',
      absoluteAmount: 48,
    });

    expect(
      getLedgerSignedAmount({
        id: '16',
        actionType: 'market_fee',
        amount: 4,
        createdAt: '2026-03-18T10:00:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toEqual({
      sign: '-',
      absoluteAmount: 4,
    });
  });

  it('returns tone label keys only for positive and negative outcomes', () => {
    expect(
      getLedgerToneLabelKey({
        id: '17',
        actionType: 'market_sell',
        amount: 120,
        createdAt: '2026-03-18T10:00:00.000Z',
        metadata: {},
        resourceId: 'iron_ore',
      }),
    ).toBe('dashboard.activityTonePositive');

    expect(
      getLedgerToneLabelKey({
        id: '18',
        actionType: 'market_purchase',
        amount: 120,
        createdAt: '2026-03-18T10:00:00.000Z',
        metadata: {},
        resourceId: 'coal',
      }),
    ).toBe('dashboard.activityToneNegative');

    expect(
      getLedgerToneLabelKey({
        id: '19',
        actionType: 'build',
        amount: 0,
        createdAt: '2026-03-18T10:00:00.000Z',
        metadata: {},
      }),
    ).toBeNull();
  });
});
