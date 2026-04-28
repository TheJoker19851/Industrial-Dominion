import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageCard } from '@industrial-dominion/ui';
import type {
  EconomicDecisionSnapshot,
  InventoryEntry,
  RegionId,
  ResourceId,
  StrategyResult,
} from '@industrial-dominion/shared';
import {
  previewEconomicDecision,
  executeDecision,
  getDecisionHistory,
  type DecisionExecutionResult,
  type DecisionHistoryEntry,
} from './dashboard-api';
import { useFormatters } from '@/i18n/useFormatters';
import {
  getStrategyLabelKey,
  getExplanationKey,
  getExplanationParams,
  formatTimeSeconds,
  formatRoi,
  getActionSteps,
} from './decision-format';

interface EconomicDecisionPanelProps {
  accessToken: string;
  inventory: InventoryEntry[];
  regionId: RegionId;
}

export function EconomicDecisionPanel({
  accessToken,
  inventory,
  regionId,
}: EconomicDecisionPanelProps) {
  const { t } = useTranslation();
  const { formatCurrency, formatNumber } = useFormatters();
  const queryClient = useQueryClient();

  const [selectedResource, setSelectedResource] = useState<ResourceId | ''>('');
  const [quantity, setQuantity] = useState<number>(10);
  const [snapshot, setSnapshot] = useState<EconomicDecisionSnapshot | null>(
    null,
  );
  const [preparingStrategy, setPreparingStrategy] =
    useState<StrategyResult | null>(null);
  const [confirmedSteps, setConfirmedSteps] = useState<Set<string>>(new Set());
  const [executionResult, setExecutionResult] =
    useState<DecisionExecutionResult | null>(null);

  const historyQuery = useQuery({
    queryKey: ['decision-history', accessToken],
    queryFn: () => getDecisionHistory({ accessToken, limit: 10 }),
    enabled: !!accessToken,
  });

  const analysisMutation = useMutation({
    mutationFn: () =>
      previewEconomicDecision({
        accessToken,
        resource: selectedResource as ResourceId,
        quantity,
        region: regionId,
      }),
    onSuccess: (data) => {
      setSnapshot(data);
      setPreparingStrategy(null);
      setConfirmedSteps(new Set());
      setExecutionResult(null);
    },
  });

  const executeMutation = useMutation({
    mutationFn: (strategy: StrategyResult) => {
      const destRegion = strategy.strategy === 'TRANSPORT_AND_SELL' ||
        strategy.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL'
        ? (strategy.breakdown as { destinationRegion: RegionId }).destinationRegion
        : undefined;
      return executeDecision({
        accessToken,
        strategy: strategy.strategy as
          | 'SELL_LOCAL'
          | 'PROCESS_AND_SELL_LOCAL'
          | 'TRANSPORT_AND_SELL'
          | 'PROCESS_THEN_TRANSPORT_AND_SELL',
        resource: strategy.resource,
        quantity: strategy.quantity,
        region: strategy.region,
        destinationRegion: destRegion,
      });
    },
    onSuccess: (data) => {
      setExecutionResult(data);
      queryClient.invalidateQueries({ queryKey: ['decision-history'] });
    },
  });

  const handleAnalyze = useCallback(() => {
    if (!selectedResource || quantity <= 0) return;
    setSnapshot(null);
    setPreparingStrategy(null);
    setConfirmedSteps(new Set());
    analysisMutation.mutate();
  }, [selectedResource, quantity, analysisMutation]);

  const handlePrepare = useCallback((strategy: StrategyResult) => {
    setPreparingStrategy(strategy);
    setConfirmedSteps(new Set());
  }, []);

  const handleDismissPrepare = useCallback(() => {
    setPreparingStrategy(null);
    setConfirmedSteps(new Set());
    setExecutionResult(null);
  }, []);

  const handleExecute = useCallback(
    (strategy: StrategyResult) => {
      executeMutation.mutate(strategy);
    },
    [executeMutation],
  );

  const handleToggleStep = useCallback((stepKey: string) => {
    setConfirmedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepKey)) {
        next.delete(stepKey);
      } else {
        next.add(stepKey);
      }
      return next;
    });
  }, []);

  const tradableInventory = inventory.filter((e) => e.quantity > 0);
  const bestStrategy = snapshot?.ranked?.[0];
  const alternatives = snapshot?.ranked?.slice(1) ?? [];

  const renderStrategyCard = (
    strategy: StrategyResult,
    isBest: boolean,
    index?: number,
  ) => {
    const steps = getActionSteps(strategy, { t, formatNumber });
    const isPreparing = preparingStrategy === strategy;
    const isExecutable = strategy.strategy === 'SELL_LOCAL' || strategy.strategy === 'PROCESS_AND_SELL_LOCAL' || strategy.strategy === 'TRANSPORT_AND_SELL' || strategy.strategy === 'PROCESS_THEN_TRANSPORT_AND_SELL';

    return (
      <div
        key={`${strategy.strategy}-${index ?? 'best'}`}
        className={`overflow-hidden rounded-2xl ${
          isBest
            ? 'border-l-4 border-l-amber-400 border border-amber-400/30 bg-amber-400/5'
            : 'border border-slate-800 bg-slate-900/30'
        }`}
      >
        <div className="px-5 py-4">
          <div className="flex items-center gap-2">
            {isBest ? (
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                {t('dashboard.decisionBestLabel')}
              </span>
            ) : (
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                {t('dashboard.decisionAlternativeLabel')}
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                isBest
                  ? 'bg-amber-400/20 font-semibold text-amber-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {t(getStrategyLabelKey(strategy.strategy))}
            </span>
            {!isExecutable && (
              <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                {t('dashboard.decisionPreviewOnly')}
              </span>
            )}
          </div>
          <div
            className={`mt-2.5 text-sm leading-relaxed ${isBest ? 'text-slate-200' : 'text-slate-400'}`}
          >
            {t(
              getExplanationKey(strategy),
              getExplanationParams(strategy, {
                t,
                formatCurrency,
                formatNumber,
              }),
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs font-medium text-slate-500">
                {t('dashboard.decisionNetLabel')}
              </div>
              <div
                className={`mt-1 text-lg font-bold ${strategy.net > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {formatCurrency(strategy.net)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">
                {t('dashboard.decisionRoiLabel')}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-200">
                {formatRoi(strategy.roi)}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">
                {t('dashboard.decisionTimeLabel')}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-200">
                {formatTimeSeconds(strategy.time, t)}
              </div>
            </div>
          </div>

          {!isExecutable ? (
            <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3">
              <div className="text-xs text-slate-500">
                {t('dashboard.decisionPreviewOnlyHint')}
              </div>
            </div>
          ) : !isPreparing ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => handlePrepare(strategy)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  isBest
                    ? 'border border-amber-400/30 text-amber-300 hover:bg-amber-400/10'
                    : 'border border-slate-600 text-slate-300 hover:border-slate-400'
                }`}
              >
                {t('dashboard.decisionActionPrepare')}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
                {t('dashboard.decisionActionPrepareTitle')}
              </div>
              <div className="text-xs text-slate-500">
                {t('dashboard.decisionActionPrepareHint')}
              </div>
              <div className="space-y-2">
                {steps.map((step) => (
                  <label
                    key={step.key}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={confirmedSteps.has(step.key)}
                      onChange={() => handleToggleStep(step.key)}
                      className="mt-1 rounded border-slate-600 bg-slate-800 text-amber-400 focus:ring-amber-400/30"
                    />
                    <span
                      className={
                        confirmedSteps.has(step.key)
                          ? 'text-slate-400 line-through'
                          : 'text-slate-200'
                      }
                    >
                      {t(step.labelKey, step.params)}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExecute(strategy)}
                  disabled={
                    confirmedSteps.size < steps.length ||
                    executeMutation.isPending
                  }
                  className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                >
                  {executeMutation.isPending
                    ? t('dashboard.decisionActionExecuting')
                    : t('dashboard.decisionActionExecute')}
                </button>
                <button
                  type="button"
                  onClick={handleDismissPrepare}
                  className="rounded-full border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-400"
                >
                  {t('dashboard.decisionActionDismiss')}
                </button>
              </div>
              {executeMutation.isError ? (
                <div className="mt-2 text-xs text-rose-300">
                  {t('dashboard.decisionActionExecuteError')}
                </div>
              ) : null}
              {executionResult && preparingStrategy === strategy ? (
                <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    {t('dashboard.decisionActionExecuted')}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-slate-500">
                        {t('dashboard.decisionGrossLabel')}:
                      </span>{' '}
                      <span className="text-slate-300">
                        {formatCurrency(executionResult.grossAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">
                        {t('dashboard.decisionNetLabel')}:
                      </span>{' '}
                      <span
                        className={
                          executionResult.netAmount > 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        {formatCurrency(executionResult.netAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">
                        {t('dashboard.decisionFeeLabel')}:
                      </span>{' '}
                      <span className="text-slate-300">
                        {formatCurrency(executionResult.feeAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">
                        {t('dashboard.decisionCreditsLabel')}:
                      </span>{' '}
                      <span className="text-slate-200">
                        {formatCurrency(executionResult.playerCredits)}
                      </span>
                    </div>
                    {executionResult.transportCost != null && executionResult.transportCost > 0 ? (
                      <div>
                        <span className="text-slate-500">
                          {t('dashboard.decisionTransportCostLabel')}:
                        </span>{' '}
                        <span className="text-rose-400">
                          -{formatCurrency(executionResult.transportCost)}
                        </span>
                      </div>
                    ) : null}
                    {executionResult.destinationRegion ? (
                      <div>
                        <span className="text-slate-500">
                          {t('dashboard.decisionDestinationLabel')}:
                        </span>{' '}
                        <span className="text-slate-200">
                          {t(`regions.${executionResult.destinationRegion}.name`)}
                        </span>
                      </div>
                    ) : null}
                    {executionResult.inputConsumed != null && executionResult.outputProduced != null ? (
                      <div>
                        <span className="text-slate-500">
                          {t('dashboard.decisionProcessedLabel')}:
                        </span>{' '}
                        <span className="text-slate-200">
                          {formatNumber(executionResult.inputConsumed)} → {formatNumber(executionResult.outputProduced)} {executionResult.outputResourceId ? t(`resources.${executionResult.outputResourceId}.name`) : ''}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <PageCard>
      <div className="text-sm text-slate-400">
        {t('dashboard.decisionPanelTitle')}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {t('dashboard.decisionPanelSubtitle')}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-slate-500">
            {t('dashboard.decisionPanelResource')}
          </label>
          <select
            value={selectedResource}
            onChange={(e) =>
              setSelectedResource(e.target.value as ResourceId | '')
            }
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">
              {t('dashboard.decisionPanelSelectResource')}
            </option>
            {tradableInventory.map((entry) => (
              <option key={entry.resourceId} value={entry.resourceId}>
                {t(`resources.${entry.resourceId}.name`)} (
                {formatNumber(entry.quantity)})
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-xs text-slate-500">
            {t('dashboard.decisionPanelQuantity')}
          </label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          />
        </div>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={
            !selectedResource || quantity <= 0 || analysisMutation.isPending
          }
          className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {analysisMutation.isPending
            ? t('dashboard.decisionPanelAnalyzing')
            : t('dashboard.decisionPanelAnalyze')}
        </button>
      </div>

      {analysisMutation.isError ? (
        <div className="mt-3 text-sm text-rose-300">
          {t('dashboard.decisionPanelError')}
        </div>
      ) : null}

      {snapshot && snapshot.ranked.length === 0 ? (
        <div className="mt-3 text-sm text-slate-300">
          {t('dashboard.decisionPanelNoResults')}
        </div>
      ) : null}

      {bestStrategy ? (
        <div className="mt-5 space-y-5">
          {renderStrategyCard(bestStrategy, true)}

          {alternatives.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {t('dashboard.decisionAlternativesLabel')}
                </div>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              {alternatives.map((strategy, index) =>
                renderStrategyCard(strategy, false, index),
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {renderHistory()}
    </PageCard>
  );

  function renderHistory() {
    const history = historyQuery.data?.history ?? [];
    return (
      <div className="mt-6 border-t border-slate-800 pt-5">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
          {t('dashboard.decisionHistoryTitle')}
        </div>
        {history.length === 0 ? (
          <div className="mt-2 text-xs text-slate-600">
            {t('dashboard.decisionHistoryEmpty')}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((entry: DecisionHistoryEntry) => {
              const resultNet = typeof entry.result?.netAmount === 'number'
                ? entry.result.netAmount as number
                : null;
              const resultOutputResource = typeof entry.result?.outputResourceId === 'string'
                ? entry.result.outputResourceId as string
                : null;
              const resultInputConsumed = typeof entry.result?.inputConsumed === 'number'
                ? entry.result.inputConsumed as number
                : null;
              const resultOutputProduced = typeof entry.result?.outputProduced === 'number'
                ? entry.result.outputProduced as number
                : null;

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>
                      {t('dashboard.decisionHistoryEntry', {
                        strategy: t(getStrategyLabelKey(entry.strategy)),
                        quantity: formatNumber(entry.quantity),
                        resource: t(`resources.${entry.resourceId}.name`),
                      })}
                    </span>
                    {resultNet !== null && (
                      <span className={resultNet > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {formatCurrency(resultNet)}
                      </span>
                    )}
                    {resultInputConsumed != null && resultOutputProduced != null && resultOutputResource && (
                      <span className="text-slate-500">
                        {formatNumber(resultInputConsumed)}→{formatNumber(resultOutputProduced)} {t(`resources.${resultOutputResource}.name`)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        entry.status === 'executed'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {entry.status === 'executed'
                        ? t('dashboard.decisionStatusExecuted')
                        : t('dashboard.decisionStatusRecorded')}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
}
