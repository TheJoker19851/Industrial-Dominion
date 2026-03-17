import { describe, expect, it } from 'vitest';
import { starterRegionIds, starterResourceIds } from '../src/types/game';

describe('shared domain type constants', () => {
  it('keeps the starter regions aligned with the world seed', () => {
    expect(starterRegionIds).toEqual([
      'ironridge',
      'greenhaven',
      'sunbarrel',
      'riverplain',
    ]);
  });

  it('keeps the starter raw resources aligned with the world seed', () => {
    expect(starterResourceIds).toEqual([
      'iron_ore',
      'coal',
      'wood',
      'crude_oil',
      'sand',
      'water',
      'crops',
    ]);
  });
});
