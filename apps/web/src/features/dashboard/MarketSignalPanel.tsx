import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { PageCard } from '@industrial-dominion/ui';
import type {
  InventoryEntry,
  RegionId,
  ResourceId,
} from '@industrial-dominion/shared';
import { getMarketSignals } from './dashboard-api';
import type { MarketSignal } from './dashboard-api';

interface MarketSignalPanelProps {
  accessToken: string;
  inventory: InventoryEntry[];
  regionId: RegionId;
}

function getSignalSeverityClasses(severity: MarketSignal['severity']) {
  switch (severity) {
    case 'warning':
      return 'border-rose-400/30 bg-rose-400/5 text-rose-300';
    case 'caution':
      return 'border-amber-400/30 bg-amber-400/5 text-amber-300';
    case 'info':
      return 'border-slate-700 bg-slate-800/50 text-slate-300';
  }
}

function getSignalSeverityLabel(severity: MarketSignal['severity']) {
  switch (severity) {
    case 'warning':
      return 'dashboard.signalSeverityWarning';
    case 'caution':
      return 'dashboard.signalSeverityCaution';
    case 'info':
      return 'dashboard.signalSeverityInfo';
  }
}

export function MarketSignalPanel({
  accessToken,
  inventory,
  regionId,
}: MarketSignalPanelProps) {
  const { t } = useTranslation();

  const [selectedResource, setSelectedResource] = useState<ResourceId | ''>('');
  const [quantity, setQuantity] = useState<number>(10);
  const [signals, setSignals] = useState<MarketSignal[]>([]);

  const signalsMutation = useMutation({
    mutationFn: () =>
      getMarketSignals({
        accessToken,
        resource: selectedResource as ResourceId,
        quantity,
        region: regionId,
      }),
    onSuccess: (data) => {
      setSignals(data.signals);
    },
  });

  const handleRead = useCallback(() => {
    if (!selectedResource || quantity <= 0) return;
    setSignals([]);
    signalsMutation.mutate();
  }, [selectedResource, quantity, signalsMutation]);

  const tradableInventory = inventory.filter((e) => e.quantity > 0);

  return (
    <PageCard>
      <div className="text-sm text-slate-400">
        {t('dashboard.signalPanelTitle')}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {t('dashboard.signalPanelSubtitle')}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-slate-500">
            {t('dashboard.signalPanelResource')}
          </label>
          <select
            value={selectedResource}
            onChange={(e) =>
              setSelectedResource(e.target.value as ResourceId | '')
            }
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
          >
            <option value="">{t('dashboard.signalPanelSelectResource')}</option>
            {tradableInventory.map((entry) => (
              <option key={entry.resourceId} value={entry.resourceId}>
                {t(`resources.${entry.resourceId}.name`)}
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label className="block text-xs text-slate-500">
            {t('dashboard.signalPanelQuantity')}
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
          onClick={handleRead}
          disabled={
            !selectedResource || quantity <= 0 || signalsMutation.isPending
          }
          className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {signalsMutation.isPending
            ? t('dashboard.signalPanelReading')
            : t('dashboard.signalPanelRead')}
        </button>
      </div>

      {signalsMutation.isError ? (
        <div className="mt-3 text-sm text-rose-300">
          {t('dashboard.signalPanelError')}
        </div>
      ) : null}

      {signals.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {t('dashboard.signalPanelResults')}
          </div>
          {signals.map((signal, idx) => (
            <div
              key={`${signal.key}-${idx}`}
              className={`rounded-xl border px-4 py-3 ${getSignalSeverityClasses(signal.severity)}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wider opacity-70">
                  {t(getSignalSeverityLabel(signal.severity))}
                </span>
              </div>
              <div className="mt-1 text-sm">
                {t(
                  `dashboard.signal.${signal.key}`,
                  signal.params as Record<string, string>,
                )}
              </div>
            </div>
          ))}
        </div>
      ) : signals.length === 0 && signalsMutation.isSuccess ? (
        <div className="mt-4 text-sm text-slate-400">
          {t('dashboard.signalPanelNoSignals')}
        </div>
      ) : null}
    </PageCard>
  );
}
