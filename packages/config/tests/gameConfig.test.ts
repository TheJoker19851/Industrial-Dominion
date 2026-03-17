import { describe, expect, it } from 'vitest';
import { gameConfig } from '../src/gameConfig';

describe('gameConfig', () => {
  it('keeps the starter economy values aligned with the project baseline', () => {
    expect(gameConfig.starterCredits).toBeGreaterThan(0);
    expect(gameConfig.starterPlotCount).toBe(1);
    expect(gameConfig.starterWarehouseCount).toBe(1);
    expect(gameConfig.marketFee).toBeGreaterThan(0);
  });

  it('requires the mobile core loop from the start', () => {
    expect(gameConfig.mobileCoreLoopRequired).toBe(true);
  });
});
