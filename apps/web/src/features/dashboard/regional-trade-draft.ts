import type { MarketContextKey, ResourceId } from '@industrial-dominion/shared';
import type { RegionalOpportunity } from './regional-opportunities';

export type RegionalTradeDraft = {
  resourceId: ResourceId;
  buyContextKey: MarketContextKey;
  sellContextKey: MarketContextKey;
  buyPricePerUnit: number;
  sellPricePerUnit: number;
  transferCostPerUnit: number;
  netSpreadPerUnit: number;
  estimatedTradableUnits: number;
  quantity: number;
  estimatedPurchaseCost: number;
  estimatedTransferCost: number;
  estimatedRevenue: number;
  estimatedNetProfit: number;
};

export type RegionalTradeSimulationResult = {
  id: string;
  occurredAt: string;
  resourceId: ResourceId;
  buyContextKey: MarketContextKey;
  sellContextKey: MarketContextKey;
  quantity: number;
  estimatedPurchaseCost: number;
  estimatedTransferCost: number;
  estimatedRevenue: number;
  estimatedNetProfit: number;
  capitalBefore: number;
  capitalAfter: number;
};

export type RegionalTradeCapitalSimulation = {
  ok: true;
  capitalBefore: number;
  capitalAfter: number;
  result: RegionalTradeSimulationResult;
};

export type RegionalTradeCapitalFailure = {
  ok: false;
  capitalBefore: number;
  requiredCapital: number;
};

export type RegionalTradeSimulationState = {
  capital: number;
  recentSimulations: RegionalTradeSimulationResult[];
};

export type RegionalTradeSessionGoals = {
  capitalTarget: number;
  profitableTradesTarget: number;
  cumulativeProfitTarget: number;
};

export type RegionalTradeSessionProgress = {
  goals: RegionalTradeSessionGoals;
  capital: {
    current: number;
    target: number;
    progress: number;
    completed: boolean;
  };
  profitableTrades: {
    current: number;
    target: number;
    progress: number;
    completed: boolean;
  };
  cumulativeProfit: {
    current: number;
    target: number;
    progress: number;
    completed: boolean;
  };
  completedGoals: number;
  totalGoals: number;
  isCompleted: boolean;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// MVP assumption: start every local trading session with a small, round budget
// that is easy to reason about while still forcing trade-offs.
export const DEFAULT_SIMULATED_TRADE_CAPITAL = 750;
export const DEFAULT_REGIONAL_SIMULATION_HISTORY_LIMIT = 4;
export const REGIONAL_TRADE_SIMULATION_STORAGE_KEY =
  'industrial-dominion.regional-trade-simulation';
export const DEFAULT_REGIONAL_TRADE_SESSION_GOALS: RegionalTradeSessionGoals = {
  capitalTarget: 900,
  profitableTradesTarget: 2,
  cumulativeProfitTarget: 120,
};

function clampRegionalTradeDraftQuantity(quantity: number, estimatedTradableUnits: number) {
  const normalizedQuantity = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
  const maxQuantity = Math.max(1, estimatedTradableUnits);

  return Math.min(maxQuantity, Math.max(1, normalizedQuantity));
}

export function getDefaultRegionalTradeDraftQuantity(opportunity: RegionalOpportunity) {
  // MVP assumption: prefill a small, readable batch that still feels actionable
  // without defaulting to the full estimated route capacity.
  return clampRegionalTradeDraftQuantity(
    Math.min(opportunity.estimatedTradableUnits, 20),
    opportunity.estimatedTradableUnits,
  );
}

export function buildRegionalTradeDraft(
  opportunity: RegionalOpportunity,
  quantity = getDefaultRegionalTradeDraftQuantity(opportunity),
): RegionalTradeDraft {
  const normalizedQuantity = clampRegionalTradeDraftQuantity(
    quantity,
    opportunity.estimatedTradableUnits,
  );

  return {
    resourceId: opportunity.resourceId,
    buyContextKey: opportunity.buyContextKey,
    sellContextKey: opportunity.sellContextKey,
    buyPricePerUnit: opportunity.buyPrice,
    sellPricePerUnit: opportunity.sellPrice,
    transferCostPerUnit: opportunity.estimatedTransferCostPerUnit,
    netSpreadPerUnit: opportunity.netSpreadPerUnit,
    estimatedTradableUnits: opportunity.estimatedTradableUnits,
    quantity: normalizedQuantity,
    estimatedPurchaseCost: opportunity.buyPrice * normalizedQuantity,
    estimatedTransferCost: opportunity.estimatedTransferCostPerUnit * normalizedQuantity,
    estimatedRevenue: opportunity.sellPrice * normalizedQuantity,
    estimatedNetProfit: opportunity.netSpreadPerUnit * normalizedQuantity,
  };
}

export function getRegionalTradeRequiredCapital(draft: RegionalTradeDraft) {
  return draft.estimatedPurchaseCost + draft.estimatedTransferCost;
}

export function resetSimulatedRegionalTradeCapital() {
  return DEFAULT_SIMULATED_TRADE_CAPITAL;
}

export function getDefaultRegionalTradeSimulationState(): RegionalTradeSimulationState {
  return {
    capital: resetSimulatedRegionalTradeCapital(),
    recentSimulations: [],
  };
}

function getGoalProgress(current: number, target: number) {
  return Math.max(0, Math.min(1, current / Math.max(target, 1)));
}

export function simulateRegionalTradeDraft(
  draft: RegionalTradeDraft,
  capitalBefore: number,
  occurredAt = new Date().toISOString(),
): RegionalTradeSimulationResult {
  const capitalAfter = capitalBefore - draft.estimatedPurchaseCost - draft.estimatedTransferCost + draft.estimatedRevenue;

  return {
    id: `${draft.resourceId}-${draft.buyContextKey}-${draft.sellContextKey}-${occurredAt}`,
    occurredAt,
    resourceId: draft.resourceId,
    buyContextKey: draft.buyContextKey,
    sellContextKey: draft.sellContextKey,
    quantity: draft.quantity,
    estimatedPurchaseCost: draft.estimatedPurchaseCost,
    estimatedTransferCost: draft.estimatedTransferCost,
    estimatedRevenue: draft.estimatedRevenue,
    estimatedNetProfit: draft.estimatedNetProfit,
    capitalBefore,
    capitalAfter,
  };
}

export function resolveRegionalTradeSimulation(
  draft: RegionalTradeDraft,
  capitalBefore: number,
  occurredAt = new Date().toISOString(),
): RegionalTradeCapitalSimulation | RegionalTradeCapitalFailure {
  const requiredCapital = getRegionalTradeRequiredCapital(draft);

  if (capitalBefore < requiredCapital) {
    return {
      ok: false,
      capitalBefore,
      requiredCapital,
    };
  }

  return {
    ok: true,
    capitalBefore,
    capitalAfter: capitalBefore - requiredCapital + draft.estimatedRevenue,
    result: simulateRegionalTradeDraft(draft, capitalBefore, occurredAt),
  };
}

export function pushRegionalTradeSimulationHistory(
  history: RegionalTradeSimulationResult[],
  result: RegionalTradeSimulationResult,
  limit = DEFAULT_REGIONAL_SIMULATION_HISTORY_LIMIT,
) {
  // MVP assumption: keep only a short in-memory feed of the latest simulations
  // so the dashboard stays lightweight and obviously non-persistent.
  return [result, ...history].slice(0, limit);
}

function isRegionalTradeSimulationResult(value: unknown): value is RegionalTradeSimulationResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.occurredAt === 'string' &&
    typeof candidate.resourceId === 'string' &&
    typeof candidate.buyContextKey === 'string' &&
    typeof candidate.sellContextKey === 'string' &&
    typeof candidate.quantity === 'number' &&
    typeof candidate.estimatedPurchaseCost === 'number' &&
    typeof candidate.estimatedTransferCost === 'number' &&
    typeof candidate.estimatedRevenue === 'number' &&
    typeof candidate.estimatedNetProfit === 'number' &&
    typeof candidate.capitalBefore === 'number' &&
    typeof candidate.capitalAfter === 'number'
  );
}

export function restoreRegionalTradeSimulationState(
  storage: StorageLike | null | undefined,
): RegionalTradeSimulationState {
  const defaults = getDefaultRegionalTradeSimulationState();

  if (!storage) {
    return defaults;
  }

  try {
    const rawValue = storage.getItem(REGIONAL_TRADE_SIMULATION_STORAGE_KEY);

    if (!rawValue) {
      return defaults;
    }

    const parsed = JSON.parse(rawValue) as Partial<RegionalTradeSimulationState>;
    const capital =
      typeof parsed.capital === 'number' && Number.isFinite(parsed.capital) && parsed.capital >= 0
        ? parsed.capital
        : defaults.capital;
    const recentSimulations = Array.isArray(parsed.recentSimulations)
      ? parsed.recentSimulations
          .filter(isRegionalTradeSimulationResult)
          .slice(0, DEFAULT_REGIONAL_SIMULATION_HISTORY_LIMIT)
      : defaults.recentSimulations;

    return {
      capital,
      recentSimulations,
    };
  } catch {
    return defaults;
  }
}

export function persistRegionalTradeSimulationState(
  storage: StorageLike | null | undefined,
  state: RegionalTradeSimulationState,
) {
  if (!storage) {
    return;
  }

  storage.setItem(
    REGIONAL_TRADE_SIMULATION_STORAGE_KEY,
    JSON.stringify({
      capital: state.capital,
      recentSimulations: state.recentSimulations.slice(
        0,
        DEFAULT_REGIONAL_SIMULATION_HISTORY_LIMIT,
      ),
    }),
  );
}

export function resetRegionalTradeSimulationState(
  storage: StorageLike | null | undefined,
): RegionalTradeSimulationState {
  // MVP rule: resetting the simulated capital also clears the local route history
  // so the player returns to a clean sandbox session after refresh or replay.
  const defaults = getDefaultRegionalTradeSimulationState();

  if (storage) {
    storage.removeItem(REGIONAL_TRADE_SIMULATION_STORAGE_KEY);
  }

  return defaults;
}

export function getRegionalTradeSessionProgress(
  state: RegionalTradeSimulationState,
  goals = DEFAULT_REGIONAL_TRADE_SESSION_GOALS,
): RegionalTradeSessionProgress {
  const profitableTradesCurrent = state.recentSimulations.filter(
    (entry) => entry.estimatedNetProfit > 0,
  ).length;
  const cumulativeProfitCurrent = state.recentSimulations.reduce(
    (sum, entry) => sum + Math.max(0, entry.estimatedNetProfit),
    0,
  );

  const capitalCompleted = state.capital >= goals.capitalTarget;
  const profitableTradesCompleted =
    profitableTradesCurrent >= goals.profitableTradesTarget;
  const cumulativeProfitCompleted =
    cumulativeProfitCurrent >= goals.cumulativeProfitTarget;
  const completedGoals = [
    capitalCompleted,
    profitableTradesCompleted,
    cumulativeProfitCompleted,
  ].filter(Boolean).length;

  return {
    goals,
    capital: {
      current: state.capital,
      target: goals.capitalTarget,
      progress: getGoalProgress(state.capital, goals.capitalTarget),
      completed: capitalCompleted,
    },
    profitableTrades: {
      current: profitableTradesCurrent,
      target: goals.profitableTradesTarget,
      progress: getGoalProgress(profitableTradesCurrent, goals.profitableTradesTarget),
      completed: profitableTradesCompleted,
    },
    cumulativeProfit: {
      current: cumulativeProfitCurrent,
      target: goals.cumulativeProfitTarget,
      progress: getGoalProgress(cumulativeProfitCurrent, goals.cumulativeProfitTarget),
      completed: cumulativeProfitCompleted,
    },
    completedGoals,
    totalGoals: 3,
    isCompleted: completedGoals === 3,
  };
}
