import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { PageCard } from '@industrial-dominion/ui';
import type {
  InventoryEntry,
  RegionId,
  ResourceId,
  StrategyResult,
} from '@industrial-dominion/shared';
import { starterRegionIds } from '@industrial-dominion/shared';
import { batchAnalyzeDecision } from './dashboard-api';
import { useFormatters } from '@/i18n/useFormatters';
import {
  getStrategyLabelKey,
  formatTimeSeconds,
  formatRoi,
} from './decision-format';

interface VipAnalysisPanelProps {
  accessToken: string;
  inventory: InventoryEntry[];
  regionId: RegionId;
}

const DEFAULT_QUANTITY_TIERS = [10, 50, 100, 500];

type FilterKey = 'roi' | 'net' | 'time';

export function VipAnalysisPanel({
  accessToken,
  inventory,
  regionId,
}: VipAnalysisPanelProps) {
  const { t } = useTranslation();
  const { formatCurrency, formatNumber } = useFormatters();

  const [selectedResource, setSelectedResource] = useState<ResourceId | ''>('');
  const [selectedRegions, setSelectedRegions] = useState<Set<RegionId>>(
    new Set([regionId]),
  );
  const [quantityInput, setQuantityInput] = useState<string>(
    DEFAULT_QUANTITY_TIERS.join(', '),
  );

  const [filterMinRoi, setFilterMinRoi] = useState<number>(0);
  const [filterMinNet, setFilterMinNet] = useState<number>(0);
  const [filterMaxTime, setFilterMaxTime] = useState<number>(Infinity);
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);

  const [result, setResult] = useState<{
    analyses: {
      resource: ResourceId;
      quantity: number;
      region: RegionId;
      snapshot: { ranked: StrategyResult[] };
    }[];
  } | null>(null);

  const parseQuantities = useCallback((): number[] => {
    return quantityInput
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
  }, [quantityInput]);

  const batchMutation = useMutation({
    mutationFn: () =>
      batchAnalyzeDecision({
        accessToken,
        resource: selectedResource as ResourceId,
        quantities: parseQuantities(),
        regions: Array.from(selectedRegions),
      }),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleAnalyze = useCallback(() => {
    if (!selectedResource) return;
    const quantities = parseQuantities();
    if (quantities.length === 0 || selectedRegions.size === 0) return;
    setResult(null);
    batchMutation.mutate();
  }, [selectedResource, parseQuantities, selectedRegions, batchMutation]);

  const toggleRegion = useCallback((region: RegionId) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  }, []);

  const tradableInventory = inventory.filter((e) => e.quantity > 0);

  const filteredAnalyses = useMemo(() => {
    if (!result) return [];
    return result.analyses.map((entry) => ({
      ...entry,
      snapshot: {
        ranked: entry.snapshot.ranked.filter((s) => {
          if (s.roi * 100 < filterMinRoi) return false;
          if (s.net < filterMinNet) return false;
          if (filterMaxTime !== Infinity && s.time > filterMaxTime)
            return false;
          return true;
        }),
      },
    }));
  }, [result, filterMinRoi, filterMinNet, filterMaxTime]);

  return (
    <PageCard>
      <div className="text-sm text-slate-400">
        {t('dashboard.vipAnalysisTitle')}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {t('dashboard.vipAnalysisSubtitle')}
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs text-slate-500">
            {t('dashboard.vipAnalysisResource')}
          </label>
          <select
            value={selectedResource}
            onChange={(e) =>
              setSelectedResource(e.target.value as ResourceId | '')
            }
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">{t('dashboard.vipAnalysisSelectResource')}</option>
            {tradableInventory.map((entry) => (
              <option key={entry.resourceId} value={entry.resourceId}>
                {t(`resources.${entry.resourceId}.name`)} (
                {formatNumber(entry.quantity)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-500">
            {t('dashboard.vipAnalysisRegions')}
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            {starterRegionIds.map((rid) => (
              <label
                key={rid}
                className="flex cursor-pointer items-center gap-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedRegions.has(rid)}
                  onChange={() => toggleRegion(rid)}
                  className="rounded border-slate-600 bg-slate-800 text-amber-400 focus:ring-amber-400/30"
                />
                <span className="text-slate-300">
                  {t(`regions.${rid}.name`)}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500">
            {t('dashboard.vipAnalysisQuantities')}
          </label>
          <input
            type="text"
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          />
          <div className="mt-1 flex gap-1">
            {DEFAULT_QUANTITY_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setQuantityInput(String(tier))}
                className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:border-slate-500"
              >
                {tier}
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                setQuantityInput(DEFAULT_QUANTITY_TIERS.join(', '))
              }
              className="rounded-full border border-amber-400/30 px-2 py-0.5 text-xs text-amber-400 hover:border-amber-400"
            >
              {t('dashboard.vipAnalysisAllTiers')}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={
            !selectedResource ||
            selectedRegions.size === 0 ||
            parseQuantities().length === 0 ||
            batchMutation.isPending
          }
          className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {batchMutation.isPending
            ? t('dashboard.vipAnalysisAnalyzing')
            : t('dashboard.vipAnalysisRun')}
        </button>
      </div>

      {batchMutation.isError ? (
        <div className="mt-3 text-sm text-rose-300">
          {t('dashboard.vipAnalysisError')}
        </div>
      ) : null}

      {filteredAnalyses.length > 0 ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {t('dashboard.vipAnalysisFilterLabel')}
            </span>
            <button
              type="button"
              onClick={() =>
                setActiveFilter(activeFilter === 'roi' ? null : 'roi')
              }
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeFilter === 'roi'
                  ? 'border border-amber-400/30 text-amber-400'
                  : 'border border-slate-700 text-slate-400'
              }`}
            >
              {t('dashboard.vipAnalysisFilterRoi')}
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveFilter(activeFilter === 'net' ? null : 'net')
              }
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeFilter === 'net'
                  ? 'border border-amber-400/30 text-amber-400'
                  : 'border border-slate-700 text-slate-400'
              }`}
            >
              {t('dashboard.vipAnalysisFilterNet')}
            </button>
            <button
              type="button"
              onClick={() =>
                setActiveFilter(activeFilter === 'time' ? null : 'time')
              }
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeFilter === 'time'
                  ? 'border border-amber-400/30 text-amber-400'
                  : 'border border-slate-700 text-slate-400'
              }`}
            >
              {t('dashboard.vipAnalysisFilterTime')}
            </button>
          </div>

          {activeFilter === 'roi' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {t('dashboard.vipAnalysisMinRoi')}
              </span>
              <input
                type="number"
                min={0}
                value={filterMinRoi}
                onChange={(e) => setFilterMinRoi(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
              <span className="text-xs text-slate-500">%</span>
            </div>
          ) : null}
          {activeFilter === 'net' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {t('dashboard.vipAnalysisMinNet')}
              </span>
              <input
                type="number"
                min={0}
                value={filterMinNet}
                onChange={(e) => setFilterMinNet(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
            </div>
          ) : null}
          {activeFilter === 'time' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {t('dashboard.vipAnalysisMaxTime')}
              </span>
              <input
                type="number"
                min={0}
                value={filterMaxTime === Infinity ? '' : filterMaxTime}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFilterMaxTime(isNaN(v) || v <= 0 ? Infinity : v);
                }}
                className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              />
              <span className="text-xs text-slate-500">
                {t('dashboard.vipAnalysisMaxTimeUnit')}
              </span>
            </div>
          ) : null}

          {filteredAnalyses.map((entry, idx) => (
            <div
              key={`${entry.region}-${entry.quantity}-${idx}`}
              className="overflow-hidden rounded-2xl border border-slate-800"
            >
              <div className="flex items-center gap-2 bg-slate-900/50 px-4 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
                  {t(`regions.${entry.region}.name`)}
                </span>
                <span className="text-xs text-slate-500">
                  {t('dashboard.vipAnalysisQuantityLabel', {
                    quantity: formatNumber(entry.quantity),
                  })}
                </span>
                <span className="text-xs text-slate-600">
                  {t('dashboard.vipAnalysisStrategiesCount', {
                    count: entry.snapshot.ranked.length,
                  })}
                </span>
              </div>
              {entry.snapshot.ranked.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">
                  {t('dashboard.vipAnalysisNoStrategies')}
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {entry.snapshot.ranked.map((strategy, sIdx) => (
                    <div
                      key={`${strategy.strategy}-${sIdx}`}
                      className="flex items-center justify-between px-4 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                          {t(getStrategyLabelKey(strategy.strategy))}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-slate-500">
                            {t('dashboard.decisionNetLabel')}{' '}
                          </span>
                          <span
                            className={
                              strategy.net > 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }
                          >
                            {formatCurrency(strategy.net)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">
                            {t('dashboard.decisionRoiLabel')}{' '}
                          </span>
                          <span className="text-slate-200">
                            {formatRoi(strategy.roi)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">
                            {t('dashboard.decisionTimeLabel')}{' '}
                          </span>
                          <span className="text-slate-200">
                            {formatTimeSeconds(strategy.time, t)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : result && result.analyses.length > 0 ? (
        <div className="mt-4 text-sm text-slate-400">
          {t('dashboard.vipAnalysisAllFiltered')}
        </div>
      ) : null}
    </PageCard>
  );
}
