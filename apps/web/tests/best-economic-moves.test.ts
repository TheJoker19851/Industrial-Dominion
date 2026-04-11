import { describe, expect, it } from 'vitest';
import { previewMarketSnapshot } from '../src/features/dashboard/dashboard-preview';
import { getBestEconomicMoves } from '../src/features/dashboard/best-economic-moves';

describe('best economic moves', () => {
  it('aggregates regional and transformation opportunities into a unified shortlist', () => {
    const moves = getBestEconomicMoves(previewMarketSnapshot);

    expect(moves).toHaveLength(3);
    expect(moves.map((entry) => entry.type)).toEqual([
      'transformation',
      'regional_trade',
      'transformation',
    ]);
    expect(moves.map((entry) => entry.sourceOpportunityId)).toEqual([
      'iron_ingot_value_add-region_anchor-trade_hub',
      'iron_ore-region_anchor-trade_hub',
      'crops_from_water_value_add-region_anchor-trade_hub',
    ]);
  });

  it('keeps the unified ordering deterministic by profit first, then efficiency', () => {
    const [firstMove, secondMove, thirdMove] = getBestEconomicMoves(previewMarketSnapshot);

    expect(firstMove).toMatchObject({
      type: 'transformation',
      estimatedNetProfit: 84,
      capitalRequired: 116,
    });
    expect(secondMove).toMatchObject({
      type: 'regional_trade',
      estimatedNetProfit: 40,
      capitalRequired: 220,
      category: 'safe',
    });
    expect(thirdMove).toMatchObject({
      type: 'transformation',
      estimatedNetProfit: 20,
      capitalRequired: 28,
    });
    expect(firstMove!.efficiencyScore).toBeGreaterThan(secondMove!.efficiencyScore);
  });

  it('returns an empty list when no market snapshot is available', () => {
    expect(getBestEconomicMoves(null)).toEqual([]);
  });
});
