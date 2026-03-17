import { describe, expect, it } from 'vitest';
import { getDashboardViewState } from '../src/features/dashboard/dashboard-model';

describe('dashboard model helpers', () => {
  it('requires sign-in when no player snapshot exists', () => {
    expect(
      getDashboardViewState({
        isAuthenticated: false,
        snapshot: {
          player: null,
          inventory: [],
          extractor: null,
          transformRecipes: [],
          ledger: [],
          news: [],
        },
      }),
    ).toBe('needs_sign_in');
  });

  it('requires bootstrap when the player has no region yet', () => {
    expect(
      getDashboardViewState({
        isAuthenticated: true,
        snapshot: {
          player: {
            id: 'player-123',
            locale: 'en',
            credits: 2500,
          },
          inventory: [],
          extractor: null,
          transformRecipes: [],
          ledger: [],
          news: [],
        },
      }),
    ).toBe('needs_bootstrap');
  });

  it('returns ready for a bootstrapped player snapshot', () => {
    expect(
      getDashboardViewState({
        isAuthenticated: true,
        snapshot: {
          player: {
            id: 'player-123',
            locale: 'en',
            credits: 2500,
            regionId: 'ironridge',
          },
          inventory: [],
          extractor: null,
          transformRecipes: [],
          ledger: [],
          news: [],
        },
      }),
    ).toBe('ready');
  });
});
