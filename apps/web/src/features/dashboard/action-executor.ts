/**
 * Action executor – wraps the commit step with a short visual delay
 * and structured feedback so the player feels the moment of impact.
 *
 * This module is frontend-only. It does not call any API.
 */

/** The visual phases a commit action goes through. */
export type CommitPhase = 'idle' | 'committing' | 'committed';

/** Structured result shown after a commit completes. */
export type CommitResult = {
  /** Unique id for React keys and animation triggers. */
  id: string;
  /** ISO timestamp of when the commit was resolved. */
  committedAt: string;
  /** Resource being traded. */
  resourceId: string;
  /** Buy-side market context. */
  buyContextKey: string;
  /** Sell-side market context. */
  sellContextKey: string;
  /** Number of units traded. */
  quantity: number;
  /** Total purchase cost. */
  purchaseCost: number;
  /** Total transfer/logistics cost. */
  transferCost: number;
  /** Total revenue from selling. */
  revenue: number;
  /** Net profit (revenue - purchaseCost - transferCost). */
  netProfit: number;
  /** Capital snapshot before the trade. */
  capitalBefore: number;
  /** Capital snapshot after the trade. */
  capitalAfter: number;
};

/** Minimum delay (ms) before showing the commit result. */
const COMMIT_DELAY_MS = 220;

/**
 * Returns a promise that resolves after the commit visual delay.
 * Use this to create a perceptible pause between the user clicking
 * "Execute" and the result appearing.
 */
export function waitForCommitDelay(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, COMMIT_DELAY_MS);
  });
}

/**
 * Builds a CommitResult from a regional trade simulation result.
 * This creates the structured data used by the enhanced commit feedback UI.
 */
export function buildCommitResultFromSimulation(simulation: {
  id: string;
  occurredAt: string;
  resourceId: string;
  buyContextKey: string;
  sellContextKey: string;
  quantity: number;
  estimatedPurchaseCost: number;
  estimatedTransferCost: number;
  estimatedRevenue: number;
  estimatedNetProfit: number;
  capitalBefore: number;
  capitalAfter: number;
}): CommitResult {
  return {
    id: `commit-${simulation.id}`,
    committedAt: simulation.occurredAt,
    resourceId: simulation.resourceId,
    buyContextKey: simulation.buyContextKey,
    sellContextKey: simulation.sellContextKey,
    quantity: simulation.quantity,
    purchaseCost: simulation.estimatedPurchaseCost,
    transferCost: simulation.estimatedTransferCost,
    revenue: simulation.estimatedRevenue,
    netProfit: simulation.estimatedNetProfit,
    capitalBefore: simulation.capitalBefore,
    capitalAfter: simulation.capitalAfter,
  };
}
