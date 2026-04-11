import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageCard } from '@industrial-dominion/ui';
import {
  getStarterExtractorForRegion,
  getStarterProcessingInstallation,
} from '@industrial-dominion/shared';
import { useAuth } from '@/features/auth/AuthProvider';
import { useFormatters } from '@/i18n/useFormatters';
import {
  claimTransformJob,
  claimExtractorProduction,
  getDashboardSnapshot,
  placeFirstExtractor,
  placeFirstProcessingInstallation,
  startTransformJob,
} from './dashboard-api';
import { getGameplayErrorKey } from '@/features/gameplay/gameplay-error';
import {
  getLedgerActionBadgeKey,
  getLedgerAmountDisplayKind,
  getLedgerSignedAmount,
  getLedgerAmountTone,
  getLedgerBuildingTypeId,
  getLedgerToneLabelKey,
} from './ledger-feed';
import {
  getDashboardNextActionCue,
  getDashboardStarterProgressSummary,
  getDashboardViewState,
} from './dashboard-model';
import { previewMarketSnapshot } from './dashboard-preview';
import { getBestEconomicMoves } from './best-economic-moves';
import type { BestEconomicMove } from './best-economic-moves';
import { getRegionalOpportunities } from './regional-opportunities';
import type { RegionalOpportunity } from './regional-opportunities';
import {
  buildRegionalTradeDraft,
  resolveRegionalTradeSimulation,
  pushRegionalTradeSimulationHistory,
  restoreRegionalTradeSimulationState,
  persistRegionalTradeSimulationState,
  resetRegionalTradeSimulationState,
  getRegionalTradeSessionProgress,
  getRegionalTradeRequiredCapital,
  type RegionalTradeDraft,
  type RegionalTradeSimulationResult,
  type RegionalTradeSimulationState,
} from './regional-trade-draft';
import {
  restoreMarketPreviewRefreshCycle,
  persistMarketPreviewRefreshCycle,
  getRefreshedPreviewMarketSnapshot,
} from './market-refresh';
import {
  waitForCommitDelay,
  buildCommitResultFromSimulation,
  type CommitPhase,
  type CommitResult,
} from './action-executor';

export function DashboardPage() {
  const { t } = useTranslation();
  const { formatCurrency, formatDate, formatNumber } = useFormatters();
  const queryClient = useQueryClient();
  const { session, isLoading: isAuthLoading } = useAuth();
  const accessToken = session?.access_token;

  /* ── Existing data queries ─────────────────────────────────────── */
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', session?.user.id],
    queryFn: () => getDashboardSnapshot(accessToken!),
    enabled: Boolean(accessToken),
  });
  const placeMutation = useMutation({
    mutationFn: (buildingTypeId: string) =>
      placeFirstExtractor({ accessToken: accessToken!, buildingTypeId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['dashboard', session?.user.id] }),
        queryClient.invalidateQueries({ queryKey: ['starter-tutorial', session?.user.id] }),
      ]);
    },
  });
  const claimMutation = useMutation({
    mutationFn: (buildingId: string) =>
      claimExtractorProduction({ accessToken: accessToken!, buildingId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', session?.user.id] });
      await queryClient.invalidateQueries({ queryKey: ['starter-tutorial', session?.user.id] });
    },
  });
  const placeProcessingMutation = useMutation({
    mutationFn: (buildingTypeId: string) =>
      placeFirstProcessingInstallation({
        accessToken: accessToken!,
        buildingTypeId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', session?.user.id] });
    },
  });
  const startTransformMutation = useMutation({
    mutationFn: (input: { buildingId: string; recipeId: string }) =>
      startTransformJob({ accessToken: accessToken!, buildingId: input.buildingId, recipeId: input.recipeId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', session?.user.id] });
    },
  });
  const claimTransformMutation = useMutation({
    mutationFn: (jobId: string) =>
      claimTransformJob({ accessToken: accessToken!, jobId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', session?.user.id] });
    },
  });

  useEffect(() => {
    if (!dashboardQuery.isSuccess) return;
    void queryClient.invalidateQueries({ queryKey: ['starter-tutorial', session?.user.id] });
  }, [dashboardQuery.dataUpdatedAt, dashboardQuery.isSuccess, queryClient, session?.user.id]);

  /* ── Gameplay loop state ────────────────────────────────────────── */
  const [marketRefreshCycle, setMarketRefreshCycle] = useState(() =>
    restoreMarketPreviewRefreshCycle(window.localStorage),
  );
  const [tradeSimState, setTradeSimState] = useState<RegionalTradeSimulationState>(() =>
    restoreRegionalTradeSimulationState(window.localStorage),
  );
  const [selectedOpportunity, setSelectedOpportunity] = useState<RegionalOpportunity | null>(null);
  const [regionalTradeDraft, setRegionalTradeDraft] = useState<RegionalTradeDraft | null>(null);
  const [latestSimulation, setLatestSimulation] = useState<RegionalTradeSimulationResult | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [commitPhase, setCommitPhase] = useState<CommitPhase>('idle');
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [capitalPulseKey, setCapitalPulseKey] = useState(0);

  /* ── Derived market data ────────────────────────────────────────── */
  const refreshedMarket = getRefreshedPreviewMarketSnapshot(previewMarketSnapshot, marketRefreshCycle);
  const marketSnapshot = refreshedMarket.snapshot;
  const bestMoves = getBestEconomicMoves(marketSnapshot);
  const regionalOpportunities = getRegionalOpportunities(marketSnapshot);
  const sessionProgress = getRegionalTradeSessionProgress(tradeSimState);

  /* ── Persist state changes ──────────────────────────────────────── */
  useEffect(() => {
    persistRegionalTradeSimulationState(window.localStorage, tradeSimState);
  }, [tradeSimState]);
  useEffect(() => {
    persistMarketPreviewRefreshCycle(window.localStorage, marketRefreshCycle);
  }, [marketRefreshCycle]);

  /* ── Handlers ───────────────────────────────────────────────────── */
  const handleRefreshMarket = useCallback(() => {
    setMarketRefreshCycle((c) => c + 1);
  }, []);

  const handleResetCapital = useCallback(() => {
    const defaults = resetRegionalTradeSimulationState(window.localStorage);
    setTradeSimState(defaults);
    setLatestSimulation(null);
    setSimulationError(null);
    setCommitPhase('idle');
    setCommitResult(null);
    setRegionalTradeDraft(null);
    setSelectedOpportunity(null);
  }, []);

  const handleOpenDraft = useCallback((opportunity: RegionalOpportunity) => {
    const draft = buildRegionalTradeDraft(opportunity);
    setSelectedOpportunity(opportunity);
    setRegionalTradeDraft(draft);
    setLatestSimulation(null);
    setSimulationError(null);
    setCommitPhase('idle');
    setCommitResult(null);
  }, []);

  const handleDraftQuantityChange = useCallback(
    (quantity: number) => {
      if (!selectedOpportunity) return;
      const draft = buildRegionalTradeDraft(selectedOpportunity, quantity);
      setRegionalTradeDraft(draft);
      setLatestSimulation(null);
      setSimulationError(null);
      setCommitPhase('idle');
      setCommitResult(null);
    },
    [selectedOpportunity],
  );

  const handleCloseDraft = useCallback(() => {
    setSelectedOpportunity(null);
    setRegionalTradeDraft(null);
    setLatestSimulation(null);
    setSimulationError(null);
    setCommitPhase('idle');
    setCommitResult(null);
  }, []);

  const handleSimulate = useCallback(() => {
    if (!regionalTradeDraft) return;
    const resolution = resolveRegionalTradeSimulation(
      regionalTradeDraft,
      tradeSimState.capital,
    );
    if (!resolution.ok) {
      setSimulationError(
        t('dashboard.marketRegionalInsufficientCapital', {
          required: formatCurrency(resolution.requiredCapital),
          available: formatCurrency(resolution.capitalBefore),
        }),
      );
      setLatestSimulation(null);
      setCommitPhase('idle');
      setCommitResult(null);
      return;
    }
    setSimulationError(null);
    setLatestSimulation(resolution.result);
    setCommitPhase('idle');
    setCommitResult(null);
  }, [regionalTradeDraft, tradeSimState.capital, t, formatCurrency]);

  const handleCommit = useCallback(async () => {
    if (!regionalTradeDraft || commitPhase === 'committing') return;
    setCommitPhase('committing');

    // Short visual delay to create a moment of impact
    await waitForCommitDelay();

    const resolution = resolveRegionalTradeSimulation(
      regionalTradeDraft,
      tradeSimState.capital,
    );
    if (!resolution.ok) {
      setSimulationError(
        t('dashboard.marketRegionalInsufficientCapital', {
          required: formatCurrency(resolution.requiredCapital),
          available: formatCurrency(resolution.capitalBefore),
        }),
      );
      setCommitPhase('idle');
      setCommitResult(null);
      return;
    }

    const result = buildCommitResultFromSimulation(resolution.result);

    setTradeSimState((prev) => ({
      capital: resolution.capitalAfter,
      recentSimulations: pushRegionalTradeSimulationHistory(prev.recentSimulations, resolution.result),
    }));
    setLatestSimulation(resolution.result);
    setCommitResult(result);
    setCommitPhase('committed');
    setSimulationError(null);
    setCapitalPulseKey((k) => k + 1);
  }, [regionalTradeDraft, tradeSimState.capital, commitPhase, t, formatCurrency]);

  const handleOpenBestMove = useCallback(
    (move: BestEconomicMove) => {
      const opportunity = regionalOpportunities.find(
        (o) =>
          o.resourceId === move.resourceId &&
          o.buyContextKey === move.buyContextKey &&
          o.sellContextKey === move.sellContextKey,
      );
      if (opportunity) {
        handleOpenDraft(opportunity);
      }
    },
    [regionalOpportunities, handleOpenDraft],
  );

  /* ── Auth / loading guards ──────────────────────────────────────── */
  if (isAuthLoading) {
    return <div className="pb-16 text-sm text-slate-300 md:pb-0">{t('dashboard.authLoading')}</div>;
  }
  if (!session) {
    return (
      <div className="space-y-4 pb-16 md:pb-0">
        <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
        <PageCard>
          <div className="text-sm text-slate-300">{t('dashboard.signInRequired')}</div>
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
  const viewState = getDashboardViewState({ isAuthenticated: true, snapshot });

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
  const processingInstallation = snapshot!.processingInstallation;
  const starterExtractor = player.regionId
    ? getStarterExtractorForRegion(player.regionId)
    : undefined;
  const starterProcessingInstallation = getStarterProcessingInstallation();
  const inventory = snapshot!.inventory;
  const transformRecipes = snapshot!.transformRecipes;
  const ledger = snapshot!.ledger;
  const news = snapshot!.news;
  const inventoryTotal = inventory.reduce((sum, entry) => sum + entry.quantity, 0);
  const nextActionCue = getDashboardNextActionCue(snapshot);
  const starterProgressSummary = getDashboardStarterProgressSummary(snapshot);

  return (
    <div className="space-y-4 pb-16 md:pb-0">
      <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>

      {/* ── Summary cards ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <PageCard>
          <div className="text-sm text-slate-400">{t('dashboard.credits')}</div>
          <div
            key={`credits-${capitalPulseKey}`}
            className={`mt-2 text-2xl font-semibold text-slate-50 ${commitPhase === 'committed' ? 'animate-commit-capital rounded-lg px-2 py-1 -mx-2' : ''}`}
          >
            {formatCurrency(player.credits)}
          </div>
        </PageCard>
        <PageCard>
          <div className="text-sm text-slate-400">{t('dashboard.inventoryTotal')}</div>
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

      {nextActionCue ? (
        <PageCard>
          <div className="text-xs font-medium uppercase tracking-wider text-amber-400">
            {t('dashboard.nextActionTitle')}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-50">{t(nextActionCue.titleKey)}</div>
          <div className="mt-1 text-sm text-slate-300">{t(nextActionCue.bodyKey)}</div>
        </PageCard>
      ) : null}

      {starterProgressSummary ? (
        <PageCard>
          <div className="text-xs font-medium uppercase tracking-wider text-sky-300">
            {t('dashboard.progressSummaryTitle')}
          </div>
          <div className="mt-2 text-base font-semibold text-slate-50">
            {t(starterProgressSummary.titleKey)}
          </div>
          <div className="mt-1 text-sm text-slate-300">{t(starterProgressSummary.bodyKey)}</div>
        </PageCard>
      ) : null}

      {/* ── Extractor section ─────────────────────────────────────── */}
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
                      : t('dashboard.nextClaimAt', { date: formatDate(extractor.nextClaimAt) })}
                  </div>
                </>
              ) : (
                <div className="mt-2 space-y-3">
                  <div className="text-sm text-slate-300">{t('dashboard.noExtractor')}</div>
                  {starterExtractor ? (
                    <button
                      type="button"
                      onClick={() => placeMutation.mutate(starterExtractor.id)}
                      disabled={placeMutation.isPending}
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {placeMutation.isPending
                        ? t('dashboard.placingExtractor')
                        : t('dashboard.placeExtractorAction', { extractor: t(`buildingTypes.${starterExtractor.id}.name`) })}
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
                {claimMutation.isPending ? t('dashboard.claiming') : t('dashboard.claimAction')}
              </button>
            ) : null}
          </div>
          <div className="mt-4 border-t border-slate-800 pt-4">
            <div className="text-sm text-slate-400">{t('dashboard.processingInstallationTitle')}</div>
            {processingInstallation ? (
              <div className="mt-2 space-y-1">
                <div className="text-base font-semibold text-slate-50">
                  {t(`buildingTypes.${processingInstallation.buildingTypeId}.name`)}
                </div>
                <div className="text-sm text-slate-300">
                  {t('dashboard.processingInstallationOnline')}
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <div className="text-sm text-slate-300">
                  {extractor
                    ? t('dashboard.processingInstallationMissing')
                    : t('dashboard.processingInstallationNeedsExtractor')}
                </div>
                {starterProcessingInstallation ? (
                  <button
                    type="button"
                    onClick={() =>
                      placeProcessingMutation.mutate(starterProcessingInstallation.id)
                    }
                    disabled={!extractor || placeProcessingMutation.isPending}
                    className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {placeProcessingMutation.isPending
                      ? t('dashboard.placingProcessingInstallation')
                      : t('dashboard.placeProcessingInstallationAction', {
                          installation: t(
                            `buildingTypes.${starterProcessingInstallation.id}.name`,
                          ),
                        })}
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {claimMutation.isError ? (
            <div className="mt-3 text-sm text-rose-300">{t(getGameplayErrorKey(claimMutation.error.message))}</div>
          ) : null}
          {placeMutation.isError ? (
            <div className="mt-3 text-sm text-rose-300">{t(getGameplayErrorKey(placeMutation.error.message))}</div>
          ) : null}
          {placeProcessingMutation.isError ? (
            <div className="mt-3 text-sm text-rose-300">
              {t(getGameplayErrorKey(placeProcessingMutation.error.message))}
            </div>
          ) : null}
        </PageCard>

        {/* ── Inventory section ─────────────────────────────────────── */}
        <PageCard>
          <div className="text-sm text-slate-400">{t('dashboard.inventoryTitle')}</div>
          {inventory.length > 0 ? (
            <div className="mt-3 space-y-3">
              {inventory.map((entry) => (
                <div
                  key={entry.resourceId}
                  className="flex items-center justify-between rounded-xl border border-slate-800 px-3 py-2"
                >
                  <div className="text-sm text-slate-200">{t(`resources.${entry.resourceId}.name`)}</div>
                  <div className="text-sm font-semibold text-slate-50">{formatNumber(entry.quantity)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-300">{t('dashboard.emptyInventory')}</div>
          )}
        </PageCard>
      </div>

      {/* ── Transform section ───────────────────────────────────────── */}
      <PageCard>
        <div className="text-sm text-slate-400">{t('dashboard.transformTitle')}</div>
        {transformRecipes.length > 0 ? (
          <div className="mt-3 space-y-4">
            {transformRecipes.map((recipe) => (
              <div key={recipe.recipeId} className="rounded-2xl border border-slate-800 px-4 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="text-base font-semibold text-slate-50">{t(recipe.nameKey)}</div>
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
                          : t('dashboard.transformCompletesAt', { date: formatDate(recipe.activeJob.completesAt) })}
                      </div>
                    ) : !processingInstallation ? (
                      <div className="text-sm text-slate-300">
                        {t('dashboard.transformProcessingInstallationRequired')}
                      </div>
                    ) : recipe.canStart ? (
                      <div className="text-sm text-slate-300">{t('dashboard.transformReadyToStart')}</div>
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
                      {claimTransformMutation.isPending ? t('dashboard.claimingTransform') : t('dashboard.claimTransformAction')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startTransformMutation.mutate({ buildingId: recipe.buildingId, recipeId: recipe.recipeId })}
                      disabled={!processingInstallation || !recipe.canStart || startTransformMutation.isPending}
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
                    >
                      {startTransformMutation.isPending ? t('dashboard.startingTransform') : t('dashboard.startTransformAction')}
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
          <div className="mt-3 text-sm text-rose-300">{t(getGameplayErrorKey(startTransformMutation.error.message))}</div>
        ) : null}
        {claimTransformMutation.isError ? (
          <div className="mt-3 text-sm text-rose-300">{t(getGameplayErrorKey(claimTransformMutation.error.message))}</div>
        ) : null}
      </PageCard>

      {/* ═══════════════════════════════════════════════════════════════
          GAMEPLAY LOOP: SEE → DECIDE → SIMULATE → COMMIT → FEEDBACK
          ═══════════════════════════════════════════════════════════════ */}

      {/* ── Best economic moves (DECIDE layer) ──────────────────────── */}
      <PageCard>
        <div className="text-sm text-slate-400">{t('dashboard.bestEconomicMovesTitle')}</div>
        <div className="mt-1 text-xs text-slate-500">{t('dashboard.bestEconomicMovesSubtitle')}</div>
        {bestMoves.length > 0 ? (
          <div className="mt-3 space-y-3">
            {bestMoves.map((move) => (
              <div
                key={move.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
                      {t(`dashboard.bestEconomicMoveType.${move.type}`)}
                    </span>
                    {move.category ? (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {t(`dashboard.marketRegionalOpportunityCategory.${move.category}`)}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-slate-200">
                    {move.type === 'regional_trade'
                      ? t('dashboard.bestEconomicMoveRegionalSummary', {
                          resource: move.resourceId ? t(`resources.${move.resourceId}.name`) : '',
                          buyLocation: move.buyContextKey ? t(`locations.${move.buyContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`) : '',
                          sellLocation: move.sellContextKey ? t(`locations.${move.sellContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`) : '',
                        })
                      : t('dashboard.bestEconomicMoveTransformationSummary', {
                          inputResource: move.inputResourceId ? t(`resources.${move.inputResourceId}.name`) : '',
                          outputResource: move.outputResourceId ? t(`resources.${move.outputResourceId}.name`) : '',
                          sellLocation: move.sellContextKey ? t(`locations.${move.sellContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`) : '',
                        })}
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>{t('dashboard.bestEconomicMovesCapital')}: {formatCurrency(move.capitalRequired)}</span>
                    <span>{t('dashboard.bestEconomicMovesNet')}: {formatCurrency(move.estimatedNetProfit)}</span>
                    <span>{t('dashboard.bestEconomicMovesEfficiency')}: {(move.efficiencyScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenBestMove(move)}
                  className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
                >
                  {t('dashboard.bestEconomicMovesOpenDraft')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-300">{t('dashboard.bestEconomicMovesEmpty')}</div>
        )}
      </PageCard>

      {/* ── Regional trade simulation sandbox ───────────────────────── */}
      <PageCard>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">{t('dashboard.marketRegionalOpportunityTitle')}</div>
            <div className="mt-1 text-xs text-slate-500">{t('dashboard.marketRegionalOpportunitySubtitle')}</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRefreshMarket}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
            >
              {t('dashboard.marketRefreshAction')} ({t('dashboard.marketRefreshHint', { cycle: marketRefreshCycle })})
            </button>
          </div>
        </div>

        {/* Simulated capital display */}
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
          <div className="text-sm text-amber-300">{t('dashboard.marketRegionalCapitalLabel', { value: formatCurrency(tradeSimState.capital) })}</div>
          <button
            type="button"
            onClick={handleResetCapital}
            className="rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:border-slate-500"
          >
            {t('dashboard.marketRegionalCapitalReset')}
          </button>
        </div>

        {/* Session goals */}
        <div className="mt-3 rounded-xl border border-slate-800 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('dashboard.marketRegionalSessionTitle')}</div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{t('dashboard.marketRegionalSessionCapitalTitle')}</span>
              <span className={sessionProgress.capital.completed ? 'text-emerald-400' : 'text-slate-200'}>
                {formatCurrency(sessionProgress.capital.current)} / {formatCurrency(sessionProgress.capital.target)}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${sessionProgress.capital.completed ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(100, sessionProgress.capital.progress * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{t('dashboard.marketRegionalSessionTradesTitle')}</span>
              <span className={sessionProgress.profitableTrades.completed ? 'text-emerald-400' : 'text-slate-200'}>
                {sessionProgress.profitableTrades.current} / {sessionProgress.profitableTrades.target}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{t('dashboard.marketRegionalSessionProfitTitle')}</span>
              <span className={sessionProgress.cumulativeProfit.completed ? 'text-emerald-400' : 'text-slate-200'}>
                {formatCurrency(sessionProgress.cumulativeProfit.current)} / {formatCurrency(sessionProgress.cumulativeProfit.target)}
              </span>
            </div>
          </div>
          {sessionProgress.isCompleted ? (
            <div className="mt-2 text-sm text-emerald-400">{t('dashboard.marketRegionalSessionCompleted')}</div>
          ) : null}
        </div>

        {/* Opportunities list */}
        {regionalOpportunities.length > 0 ? (
          <div className="mt-3 space-y-3">
            {regionalOpportunities.map((opp) => (
              <div
                key={`${opp.resourceId}-${opp.buyContextKey}-${opp.sellContextKey}`}
                className="rounded-xl border border-slate-800 px-4 py-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-50">
                        {t(`resources.${opp.resourceId}.name`)}
                      </span>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                        {t(`dashboard.marketRegionalOpportunityCategory.${opp.category}`)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">
                      {t('dashboard.marketRegionalOpportunityAction', {
                        resource: t(`resources.${opp.resourceId}.name`),
                        buyLocation: t(`locations.${opp.buyContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`),
                        sellLocation: t(`locations.${opp.sellContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`),
                      })}
                    </div>
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span>{t('dashboard.marketRegionalOpportunitySpread')}: {formatCurrency(opp.spreadPerUnit)}</span>
                      <span>{t('dashboard.marketRegionalOpportunityNet')}: {formatCurrency(opp.netSpreadPerUnit)}</span>
                      <span>{t('dashboard.marketRegionalOpportunityValue', { value: formatCurrency(opp.estimatedNetOpportunityValue) })}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenDraft(opp)}
                    className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950"
                  >
                    {t('dashboard.marketRegionalOpportunityPrepare')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-300">{t('dashboard.bestEconomicMovesEmpty')}</div>
        )}
      </PageCard>

      {/* ── Trade draft panel (SIMULATE / COMMIT) ───────────────────── */}
      {regionalTradeDraft ? (
        <PageCard>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-400">{t('dashboard.marketRegionalDraftTitle')}</div>
            <button
              type="button"
              onClick={handleCloseDraft}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:border-slate-500"
            >
              {t('dashboard.marketRegionalDraftClose')}
            </button>
          </div>

          {/* Draft details */}
          <div className="mt-3 space-y-2 rounded-xl border border-slate-800 px-4 py-3">
            <div className="text-xs text-slate-500">{t('dashboard.marketRegionalDraftSimulation')}</div>
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <span>{t('dashboard.marketRegionalDraftQuantity')}:</span>
              <input
                type="number"
                min={1}
                max={regionalTradeDraft.estimatedTradableUnits}
                value={regionalTradeDraft.quantity}
                onChange={(e) => handleDraftQuantityChange(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
              />
              <span className="text-xs text-slate-500">
                {t('dashboard.marketRegionalDraftCapacity', { quantity: regionalTradeDraft.estimatedTradableUnits })}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-slate-400">{t('dashboard.marketRegionalDraftPurchaseCost')}</div>
              <div className="text-right text-slate-200">{formatCurrency(regionalTradeDraft.estimatedPurchaseCost)}</div>
              <div className="text-slate-400">{t('dashboard.marketRegionalDraftTransferCost')}</div>
              <div className="text-right text-slate-200">{formatCurrency(regionalTradeDraft.estimatedTransferCost)}</div>
              <div className="text-slate-400">{t('dashboard.marketRegionalDraftRevenue')}</div>
              <div className="text-right text-slate-200">{formatCurrency(regionalTradeDraft.estimatedRevenue)}</div>
              <div className="text-slate-400">{t('dashboard.marketRegionalDraftNetProfit')}</div>
              <div className={`text-right font-semibold ${regionalTradeDraft.estimatedNetProfit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(regionalTradeDraft.estimatedNetProfit)}
              </div>
            </div>
            <div className="text-xs text-slate-500">
              {t('dashboard.marketRegionalCapitalRequired', { value: formatCurrency(getRegionalTradeRequiredCapital(regionalTradeDraft)) })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={handleSimulate}
              disabled={commitPhase === 'committing'}
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('dashboard.marketRegionalDraftSimulate')}
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={commitPhase === 'committing'}
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {commitPhase === 'committing'
                ? t('dashboard.commitPhaseExecuting')
                : t('dashboard.primaryActionCta')}
            </button>
          </div>

          {/* Simulation error */}
          {simulationError ? (
            <div className="mt-3 text-sm text-rose-300">{simulationError}</div>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════
              SIMULATION RESULT (preview feel — lighter, informational)
              ═══════════════════════════════════════════════════════════ */}
          {latestSimulation && commitPhase === 'idle' ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-400/20 bg-emerald-400/5">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                    {t('dashboard.simulationSuccessTitle')}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
                    {t('dashboard.marketRegionalDraftSimulation')}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  {t('dashboard.marketRegionalSimulationResultSummary', {
                    quantity: formatNumber(latestSimulation.quantity),
                    resource: t(`resources.${latestSimulation.resourceId}.name`),
                    buyLocation: t(`locations.${latestSimulation.buyContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`),
                    sellLocation: t(`locations.${latestSimulation.sellContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`),
                  })}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-slate-400">{t('dashboard.simulationNetProfitLabel')}</div>
                  <div className={`text-right font-semibold ${latestSimulation.estimatedNetProfit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(latestSimulation.estimatedNetProfit)}
                  </div>
                  <div className="text-slate-400">{t('dashboard.simulationCapitalChangeLabel')}</div>
                  <div className="text-right text-slate-200">
                    {formatCurrency(latestSimulation.capitalBefore)} → {formatCurrency(latestSimulation.capitalAfter)}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* ═══════════════════════════════════════════════════════════
              COMMIT RESULT (result-screen feel — strong, impactful)
              ═══════════════════════════════════════════════════════════ */}
          {commitPhase === 'committed' && commitResult ? (
            <div
              key={commitResult.id}
              className="animate-commit-result mt-4 overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-amber-400/8 shadow-[0_0_24px_rgba(250,204,21,0.12)]"
            >
              <div className="px-5 py-4">
                {/* Header with badge */}
                <div className="flex items-center gap-3">
                  <span className="animate-commit-profit-pop text-base font-bold text-amber-300">
                    {t('dashboard.commitResultTitle')}
                  </span>
                  <span className="animate-commit-pulse rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-amber-400">
                    {t('dashboard.commitBadge')}
                  </span>
                </div>
                <div className="mt-1 text-sm text-amber-200/70">{t('dashboard.commitResultSubtitle')}</div>

                {/* Summary */}
                <div className="mt-3 text-sm text-slate-200">
                  {t('dashboard.commitResultSummary', {
                    quantity: formatNumber(commitResult.quantity),
                    resource: t(`resources.${commitResult.resourceId}.name`),
                    buyLocation: t(`locations.${commitResult.buyContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`),
                    sellLocation: t(`locations.${commitResult.sellContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`),
                  })}
                </div>

                {/* Net profit — large and prominent */}
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wider text-amber-300">
                    {t('dashboard.commitNetProfitLabel')}
                  </div>
                  <div className={`animate-commit-profit-pop mt-1 text-2xl font-bold ${commitResult.netProfit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {commitResult.netProfit > 0 ? '+' : ''}{formatCurrency(commitResult.netProfit)}
                  </div>
                </div>

                {/* Capital before → after */}
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 px-3 py-2">
                    <div className="text-xs uppercase tracking-wider text-slate-500">{t('dashboard.commitCapitalBeforeLabel')}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-300">{formatCurrency(commitResult.capitalBefore)}</div>
                  </div>
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2">
                    <div className="text-xs uppercase tracking-wider text-amber-300">{t('dashboard.commitCapitalAfterLabel')}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-50">{formatCurrency(commitResult.capitalAfter)}</div>
                  </div>
                </div>

                {/* Continue hint */}
                <div className="mt-3 text-sm text-slate-400">{t('dashboard.commitContinueHint')}</div>
              </div>
            </div>
          ) : null}
        </PageCard>
      ) : null}

      {/* ── Recent simulations / activity feed ──────────────────────── */}
      {tradeSimState.recentSimulations.length > 0 ? (
        <PageCard>
          <div className="text-sm text-slate-400">{t('dashboard.marketRegionalHistoryTitle')}</div>
          <div className="mt-1 text-xs text-slate-500">{t('dashboard.marketRegionalHistoryLimit')}</div>
          <div className="mt-3 space-y-3">
            {tradeSimState.recentSimulations.map((sim) => (
              <div
                key={sim.id}
                className={`rounded-xl border px-4 py-3 ${
                  commitResult && commitResult.id === `commit-${sim.id}`
                    ? 'animate-commit-glow border-amber-400/30 bg-amber-400/5'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-50">
                        {t(`resources.${sim.resourceId}.name`)}
                      </span>
                      {commitResult && commitResult.id === `commit-${sim.id}` ? (
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                          {t('dashboard.commitLedgerBadge')}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {t('dashboard.marketRegionalHistoryRoute', {
                        buyLocation: t(`locations.${sim.buyContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`),
                        sellLocation: t(`locations.${sim.sellContextKey === 'region_anchor' ? 'primary_storage' : 'remote_storage'}.name`),
                        quantity: formatNumber(sim.quantity),
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-semibold ${sim.estimatedNetProfit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {sim.estimatedNetProfit > 0 ? '+' : ''}{formatCurrency(sim.estimatedNetProfit)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {t('dashboard.marketRegionalHistoryCapitalAfter', { value: formatCurrency(sim.capitalAfter) })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PageCard>
      ) : null}

      {/* ── Ledger section ───────────────────────────────────────────── */}
      <PageCard>
        <div className="text-sm text-slate-400">{t('dashboard.ledgerTitle')}</div>
        {ledger.length > 0 ? (
          <div className="mt-3 space-y-3">
            {ledger.map((entry) => {
              const tone = getLedgerAmountTone(entry);
              const amountDisplayKind = getLedgerAmountDisplayKind(entry);
              const signedAmount = getLedgerSignedAmount(entry);
              const toneLabelKey = getLedgerToneLabelKey(entry);
              const badgeKey = getLedgerActionBadgeKey(entry);
              const buildingTypeId = getLedgerBuildingTypeId(entry);
              const amountClassName =
                tone === 'positive' ? 'text-emerald-300'
                  : tone === 'negative' ? 'text-rose-300'
                    : 'text-slate-200';

              const isBuildEntry = entry.actionType === 'build';
              const isTransformStartEntry = entry.actionType === 'production_transform_started';
              const isProductionCompletedEntry = entry.actionType === 'production_completed';

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
                        resource: entry.resourceId ? t(`resources.${entry.resourceId}.name`) : '',
                        amount: formatNumber(entry.amount),
                      })}
                    </div>
                    {isBuildEntry && buildingTypeId ? (
                      <div className="mt-1 text-xs text-slate-400">
                        {t('dashboard.ledgerBuildOutcome', {
                          building: t(`buildingTypes.${buildingTypeId}.name`),
                        })}
                      </div>
                    ) : null}
                    {isTransformStartEntry && entry.resourceId ? (
                      <div className="mt-1 text-xs text-slate-400">
                        {t('dashboard.ledgerTransformStartedOutcome', {
                          resource: t(`resources.${entry.resourceId}.name`),
                        })}
                      </div>
                    ) : null}
                    {isProductionCompletedEntry && entry.resourceId ? (
                      <div className="mt-1 text-xs text-emerald-300">
                        {t('dashboard.ledgerProductionOutcome', {
                          amount: formatNumber(entry.amount),
                          resource: t(`resources.${entry.resourceId}.name`),
                        })}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-left sm:text-right">
                    {amountDisplayKind === 'badge' && badgeKey ? (
                      <div className="inline-flex rounded-full border border-slate-700 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                        {t(badgeKey)}
                      </div>
                    ) : (
                      <>
                        <div className={`text-sm font-semibold ${amountClassName}`}>
                          {signedAmount.sign}
                          {amountDisplayKind === 'currency'
                            ? formatCurrency(signedAmount.absoluteAmount)
                            : formatNumber(signedAmount.absoluteAmount)}
                        </div>
                        {toneLabelKey ? (
                          <div className={`mt-1 text-[10px] font-semibold uppercase tracking-wide ${amountClassName}`}>
                            {t(toneLabelKey)}
                          </div>
                        ) : null}
                      </>
                    )}
                    <div className="mt-1 text-xs text-slate-400">{formatDate(entry.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 text-sm text-slate-300">{t('dashboard.emptyLedger')}</div>
        )}
      </PageCard>

      {/* ── News section ─────────────────────────────────────────────── */}
      <PageCard>
        <div className="text-sm text-slate-400">{t('dashboard.newsTitle')}</div>
        {news.length > 0 ? (
          <div className="mt-3 space-y-3">
            {news.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-800 px-3 py-3">
                <div className="text-sm font-medium text-slate-50">{t(item.headlineKey)}</div>
                <div className="mt-1 text-sm text-slate-300">{t(item.bodyKey)}</div>
                <div className="mt-2 text-xs text-slate-400">{formatDate(item.createdAt)}</div>
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
