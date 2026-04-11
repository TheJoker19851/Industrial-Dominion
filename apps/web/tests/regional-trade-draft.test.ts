import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIMULATED_TRADE_CAPITAL,
  DEFAULT_REGIONAL_TRADE_SESSION_GOALS,
  DEFAULT_REGIONAL_SIMULATION_HISTORY_LIMIT,
  buildRegionalTradeDraft,
  getDefaultRegionalTradeSimulationState,
  getDefaultRegionalTradeDraftQuantity,
  getRegionalTradeRequiredCapital,
  getRegionalTradeSessionProgress,
  persistRegionalTradeSimulationState,
  pushRegionalTradeSimulationHistory,
  REGIONAL_TRADE_SIMULATION_STORAGE_KEY,
  resetSimulatedRegionalTradeCapital,
  resetRegionalTradeSimulationState,
  resolveRegionalTradeSimulation,
  restoreRegionalTradeSimulationState,
  simulateRegionalTradeDraft,
} from '../src/features/dashboard/regional-trade-draft';
import { getRegionalOpportunities } from '../src/features/dashboard/regional-opportunities';
import { previewMarketSnapshot } from '../src/features/dashboard/dashboard-preview';

describe('regional trade draft', () => {
  const [opportunity] = getRegionalOpportunities(previewMarketSnapshot);

  function createStorageMock(initialValue?: string) {
    const state = new Map<string, string>();

    if (initialValue) {
      state.set(REGIONAL_TRADE_SIMULATION_STORAGE_KEY, initialValue);
    }

    return {
      getItem(key: string) {
        return state.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        state.set(key, value);
      },
      removeItem(key: string) {
        state.delete(key);
      },
    };
  }

  it('builds a trade draft from a selected regional opportunity', () => {
    const draft = buildRegionalTradeDraft(opportunity!);

    expect(draft).toMatchObject({
      resourceId: 'iron_ore',
      buyContextKey: 'region_anchor',
      sellContextKey: 'trade_hub',
      buyPricePerUnit: 10,
      sellPricePerUnit: 13,
      transferCostPerUnit: 1,
      netSpreadPerUnit: 2,
      estimatedTradableUnits: 84,
      quantity: 20,
      estimatedPurchaseCost: 200,
      estimatedTransferCost: 20,
      estimatedRevenue: 260,
      estimatedNetProfit: 40,
    });
  });

  it('uses a deterministic capped default quantity', () => {
    expect(getDefaultRegionalTradeDraftQuantity(opportunity!)).toBe(20);
  });

  it('recalculates totals when the quantity changes', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 12);

    expect(draft.quantity).toBe(12);
    expect(draft.estimatedPurchaseCost).toBe(120);
    expect(draft.estimatedTransferCost).toBe(12);
    expect(draft.estimatedRevenue).toBe(156);
    expect(draft.estimatedNetProfit).toBe(24);
  });

  it('keeps the draft deterministic by clamping quantity to the estimated route capacity', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 999);

    expect(draft.quantity).toBe(84);
    expect(draft.estimatedNetProfit).toBe(168);
  });

  it('transforms a draft into a stable simulation result', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 15);
    const result = simulateRegionalTradeDraft(draft, DEFAULT_SIMULATED_TRADE_CAPITAL, '2026-03-22T12:00:00.000Z');

    expect(result).toMatchObject({
      id: 'iron_ore-region_anchor-trade_hub-2026-03-22T12:00:00.000Z',
      occurredAt: '2026-03-22T12:00:00.000Z',
      resourceId: 'iron_ore',
      buyContextKey: 'region_anchor',
      sellContextKey: 'trade_hub',
      quantity: 15,
      estimatedPurchaseCost: 150,
      estimatedTransferCost: 15,
      estimatedRevenue: 195,
      estimatedNetProfit: 30,
      capitalBefore: 750,
      capitalAfter: 780,
    });
  });

  it('applies the simulated capital impact when the trade can be funded', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 10);
    const resolution = resolveRegionalTradeSimulation(draft, 300, '2026-03-22T14:00:00.000Z');

    expect(resolution).toMatchObject({
      ok: true,
      capitalBefore: 300,
      capitalAfter: 320,
    });

    if (resolution.ok) {
      expect(resolution.result.capitalBefore).toBe(300);
      expect(resolution.result.capitalAfter).toBe(320);
      expect(resolution.result.estimatedNetProfit).toBe(20);
    }
  });

  it('computes the required capital from purchase plus transfer costs', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 7);

    expect(getRegionalTradeRequiredCapital(draft)).toBe(77);
  });

  it('refuses the simulation when capital is insufficient', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 20);
    const resolution = resolveRegionalTradeSimulation(draft, 150, '2026-03-22T14:00:00.000Z');

    expect(resolution).toEqual({
      ok: false,
      capitalBefore: 150,
      requiredCapital: 220,
    });
  });

  it('keeps only the latest simulation results in local history', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 5);
    const history = pushRegionalTradeSimulationHistory(
      pushRegionalTradeSimulationHistory(
        pushRegionalTradeSimulationHistory(
          pushRegionalTradeSimulationHistory(
            [],
            simulateRegionalTradeDraft(draft, 300, '2026-03-22T10:00:00.000Z'),
            3,
          ),
          simulateRegionalTradeDraft(draft, 310, '2026-03-22T11:00:00.000Z'),
          3,
        ),
        simulateRegionalTradeDraft(draft, 320, '2026-03-22T12:00:00.000Z'),
        3,
      ),
      simulateRegionalTradeDraft(draft, 330, '2026-03-22T13:00:00.000Z'),
      3,
    );

    expect(history).toHaveLength(3);
    expect(history[0]?.occurredAt).toBe('2026-03-22T13:00:00.000Z');
    expect(history[2]?.occurredAt).toBe('2026-03-22T11:00:00.000Z');
  });

  it('stays deterministic when the simulated capital is reset', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 8);
    const resetCapital = resetSimulatedRegionalTradeCapital();
    const first = resolveRegionalTradeSimulation(draft, resetCapital, '2026-03-22T15:00:00.000Z');
    const reset = resolveRegionalTradeSimulation(
      draft,
      resetSimulatedRegionalTradeCapital(),
      '2026-03-22T15:00:00.000Z',
    );

    expect(first).toEqual(reset);
    expect(resetCapital).toBe(DEFAULT_SIMULATED_TRADE_CAPITAL);
  });

  it('restores default state when no persisted simulation state exists', () => {
    const storage = createStorageMock();

    expect(restoreRegionalTradeSimulationState(storage)).toEqual(
      getDefaultRegionalTradeSimulationState(),
    );
  });

  it('restores persisted capital and recent simulation history', () => {
    const result = simulateRegionalTradeDraft(
      buildRegionalTradeDraft(opportunity!, 6),
      400,
      '2026-03-22T16:00:00.000Z',
    );
    const storage = createStorageMock(
      JSON.stringify({
        capital: 512,
        recentSimulations: [result],
      }),
    );

    expect(restoreRegionalTradeSimulationState(storage)).toEqual({
      capital: 512,
      recentSimulations: [result],
    });
  });

  it('persists updated capital and history after a simulation', () => {
    const storage = createStorageMock();
    const result = simulateRegionalTradeDraft(
      buildRegionalTradeDraft(opportunity!, 4),
      300,
      '2026-03-22T17:00:00.000Z',
    );

    persistRegionalTradeSimulationState(storage, {
      capital: result.capitalAfter,
      recentSimulations: [result],
    });

    expect(JSON.parse(storage.getItem(REGIONAL_TRADE_SIMULATION_STORAGE_KEY)!)).toEqual({
      capital: result.capitalAfter,
      recentSimulations: [result],
    });
  });

  it('caps restored history to the latest supported entries', () => {
    const draft = buildRegionalTradeDraft(opportunity!, 3);
    const results = Array.from({ length: 6 }, (_, index) =>
      simulateRegionalTradeDraft(
        draft,
        500 + index,
        `2026-03-22T1${index}:00:00.000Z`,
      ),
    );
    const storage = createStorageMock(
      JSON.stringify({
        capital: 600,
        recentSimulations: results,
      }),
    );

    const restored = restoreRegionalTradeSimulationState(storage);

    expect(restored.recentSimulations).toHaveLength(
      DEFAULT_REGIONAL_SIMULATION_HISTORY_LIMIT,
    );
    expect(restored.recentSimulations[0]).toEqual(results[0]);
  });

  it('clears persisted state on reset and returns defaults', () => {
    const result = simulateRegionalTradeDraft(
      buildRegionalTradeDraft(opportunity!, 5),
      320,
      '2026-03-22T18:00:00.000Z',
    );
    const storage = createStorageMock(
      JSON.stringify({
        capital: 412,
        recentSimulations: [result],
      }),
    );

    expect(resetRegionalTradeSimulationState(storage)).toEqual(
      getDefaultRegionalTradeSimulationState(),
    );
    expect(storage.getItem(REGIONAL_TRADE_SIMULATION_STORAGE_KEY)).toBeNull();
  });

  it('returns an initial session-progress state from the default simulation state', () => {
    const progress = getRegionalTradeSessionProgress(getDefaultRegionalTradeSimulationState());

    expect(progress).toMatchObject({
      completedGoals: 0,
      totalGoals: 3,
      isCompleted: false,
      capital: {
        current: DEFAULT_SIMULATED_TRADE_CAPITAL,
        target: DEFAULT_REGIONAL_TRADE_SESSION_GOALS.capitalTarget,
        completed: false,
      },
      profitableTrades: {
        current: 0,
        target: DEFAULT_REGIONAL_TRADE_SESSION_GOALS.profitableTradesTarget,
        completed: false,
      },
      cumulativeProfit: {
        current: 0,
        target: DEFAULT_REGIONAL_TRADE_SESSION_GOALS.cumulativeProfitTarget,
        completed: false,
      },
    });
  });

  it('updates session progress after a profitable simulation history grows', () => {
    const profitableOne = simulateRegionalTradeDraft(
      buildRegionalTradeDraft(opportunity!, 10),
      750,
      '2026-03-22T19:00:00.000Z',
    );
    const profitableTwo = simulateRegionalTradeDraft(
      buildRegionalTradeDraft(opportunity!, 15),
      770,
      '2026-03-22T20:00:00.000Z',
    );
    const progress = getRegionalTradeSessionProgress({
      capital: profitableTwo.capitalAfter,
      recentSimulations: [profitableTwo, profitableOne],
    });

    expect(progress.profitableTrades.current).toBe(2);
    expect(progress.profitableTrades.completed).toBe(true);
    expect(progress.cumulativeProfit.current).toBe(50);
    expect(progress.completedGoals).toBe(1);
  });

  it('marks the session goals complete once all targets are reached', () => {
    const highProfitA = simulateRegionalTradeDraft(
      buildRegionalTradeDraft(opportunity!, 30),
      900,
      '2026-03-22T21:00:00.000Z',
    );
    const highProfitB = simulateRegionalTradeDraft(
      buildRegionalTradeDraft(opportunity!, 30),
      960,
      '2026-03-22T22:00:00.000Z',
    );
    const progress = getRegionalTradeSessionProgress({
      capital: 1020,
      recentSimulations: [highProfitB, highProfitA],
    });

    expect(progress.capital.completed).toBe(true);
    expect(progress.profitableTrades.completed).toBe(true);
    expect(progress.cumulativeProfit.completed).toBe(true);
    expect(progress.isCompleted).toBe(true);
  });

  it('resets derived session progress back to the initial state after reset', () => {
    const storage = createStorageMock();
    const result = simulateRegionalTradeDraft(
      buildRegionalTradeDraft(opportunity!, 10),
      800,
      '2026-03-22T23:00:00.000Z',
    );

    persistRegionalTradeSimulationState(storage, {
      capital: result.capitalAfter,
      recentSimulations: [result],
    });

    const resetState = resetRegionalTradeSimulationState(storage);
    const progress = getRegionalTradeSessionProgress(resetState);

    expect(progress.completedGoals).toBe(0);
    expect(progress.isCompleted).toBe(false);
    expect(progress.capital.current).toBe(DEFAULT_SIMULATED_TRADE_CAPITAL);
  });
});
