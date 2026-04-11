const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'apps', 'web', 'src', 'features', 'dashboard', 'action-executor.ts');

const content = `import type {
  LedgerFeedEntry,
  MarketContextKey,
  ResourceId,
} from '@industrial-dominion/shared';
import type { RegionalTradeSimulationResult } from './regional-trade-draft';
import type { TransformationOpportunityDraft } from './transformation-opportunities';

export type CommittedActionType = 'regional_trade' | 'transformation';

interface CommittedActionBase {
  id: string;
  type: CommittedActionType;
  committedAt: string;
  capitalBefore: number;
  capitalAfter: number;
  ledgerEntry: LedgerFeedEntry;
}

export interface CommittedRegionalTrade extends CommittedActionBase {
  type: 'regional_trade';
  resourceId: ResourceId;
  buyContextKey: MarketContextKey;
  sellContextKey: MarketContextKey;
  quantity: number;
  estimatedNetProfit: number;
}

export interface CommittedTransformation extends CommittedActionBase {
  type: 'transformation';
  inputResourceId: ResourceId;
  outputResourceId: ResourceId;
  runs: number;
  estimatedNetProfit: number;
}

export type CommittedAction = CommittedRegionalTrade | CommittedTransformation;

export interface ActionExecutorState {
  committedActions: CommittedAction[];
}

export interface ActionExecutorResult {
  action: CommittedAction;
  capitalDelta: number;
}

export const ACTION_EXECUTOR_STORAGE_KEY = 'industrial-dominion.action-executor';
export const DEFAULT_COMMITTED_ACTIONS_LIMIT = 20;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function executeRegionalTrade(
  simulation: RegionalTradeSimulationResult,
  currentCapital: number,
  timestamp: string = new Date().toISOString(),
): ActionExecutorResult {
  const capitalDelta = simulation.estimatedNetProfit;
  const capitalAfter = currentCapital + capitalDelta;
  const ledgerEntry: LedgerFeedEntry = {
    id: 'committed-' + timestamp + '-' + Math.random().toString(36).slice(2, 8),
    actionType: 'market_sell',
    amount: simulation.estimatedNetProfit,
    resourceId: simulation.resourceId,
    createdAt: timestamp,
    metadata: {
      buyContextKey: simulation.buyContextKey,
      sellContextKey: simulation.sellContextKey,
      quantity: simulation.quantity,
      source: 'committed',
    },
  };
  const action: CommittedRegionalTrade = {
    id: 'committed-trade-' + timestamp + '-' + Math.random().toString(36).slice(2, 8),
    type: 'regional_trade',
    committedAt: timestamp,
    capitalBefore: currentCapital,
    capitalAfter,
    ledgerEntry,
    resourceId: simulation.resourceId,
    buyContextKey: simulation.buyContextKey,
    sellContextKey: simulation.sellContextKey,
    quantity: simulation.quantity,
    estimatedNetProfit: simulation.estimatedNetProfit,
  };
  return { action, capitalDelta };
}

export function executeTransformation(
  draft: TransformationOpportunityDraft,
  currentCapital: number,
  timestamp: string = new Date().toISOString(),
): ActionExecutorResult {
  const capitalDelta = draft.estimatedNetProfit;
  const capitalAfter = currentCapital + capitalDelta;
  const ledgerEntry: LedgerFeedEntry = {
    id: 'committed-' + timestamp + '-' + Math.random().toString(36).slice(2, 8),
    actionType: 'production_completed',
    amount: draft.estimatedNetProfit,
    resourceId: draft.outputResourceId,
    createdAt: timestamp,
    metadata: {
      inputResourceId: draft.inputResourceId,
      outputResourceId: draft.outputResourceId,
      runs: draft.runs,
      source: 'committed',
    },
  };
  const action: CommittedTransformation = {
    id: 'committed-transform-' + timestamp + '-' + Math.random().toString(36).slice(2, 8),
    type: 'transformation',
    committedAt: timestamp,
    capitalBefore: currentCapital,
    capitalAfter,
    ledgerEntry,
    inputResourceId: draft.inputResourceId,
    outputResourceId: draft.outputResourceId,
    runs: draft.runs,
    estimatedNetProfit: draft.estimatedNetProfit,
  };
  return { action, capitalDelta };
}

export function pushCommittedAction(
  state: ActionExecutorState,
  result: ActionExecutorResult,
  limit: number = DEFAULT_COMMITTED_ACTIONS_LIMIT,
): ActionExecutorState {
  return {
    committedActions: [result.action, ...state.committedActions].slice(0, limit),
  };
}

export function getCommittedLedgerEntries(actions: CommittedAction[]): LedgerFeedEntry[] {
  return actions.map((action) => action.ledgerEntry);
}

export function getCommittedCapitalDelta(actions: CommittedAction[]): number {
  if (actions.length === 0) return 0;
  return actions.reduce((sum, action) => sum + (action.capitalAfter - action.capitalBefore), 0);
}

export function getDefaultActionExecutorState(): ActionExecutorState {
  return { committedActions: [] };
}

function isCommittedAction(value: unknown): value is CommittedAction {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.committedAt === 'string' &&
    typeof candidate.capitalBefore === 'number' &&
    typeof candidate.capitalAfter === 'number' &&
    typeof candidate.ledgerEntry === 'object'
  );
}

export function restoreActionExecutorState(
  storage: StorageLike | null | undefined,
): ActionExecutorState {
  const defaults = getDefaultActionExecutorState();
  if (!storage) return defaults;
  try {
    const rawValue = storage.getItem(ACTION_EXECUTOR_STORAGE_KEY);
    if (!rawValue) return defaults;
    const parsed = JSON.parse(rawValue) as Partial<ActionExecutorState>;
    const committedActions = Array.isArray(parsed.committedActions)
      ? parsed.committedActions.filter(isCommittedAction).slice(0, DEFAULT_COMMITTED_ACTIONS_LIMIT)
      : defaults.committedActions;
    return { committedActions };
  } catch {
    return defaults;
  }
}

export function persistActionExecutorState(
  storage: StorageLike | null | undefined,
  state: ActionExecutorState,
): void {
  if (!storage) return;
  storage.setItem(
    ACTION_EXECUTOR_STORAGE_KEY,
    JSON.stringify({
      committedActions: state.committedActions.slice(0, DEFAULT_COMMITTED_ACTIONS_LIMIT),
    }),
  );
}

export function resetActionExecutorState(
  storage: StorageLike | null | undefined,
): ActionExecutorState {
  if (storage) {
    storage.removeItem(ACTION_EXECUTOR_STORAGE_KEY);
  }
  return getDefaultActionExecutorState();
}
`;

fs.writeFileSync(filePath, content, 'utf8');
console.log('Created action-executor.ts successfully');
