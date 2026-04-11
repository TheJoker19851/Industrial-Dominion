import { describe, expect, it } from 'vitest';
import { previewMarketSnapshot } from '../src/features/dashboard/dashboard-preview';
import {
  getRefreshedPreviewMarketSnapshot,
  persistMarketPreviewRefreshCycle,
  restoreMarketPreviewRefreshCycle,
} from '../src/features/dashboard/market-refresh';
import { getBestEconomicMoves } from '../src/features/dashboard/best-economic-moves';

describe('market refresh', () => {
  it('keeps cycle 0 on the baseline preview market', () => {
    const refreshed = getRefreshedPreviewMarketSnapshot(previewMarketSnapshot, 0);

    expect(refreshed.scenarioKey).toBe('baseline');
    expect(refreshed.snapshot).toEqual(previewMarketSnapshot);
  });

  it('produces a bounded deterministic refresh state for a given cycle', () => {
    const first = getRefreshedPreviewMarketSnapshot(previewMarketSnapshot, 1);
    const second = getRefreshedPreviewMarketSnapshot(previewMarketSnapshot, 1);

    expect(first).toEqual(second);
    expect(first.scenarioKey).toBe('foundry_push');
    expect(
      first.snapshot.offers.find((entry) => entry.resourceId === 'iron_ingot')?.contextPrices.find(
        (quote) => quote.contextKey === 'trade_hub',
      )?.price,
    ).toBe(53);
    expect(
      first.snapshot.inventory.find((entry) => entry.resourceId === 'iron_ore')?.quantity,
    ).toBe(92);
  });

  it('recalculates the unified economic shortlist from the refreshed market state', () => {
    const baselineMoves = getBestEconomicMoves(previewMarketSnapshot);
    const refreshedMoves = getBestEconomicMoves(
      getRefreshedPreviewMarketSnapshot(previewMarketSnapshot, 3).snapshot,
    );

    expect(refreshedMoves).toHaveLength(3);
    expect(refreshedMoves).not.toEqual(baselineMoves);
    expect(refreshedMoves[0]?.estimatedNetProfit).toBeGreaterThan(0);
  });

  it('restores and persists the refresh cycle locally', () => {
    const storage = new Map<string, string>();
    const storageLike = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
    };

    expect(restoreMarketPreviewRefreshCycle(storageLike)).toBe(0);
    persistMarketPreviewRefreshCycle(storageLike, 2);
    expect(restoreMarketPreviewRefreshCycle(storageLike)).toBe(2);
  });
});
