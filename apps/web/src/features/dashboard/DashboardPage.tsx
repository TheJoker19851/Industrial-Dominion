import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageCard } from '@industrial-dominion/ui';
import { getStarterExtractorForRegion } from '@industrial-dominion/shared';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFormatters } from '@/i18n/useFormatters';
import {
  claimTransformJob,
  claimExtractorProduction,
  getDashboardSnapshot,
  placeFirstExtractor,
  startTransformJob,
} from './dashboard-api';
import { getGameplayErrorKey } from '@/features/gameplay/gameplay-error';
import { getLedgerAmountTone } from './ledger-feed';
import { getDashboardViewState } from './dashboard-model';

export function DashboardPage() {
  const { t } = useTranslation();
  const { formatCurrency, formatDate, formatNumber } = useFormatters();
  const queryClient = useQueryClient();
  const { session, isLoading: isAuthLoading } = useAuth();
  const accessToken = session?.access_token;
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', session?.user.id],
    queryFn: () => getDashboardSnapshot(accessToken!),
    enabled: Boolean(accessToken),
  });
  const placeMutation = useMutation({
    mutationFn: (buildingTypeId: string) =>
      placeFirstExtractor({
        accessToken: accessToken!,
        buildingTypeId,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['dashboard', session?.user.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['starter-tutorial', session?.user.id],
        }),
      ]);
    },
  });
  const claimMutation = useMutation({
    mutationFn: (buildingId: string) =>
      claimExtractorProduction({
        accessToken: accessToken!,
        buildingId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', session?.user.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ['starter-tutorial', session?.user.id],
      });
    },
  });
  const startTransformMutation = useMutation({
    mutationFn: (input: { buildingId: string; recipeId: string }) =>
      startTransformJob({
        accessToken: accessToken!,
        buildingId: input.buildingId,
        recipeId: input.recipeId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', session?.user.id],
      });
    },
  });
  const claimTransformMutation = useMutation({
    mutationFn: (jobId: string) =>
      claimTransformJob({
        accessToken: accessToken!,
        jobId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', session?.user.id],
      });
    },
  });

  useEffect(() => {
    if (!dashboardQuery.isSuccess) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: ['starter-tutorial', session?.user.id],
    });
  }, [dashboardQuery.dataUpdatedAt, dashboardQuery.isSuccess, queryClient, session?.user.id]);

  if (isAuthLoading) {
    return (
      <div className="pb-16 text-sm text-slate-300 md:pb-0">
        {t('dashboard.authLoading')}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4 pb-16 md:pb-0">
        <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
        <PageCard>
          <div className="text-sm text-slate-300">
            {t('dashboard.signInRequired')}
          </div>
        </PageCard>
      </div>
    );
  }

  if (dashboardQuery.isLoading) {
    return <div className="pb-16 text-sm text-slate-300 md:pb-0">{t('dashboard.loading')}</div>;
  }

  if (dashboardQuery.isError) {
    return (
      <div className="pb-16 text-sm text-rose-300 md:pb-0">
        {t(getGameplayErrorKey(dashboardQuery.error.message))}
      </div>
    );
  }

  const snapshot = dashboardQuery.data ?? null;
  const viewState = getDashboardViewState({
    isAuthenticated: true,
    snapshot,
  });

  if (viewState === 'needs_bootstrap') {
    return (
      <div className="space-y-4 pb-16 md:pb-0">
        <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
        <PageCard>
          <div className="space-y-3">
            <div className="text-sm text-slate-300">{t('dashboard.bootstrapRequired')}</div>
            <Link
              to="/onboarding"
              className="inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              {t('dashboard.openOnboarding')}
            </Link>
          </div>
        </PageCard>
      </div>
    );
  }

  const player = snapshot!.player!;
  const extractor = snapshot!.extractor;
  const starterExtractor = player.regionId
    ? getStarterExtractorForRegion(player.regionId)
    : undefined;
  const inventory = snapshot!.inventory;
  const transformRecipes = snapshot!.transformRecipes;
  const ledger = snapshot!.ledger;
  const news = snapshot!.news;
  const inventoryTotal = inventory.reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <div className="space-y-4 pb-16 md:pb-0">
      <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <PageCard>
          <div className="text-sm text-slate-400">{t('dashboard.credits')}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {formatCurrency(player.credits)}
          </div>
        </PageCard>
        <PageCard>
          <div className="text-sm text-slate-400">
            {t('dashboard.inventoryTotal')}
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-50">
            {formatNumber(inventoryTotal)}
          </div>
        </PageCard>
        <PageCard>
          <div className="text-sm text-slate-400">{t('dashboard.production')}</div>
          <div className="mt-2 text-sm text-slate-200">
            {extractor
              ? formatNumber(extractor.outputPerHour)
              : t('dashboard.noExtractorShort')}
          </div>
        </PageCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <PageCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm text-slate-400">{t('dashboard.extractorTitle')}</div>
              {extractor ? (
                <>
                  <div className="mt-2 text-xl font-semibold text-slate-50">
                    {t(`buildingTypes.${extractor.buildingTypeId}.name`)}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {t('dashboard.extractorOutput', {
                      resource: t(`resources.${extractor.outputResourceId}.name`),
                      amount: formatNumber(extractor.outputPerHour),
                    })}
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    {extractor.readyToClaim
                      ? t('dashboard.claimReady', {
                          amount: formatNumber(extractor.claimableQuantity),
                          resource: t(`resources.${extractor.outputResourceId}.name`),
                        })
                      : t('dashboard.nextClaimAt', {
                          date: formatDate(extractor.nextClaimAt),
                        })}
                  </div>
                </>
              ) : (
                <div className="mt-2 space-y-3">
                  <div className="text-sm text-slate-300">
                    {t('dashboard.noExtractor')}
                  </div>
                  {starterExtractor ? (
                    <button
                      type="button"
                      onClick={() => placeMutation.mutate(starterExtractor.id)}
                      disabled={placeMutation.isPending}
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {placeMutation.isPending
                        ? t('dashboard.placingExtractor')
                        : t('dashboard.placeExtractorAction', {
                            extractor: t(`buildingTypes.${starterExtractor.id}.name`),
                          })}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            {extractor ? (
              <button
                type="button"
                onClick={() => claimMutation.mutate(extractor.buildingId)}
                disabled={!extractor.readyToClaim || claimMutation.isPending}
                className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
              >
                {claimMutation.isPending
                  ? t('dashboard.claiming')
                  : t('dashboard.claimAction')}
              </button>
            ) : null}
          </div>
          {claimMutation.isError ? (
            <div className="mt-3 text-sm text-rose-300">
              {t(getGameplayErrorKey(claimMutation.error.message))}
            </div>
          ) : null}
          {placeMutation.isError ? (
            <div className="mt-3 text-sm text-rose-300">
              {t(getGameplayErrorKey(placeMutation.error.message))}
            </div>
          ) : null}
        </PageCard>

        <PageCard>
          <div className="text-sm text-slate-400">{t('dashboard.inventoryTitle')}</div>
          {inventory.length > 0 ? (
            <div className="mt-3 space-y-3">
              {inventory.map((entry) => (
                <div
                  key={entry.resourceId}
                  className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2"
                >
                  <div className="text-sm text-slate-200">
                    {t(`resources.${entry.resourceId}.name`)}
                  </div>
                  <div className="text-sm font-semibold text-slate-50">
                    {formatNumber(entry.quantity)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-300">{t('dashboard.emptyInventory')}</div>
          )}
        </PageCard>
      </div>

      <PageCard>
        <div className="text-sm text-slate-400">{t('dashboard.transformTitle')}</div>
        {transformRecipes.length > 0 ? (
          <div className="mt-3 space-y-4">
            {transformRecipes.map((recipe) => (
              <div
                key={recipe.recipeId}
                className="rounded-2xl border border-slate-800 px-4 py-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-base font-semibold text-slate-50">
                      {t(recipe.nameKey)}
                    </div>
                    <div className="text-sm text-slate-300">{t(recipe.descriptionKey)}</div>
                    <div className="text-sm text-slate-200">
                      {t('dashboard.transformRecipeLine', {
                        inputAmount: formatNumber(recipe.inputAmount),
                        inputResource: t(`resources.${recipe.inputResourceId}.name`),
                        outputAmount: formatNumber(recipe.outputAmount),
                        outputResource: t(`resources.${recipe.outputResourceId}.name`),
                      })}
                    </div>
                    {recipe.activeJob ? (
                      <div className="text-sm text-slate-300">
                        {recipe.activeJob.readyToClaim
                          ? t('dashboard.transformReadyToClaim', {
                              outputAmount: formatNumber(recipe.outputAmount),
                              outputResource: t(`resources.${recipe.outputResourceId}.name`),
                            })
                          : t('dashboard.transformCompletesAt', {
                              date: formatDate(recipe.activeJob.completesAt),
                            })}
                      </div>
                    ) : recipe.canStart ? (
                      <div className="text-sm text-slate-300">
                        {t('dashboard.transformReadyToStart')}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-300">
                        {t('dashboard.transformMissingInput', {
                          amount: formatNumber(recipe.missingInputAmount),
                          resource: t(`resources.${recipe.inputResourceId}.name`),
                        })}
                      </div>
                    )}
                  </div>

                  {recipe.activeJob ? (
                    <button
                      type="button"
                      onClick={() => claimTransformMutation.mutate(recipe.activeJob!.jobId)}
                      disabled={!recipe.activeJob.readyToClaim || claimTransformMutation.isPending}
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {claimTransformMutation.isPending
                        ? t('dashboard.claimingTransform')
                        : t('dashboard.claimTransformAction')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        startTransformMutation.mutate({
                          buildingId: recipe.buildingId,
                          recipeId: recipe.recipeId,
                        })
                      }
                      disabled={!recipe.canStart || startTransformMutation.isPending}
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {startTransformMutation.isPending
                        ? t('dashboard.startingTransform')
                        : t('dashboard.startTransformAction')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-300">{t('dashboard.emptyTransforms')}</div>
        )}
        {startTransformMutation.isError ? (
          <div className="mt-3 text-sm text-rose-300">
            {t(getGameplayErrorKey(startTransformMutation.error.message))}
          </div>
        ) : null}
        {claimTransformMutation.isError ? (
          <div className="mt-3 text-sm text-rose-300">
            {t(getGameplayErrorKey(claimTransformMutation.error.message))}
          </div>
        ) : null}
      </PageCard>

      <PageCard>
        <div className="text-sm text-slate-400">{t('dashboard.ledgerTitle')}</div>
        {ledger.length > 0 ? (
          <div className="mt-3 space-y-3">
            {ledger.map((entry) => {
              const tone = getLedgerAmountTone(entry);
              const amountClassName =
                tone === 'positive'
                  ? 'text-emerald-300'
                  : tone === 'negative'
                    ? 'text-rose-300'
                    : 'text-slate-200';

              return (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-800 px-3 py-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-50">
                      {t(`ledger.actions.${entry.actionType}.title`)}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {t(`ledger.actions.${entry.actionType}.description`, {
                        resource: entry.resourceId
                          ? t(`resources.${entry.resourceId}.name`)
                          : '',
                        amount: formatNumber(entry.amount),
                      })}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className={`text-sm font-semibold ${amountClassName}`}>
                      {entry.actionType === 'market_sell' ||
                      entry.actionType === 'market_fee' ||
                      entry.actionType === 'market_purchase'
                        ? formatCurrency(entry.amount)
                        : formatNumber(entry.amount)}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {formatDate(entry.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-300">{t('dashboard.emptyLedger')}</div>
        )}
      </PageCard>

      <PageCard>
        <div className="text-sm text-slate-400">{t('dashboard.newsTitle')}</div>
        {news.length > 0 ? (
          <div className="mt-3 space-y-3">
            {news.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-800 px-3 py-3"
              >
                <div className="text-sm font-medium text-slate-50">
                  {t(item.headlineKey)}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {t(item.bodyKey)}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {formatDate(item.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-300">{t('dashboard.emptyNews')}</div>
        )}
      </PageCard>
    </div>
  );
}
