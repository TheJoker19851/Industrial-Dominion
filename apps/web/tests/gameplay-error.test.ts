import { describe, expect, it } from 'vitest';
import { getGameplayErrorKey } from '../src/features/gameplay/gameplay-error';

describe('gameplay error localization mapping', () => {
  it('maps known backend starter-loop errors to translation keys', () => {
    expect(getGameplayErrorKey('No production is ready to claim yet.')).toBe(
      'gameplayErrors.productionNotReady',
    );
    expect(getGameplayErrorKey('Not enough inventory to sell.')).toBe(
      'gameplayErrors.notEnoughInventory',
    );
    expect(getGameplayErrorKey('Invalid bootstrap payload.')).toBe(
      'gameplayErrors.invalidBootstrapPayload',
    );
  });

  it('falls back to a generic localized error key', () => {
    expect(getGameplayErrorKey('Unexpected starter loop failure')).toBe(
      'gameplayErrors.generic',
    );
  });
});
