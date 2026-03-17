import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageCard } from '@industrial-dominion/ui';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { getGameplayErrorKey } from '@/features/gameplay/gameplay-error';
import { useFormatters } from '@/i18n/useFormatters';
import {
  buyMarketResource,
  getMarketSnapshot,
  sellMarketResource,
} from './market-api';
import { clampBuyQuantity, clampSellQuantity } from './market-model';

export function MarketPage() {
  const { t } = useTranslation();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { formatCurrency, formatNumber, formatPercentage } = useFormatters();
  const queryClient = useQueryClient();
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const accessToken = session?.access_token;
  const marketQuery = useQuery({
    queryKey: ['market', session?.user.id],
    queryFn: () => getMarketSnapshot(accessToken!),
    enabled: Boolean(accessToken),
  });
  const sellMutation = useMutation({
    mutationFn: (input: { resourceId: Parameters<typeof sellMarketResource>[0]['resourceId']; quantity: number }) =>
      sellMarketResource({
        accessToken: accessToken!,
        resourceId: input.resourceId,
        quantity: input.quantity,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['market', session?.user.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', session?.user.id] }),
        queryClient.invalidateQueries({ queryKey: ['starter-tutorial', session?.user.id] }),
      ]);
    },
  });
  const buyMutation = useMutation({
    mutationFn: (input: {
      resourceId: Parameters<typeof buyMarketResource>[0]['resourceId'];
      quantity: number;
    }) =>
      buyMarketResource({
        accessToken: accessToken!,
        resourceId: input.resourceId,
        quantity: input.quantity,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['market', session?.user.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', session?.user.id] }),
      ]);
    },
  });

  if (isAuthLoading) {
    return <div className="pb-16 text-sm text-slate-300 md:pb-0">{t('market.authLoading')}</div>;
  }

  if (!session) {
    return (
      <div className="space-y-4 pb-16 md:pb-0">
        <h2 className="text-2xl font-bold">{t('market.title')}</h2>
        <PageCard>{t('market.signInRequired')}</PageCard>
      </div>
    );
  }

  if (marketQuery.isLoading) {
    return <div className="pb-16 text-sm text-slate-300 md:pb-0">{t('market.loading')}</div>;
  }

  if (marketQuery.isError) {
    return (
      <div className="pb-16 text-sm text-rose-300 md:pb-0">
        {t(getGameplayErrorKey(marketQuery.error.message))}
      </div>
    );
  }

  const snapshot = marketQuery.data!;

  if (!snapshot.player?.regionId) {
    return (
      <div className="space-y-4 pb-16 md:pb-0">
        <h2 className="text-2xl font-bold">{t('market.title')}</h2>
        <PageCard>
          <div className="space-y-3">
            <div className="text-sm text-slate-300">{t('market.bootstrapRequired')}</div>
            <Link
              to="/onboarding"
              className="inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              {t('market.openOnboarding')}
            </Link>
          </div>
        </PageCard>
      </div>
    );
  }

  const player = snapshot.player;

  return (
    <div className="space-y-4 pb-16 md:pb-0">
      <h2 className="text-2xl font-bold">{t('market.title')}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <PageCard>
          <div className="text-sm text-slate-400">{t('market.credits')}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {formatCurrency(player.credits)}
          </div>
        </PageCard>
        <PageCard>
          <div className="text-sm text-slate-400">{t('market.fee')}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {formatPercentage(snapshot.marketFeeRate)}
          </div>
        </PageCard>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">{t('market.buyTitle')}</h3>
          <p className="mt-1 text-sm text-slate-300">{t('market.buySubtitle')}</p>
        </div>
        <div className="space-y-4">
          {snapshot.offers.map((entry) => {
            const quantity = clampBuyQuantity(
              buyQuantities[entry.resourceId] ?? 1,
            );
            const totalCost = entry.basePrice * quantity;

            return (
              <PageCard key={`buy-${entry.resourceId}`}>
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-slate-50">
                        {t(`resources.${entry.resourceId}.name`)}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {t('market.buyOfferLine')}
                      </div>
                    </div>
                    <div className="text-sm text-slate-300 sm:text-right">
                      <div>{t('market.unitPrice', { price: formatCurrency(entry.basePrice) })}</div>
                      <div>{t('market.buyTotal', { value: formatCurrency(totalCost) })}</div>
                    </div>
                  </div>

                  <label className="block text-sm text-slate-300">
                    {t('market.buyQuantity')}
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(event) => {
                        const nextValue = clampBuyQuantity(Number(event.target.value));

                        setBuyQuantities((current) => ({
                          ...current,
                          [entry.resourceId]: nextValue,
                        }));
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
                    />
                  </label>

                  <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <div>{t('market.buyTotal', { value: formatCurrency(totalCost) })}</div>
                    <div>
                      {t('market.buyBalanceAfter', {
                        value: formatCurrency(player.credits - totalCost),
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      buyMutation.mutate({
                        resourceId: entry.resourceId,
                        quantity,
                      })
                    }
                    disabled={buyMutation.isPending}
                    className="w-full rounded-full border border-accent bg-accent px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {buyMutation.isPending
                      ? t('market.buying')
                      : t('market.buyAction', {
                          quantity: formatNumber(quantity),
                          resource: t(`resources.${entry.resourceId}.name`),
                        })}
                  </button>
                </div>
              </PageCard>
            );
          })}
        </div>
      </div>

      {buyMutation.isSuccess ? (
        <PageCard>
          <div className="text-sm text-emerald-300">
            {t('market.buySuccess', {
              quantity: formatNumber(buyMutation.data.quantityPurchased),
              resource: t(`resources.${buyMutation.data.resourceId}.name`),
              cost: formatCurrency(buyMutation.data.totalCost),
            })}
          </div>
        </PageCard>
      ) : null}

      {buyMutation.isError ? (
        <PageCard>
          <div className="text-sm text-rose-300">
            {t(getGameplayErrorKey(buyMutation.error.message))}
          </div>
        </PageCard>
      ) : null}

      {snapshot.inventory.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">{t('market.sellTitle')}</h3>
            <p className="mt-1 text-sm text-slate-300">{t('market.sellSubtitle')}</p>
          </div>
          {snapshot.inventory.map((entry) => {
            const quantity = clampSellQuantity(
              sellQuantities[entry.resourceId] ?? entry.quantity,
              entry.quantity,
            );

            return (
              <PageCard key={entry.resourceId}>
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold text-slate-50">
                        {t(`resources.${entry.resourceId}.name`)}
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        {t('market.inventoryLine', {
                          quantity: formatNumber(entry.quantity),
                        })}
                      </div>
                    </div>
                    <div className="text-sm text-slate-300 sm:text-right">
                      <div>{t('market.unitPrice', { price: formatCurrency(entry.basePrice) })}</div>
                      <div>{t('market.netValue', { value: formatCurrency(entry.netValue) })}</div>
                    </div>
                  </div>

                  <label className="block text-sm text-slate-300">
                    {t('market.sellQuantity')}
                    <input
                      type="number"
                      min={1}
                      max={entry.quantity}
                      value={quantity}
                      onChange={(event) => {
                        const nextValue = clampSellQuantity(
                          Number(event.target.value),
                          entry.quantity,
                        );

                        setSellQuantities((current) => ({
                          ...current,
                          [entry.resourceId]: nextValue,
                        }));
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
                    />
                  </label>

                  <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                    <div>{t('market.grossPreview', { value: formatCurrency(entry.basePrice * quantity) })}</div>
                    <div>{t('market.feePreview', { value: formatCurrency(Math.round(entry.basePrice * quantity * snapshot.marketFeeRate)) })}</div>
                    <div>{t('market.netPreview', { value: formatCurrency(entry.basePrice * quantity - Math.round(entry.basePrice * quantity * snapshot.marketFeeRate)) })}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      sellMutation.mutate({
                        resourceId: entry.resourceId,
                        quantity,
                      })
                    }
                    disabled={sellMutation.isPending}
                    className="w-full rounded-full bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {sellMutation.isPending
                      ? t('market.selling')
                      : t('market.sellAction', {
                          quantity: formatNumber(quantity),
                          resource: t(`resources.${entry.resourceId}.name`),
                        })}
                  </button>
                </div>
              </PageCard>
            );
          })}
        </div>
      ) : (
        <PageCard>{t('market.emptyInventory')}</PageCard>
      )}

      {sellMutation.isSuccess ? (
        <PageCard>
          <div className="text-sm text-emerald-300">
            {t('market.sellSuccess', {
              quantity: formatNumber(sellMutation.data.quantitySold),
              resource: t(`resources.${sellMutation.data.resourceId}.name`),
              credits: formatCurrency(sellMutation.data.netAmount),
            })}
          </div>
        </PageCard>
      ) : null}

      {sellMutation.isError ? (
        <PageCard>
          <div className="text-sm text-rose-300">
            {t(getGameplayErrorKey(sellMutation.error.message))}
          </div>
        </PageCard>
      ) : null}
    </div>
  );
}
