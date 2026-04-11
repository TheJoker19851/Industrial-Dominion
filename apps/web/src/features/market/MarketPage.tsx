import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { PageCard } from '@industrial-dominion/ui';
import { Link } from 'react-router-dom';
import type { MarketContextKey } from '@industrial-dominion/shared';
import { useAuth } from '@/features/auth/AuthProvider';
import { getGameplayErrorKey } from '@/features/gameplay/gameplay-error';
import { useFormatters } from '@/i18n/useFormatters';
import {
  buyMarketResource,
  createMarketOrder,
  getMarketSnapshot,
  sellMarketResource,
} from './market-api';
import { clampBuyQuantity, clampOrderPrice, clampSellQuantity } from './market-model';

export function MarketPage() {
  const { t } = useTranslation();
  const { session, isLoading: isAuthLoading } = useAuth();
  const { formatCurrency, formatNumber, formatPercentage } = useFormatters();
  const queryClient = useQueryClient();
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [selectedMarketContextKey, setSelectedMarketContextKey] =
    useState<MarketContextKey>('region_anchor');
  const [orderResourceId, setOrderResourceId] = useState<'iron_ore' | 'iron_ingot' | 'coal' | 'wood' | 'crude_oil' | 'sand' | 'water' | 'crops'>('iron_ore');
  const [orderPrice, setOrderPrice] = useState(18);
  const [orderQuantity, setOrderQuantity] = useState(1);
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
        marketContextKey: selectedMarketContextKey,
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
        marketContextKey: selectedMarketContextKey,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['market', session?.user.id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', session?.user.id] }),
      ]);
    },
  });
  const orderMutation = useMutation({
    mutationFn: (input: {
      resourceId: Parameters<typeof createMarketOrder>[0]['resourceId'];
      side: 'buy' | 'sell';
      price: number;
      quantity: number;
    }) =>
      createMarketOrder({
        accessToken: accessToken!,
        resourceId: input.resourceId,
        side: input.side,
        price: input.price,
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
  const marketContexts = snapshot.contexts;
  const selectedMarketContext =
    marketContexts.find((entry) => entry.key === selectedMarketContextKey) ??
    marketContexts[0] ??
    null;
  const visibleOffers = snapshot.offers.map((entry) => ({
    ...entry,
    activePrice:
      entry.contextPrices.find((quote) => quote.contextKey === selectedMarketContext?.key)?.price ??
      entry.basePrice,
  }));
  const visibleInventory = snapshot.inventory.filter(
    (entry) => entry.marketContextKey === selectedMarketContext?.key,
  );
  const orderResourceOptions =
    orderSide === 'buy'
      ? snapshot.offers.map((entry) => ({
          resourceId: entry.resourceId,
          basePrice: entry.basePrice,
        }))
      : snapshot.inventory.map((entry) => ({
          resourceId: entry.resourceId,
          basePrice: entry.basePrice,
        }));
  const selectedOrderResource =
    orderResourceOptions.find((entry) => entry.resourceId === orderResourceId) ??
    orderResourceOptions[0] ??
    null;
  const normalizedOrderPrice = clampOrderPrice(orderPrice || selectedOrderResource?.basePrice || 1);
  const normalizedOrderQuantity = clampBuyQuantity(orderQuantity);

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

      {selectedMarketContext ? (
        <PageCard>
          <div className="grid gap-4 md:grid-cols-[220px,1fr]">
            <label className="text-sm text-slate-300">
              <span>{t('market.contextLabel')}</span>
              <select
                value={selectedMarketContext.key}
                onChange={(event) => setSelectedMarketContextKey(event.target.value as MarketContextKey)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
              >
                {marketContexts.map((context) => (
                  <option key={context.key} value={context.key}>
                    {t(context.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1 text-sm text-slate-300">
              <div className="text-lg font-semibold text-slate-50">{t(selectedMarketContext.labelKey)}</div>
              <div>{t(selectedMarketContext.descriptionKey)}</div>
              <div className="text-amber-200">
                {t('market.contextFocus', {
                  resource: t(`resources.${selectedMarketContext.focusResourceId}.name`),
                })}
              </div>
            </div>
          </div>
        </PageCard>
      ) : null}

      <PageCard>
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">{t('market.orderTitle')}</h3>
            <p className="mt-1 text-sm text-slate-300">{t('market.orderSubtitle')}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-300">
              <span>{t('market.orderSide')}</span>
              <select
                value={orderSide}
                onChange={(event) => {
                  const nextSide = event.target.value as 'buy' | 'sell';
                  setOrderSide(nextSide);
                  const nextResource = (
                    nextSide === 'buy' ? snapshot.offers[0]?.resourceId : snapshot.inventory[0]?.resourceId
                  ) ?? 'iron_ore';
                  const nextPrice = (
                    nextSide === 'buy'
                      ? snapshot.offers.find((entry) => entry.resourceId === nextResource)?.basePrice
                      : snapshot.inventory.find((entry) => entry.resourceId === nextResource)?.basePrice
                  ) ?? 1;
                  setOrderResourceId(nextResource);
                  setOrderPrice(nextPrice);
                }}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
              >
                <option value="buy">{t('market.orderBuy')}</option>
                <option value="sell">{t('market.orderSell')}</option>
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span>{t('market.orderResource')}</span>
              <select
                value={selectedOrderResource?.resourceId ?? ''}
                onChange={(event) => {
                  const nextResourceId = event.target.value as typeof orderResourceId;
                  setOrderResourceId(nextResourceId);
                  const nextPrice =
                    orderResourceOptions.find((entry) => entry.resourceId === nextResourceId)?.basePrice ?? 1;
                  setOrderPrice(nextPrice);
                }}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
              >
                {orderResourceOptions.map((entry) => (
                  <option key={entry.resourceId} value={entry.resourceId}>
                    {t(`resources.${entry.resourceId}.name`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              <span>{t('market.orderPrice')}</span>
              <input
                type="number"
                min={1}
                value={normalizedOrderPrice}
                onChange={(event) => setOrderPrice(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
              />
            </label>
            <label className="text-sm text-slate-300">
              <span>{t('market.orderQuantity')}</span>
              <input
                type="number"
                min={1}
                value={normalizedOrderQuantity}
                onChange={(event) => setOrderQuantity(Number(event.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-50"
              />
            </label>
          </div>
          <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              {t('market.orderTotal', {
                value: formatCurrency(normalizedOrderPrice * normalizedOrderQuantity),
              })}
            </div>
            <div>
              {t('market.orderStatusHelp', {
                status: t(`market.orderStatusValues.${orderSide}`),
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!selectedOrderResource) {
                return;
              }

              orderMutation.mutate({
                resourceId: selectedOrderResource.resourceId,
                side: orderSide,
                price: normalizedOrderPrice,
                quantity: normalizedOrderQuantity,
              });
            }}
            disabled={!selectedOrderResource || orderMutation.isPending}
            className="w-full rounded-full bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            {orderMutation.isPending
              ? t('market.orderSubmitting')
              : t('market.orderAction')}
          </button>
        </div>
      </PageCard>

      {orderMutation.isSuccess ? (
        <PageCard>
          <div className="text-sm text-emerald-300">
            {t('market.orderSuccess', {
              side: t(`market.orderStatusValues.${orderMutation.data.side}`),
              resource: t(`resources.${orderMutation.data.resourceId}.name`),
              status: t(`market.orderStates.${orderMutation.data.status}`),
            })}
          </div>
        </PageCard>
      ) : null}

      {orderMutation.isError ? (
        <PageCard>
          <div className="text-sm text-rose-300">
            {t(getGameplayErrorKey(orderMutation.error.message))}
          </div>
        </PageCard>
      ) : null}

      <PageCard>
        <div className="text-sm text-slate-400">{t('market.orderListTitle')}</div>
        {snapshot.orders.length > 0 ? (
          <div className="mt-3 space-y-3">
            {snapshot.orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl border border-slate-800 px-3 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-50">
                      {t(`market.orderStatusValues.${order.side}`)} {t(`resources.${order.resourceId}.name`)}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {t('market.orderListLine', {
                        quantity: formatNumber(order.quantity),
                        price: formatCurrency(order.pricePerUnit),
                      })}
                    </div>
                  </div>
                  <div className="text-sm text-slate-300 sm:text-right">
                    <div>{t(`market.orderStates.${order.status}`)}</div>
                    <div>{formatNumber(order.remainingQuantity)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-300">{t('market.emptyOrders')}</div>
        )}
      </PageCard>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">{t('market.buyTitle')}</h3>
          <p className="mt-1 text-sm text-slate-300">{t('market.buySubtitle')}</p>
        </div>
        <div className="space-y-4">
          {visibleOffers.map((entry) => {
            const quantity = clampBuyQuantity(
              buyQuantities[entry.resourceId] ?? 1,
            );
            const totalCost = entry.activePrice * quantity;

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
                      <div>{t('market.unitPrice', { price: formatCurrency(entry.activePrice) })}</div>
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

      {visibleInventory.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-50">{t('market.sellTitle')}</h3>
            <p className="mt-1 text-sm text-slate-300">{t('market.sellSubtitle')}</p>
          </div>
          {visibleInventory.map((entry) => {
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
                      <div>{t('market.unitPrice', { price: formatCurrency(entry.effectivePrice) })}</div>
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
                    <div>{t('market.grossPreview', { value: formatCurrency(entry.effectivePrice * quantity) })}</div>
                    <div>{t('market.feePreview', { value: formatCurrency(Math.round(entry.effectivePrice * quantity * snapshot.marketFeeRate)) })}</div>
                    <div>{t('market.netPreview', { value: formatCurrency(entry.effectivePrice * quantity - Math.round(entry.effectivePrice * quantity * snapshot.marketFeeRate)) })}</div>
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
        <PageCard>
          {selectedMarketContext
            ? t('market.emptyInventoryContext', {
                location: t(selectedMarketContext.labelKey),
              })
            : t('market.emptyInventory')}
        </PageCard>
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
