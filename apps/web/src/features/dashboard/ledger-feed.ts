import type { LedgerFeedEntry } from '@industrial-dominion/shared';

export function getLedgerAmountTone(entry: LedgerFeedEntry) {
  if (
    entry.actionType === 'market_fee' ||
    entry.actionType === 'market_purchase' ||
    entry.actionType === 'logistics_transfer_out'
  ) {
    return 'negative';
  }

  if (
    entry.actionType === 'claim_production' ||
    entry.actionType === 'market_sell' ||
    entry.actionType === 'logistics_transfer_in'
  ) {
    return 'positive';
  }

  if (entry.actionType === 'production_completed') {
    return 'positive';
  }

  return 'neutral';
}

export function getLedgerSignedAmount(entry: LedgerFeedEntry) {
  const tone = getLedgerAmountTone(entry);

  if (tone === 'positive') {
    return {
      sign: '+',
      absoluteAmount: Math.abs(entry.amount),
    };
  }

  if (tone === 'negative') {
    return {
      sign: '-',
      absoluteAmount: Math.abs(entry.amount),
    };
  }

  return {
    sign: '',
    absoluteAmount: entry.amount,
  };
}

export function getLedgerToneLabelKey(entry: LedgerFeedEntry) {
  const tone = getLedgerAmountTone(entry);

  if (tone === 'positive') {
    return 'dashboard.activityTonePositive';
  }

  if (tone === 'negative') {
    return 'dashboard.activityToneNegative';
  }

  return null;
}

export function getLedgerAmountDisplayKind(entry: LedgerFeedEntry) {
  if (entry.actionType === 'build' || entry.actionType === 'production_transform_started') {
    return 'badge';
  }

  if (
    entry.actionType === 'market_fee' ||
    entry.actionType === 'market_purchase' ||
    entry.actionType === 'market_sell'
  ) {
    return 'currency';
  }

  return 'number';
}

export function getLedgerActionBadgeKey(entry: LedgerFeedEntry) {
  if (entry.actionType === 'build') {
    return 'dashboard.ledgerBadgePlaced';
  }

  if (entry.actionType === 'production_transform_started') {
    return 'dashboard.ledgerBadgeStarted';
  }

  return null;
}

export function getLedgerBuildingTypeId(entry: LedgerFeedEntry) {
  const buildingTypeId = entry.metadata?.buildingTypeId;

  return typeof buildingTypeId === 'string' ? buildingTypeId : null;
}
