import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageCard } from '@industrial-dominion/ui';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { RegionId } from '@industrial-dominion/shared';
import { useAuth } from '@/features/auth/AuthProvider';
import { getGameplayErrorKey } from '@/features/gameplay/gameplay-error';
import { completeBootstrap, fetchBootstrapStatus } from './bootstrap-api';
import { regionOptions } from './region-options';

export function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const { session, isLoading: isAuthLoading } = useAuth();
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId>('ironridge');
  const queryClient = useQueryClient();
  const selectedRegion = regionOptions.find(
    (region) => region.id === selectedRegionId,
  );
  const accessToken = session?.access_token ?? null;
  const bootstrapStatusQuery = useQuery({
    queryKey: ['bootstrap-status', accessToken],
    queryFn: () => fetchBootstrapStatus(accessToken!),
    enabled: Boolean(accessToken),
  });
  const bootstrapMutation = useMutation({
    mutationFn: (regionId: RegionId) =>
      completeBootstrap(accessToken!, {
        regionId,
        locale: i18n.resolvedLanguage === 'fr' ? 'fr' : 'en',
      }),
    onSuccess: async (result) => {
      if (result.player?.regionId) {
        setSelectedRegionId(result.player.regionId);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['bootstrap-status', accessToken],
        }),
        queryClient.invalidateQueries({
          queryKey: ['starter-tutorial', session?.user.id],
        }),
      ]);
    },
  });

  useEffect(() => {
    if (bootstrapStatusQuery.data?.player?.regionId) {
      setSelectedRegionId(bootstrapStatusQuery.data.player.regionId);
    }
  }, [bootstrapStatusQuery.data?.player?.regionId]);

  if (isAuthLoading) {
    return <p className="pb-16 text-sm text-slate-300 md:pb-0">{t('onboarding.authLoading')}</p>;
  }

  if (!session) {
    return <p className="pb-16 text-sm text-slate-300 md:pb-0">{t('onboarding.signInRequired')}</p>;
  }

  if (bootstrapStatusQuery.isLoading) {
    return <p className="pb-16 text-sm text-slate-300 md:pb-0">{t('onboarding.statusLoading')}</p>;
  }

  if (bootstrapStatusQuery.data?.isBootstrapped && bootstrapStatusQuery.data.player) {
    return (
      <div className="space-y-4 pb-16 md:pb-0">
        <h2 className="text-2xl font-bold">{t('onboarding.title')}</h2>
        <PageCard>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.28em] text-accent">
              {t('onboarding.completedKicker')}
            </p>
            <h3 className="text-xl font-semibold text-slate-50">
              {t(`regions.${bootstrapStatusQuery.data.player.regionId}.name`)}
            </h3>
            <p className="text-sm leading-6 text-slate-300">
              {t('onboarding.completedBody')}
            </p>
            <Link
              to="/"
              className="inline-flex rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
            >
              {t('onboarding.openDashboard')}
            </Link>
          </div>
        </PageCard>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16 md:pb-0">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{t('onboarding.title')}</h2>
        <p className="max-w-2xl text-slate-300">{t('onboarding.subtitle')}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <section className="grid gap-4 sm:grid-cols-2">
          {regionOptions.map((region) => {
            const isSelected = selectedRegionId === region.id;

            return (
              <button
                key={region.id}
                className={[
                  'relative overflow-hidden rounded-3xl border bg-panel/70 p-5 text-left transition',
                  'focus:outline-none focus:ring-2 focus:ring-accent/70',
                  isSelected
                    ? 'border-accent shadow-[0_18px_60px_rgba(212,162,76,0.16)]'
                    : 'border-line hover:border-accent/60',
                ].join(' ')}
                onClick={() => setSelectedRegionId(region.id)}
                type="button"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${region.accentClassName}`}
                />
                <div className="relative space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-400">
                        {t('onboarding.regionCardLabel')}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-slate-50">
                        {t(`regions.${region.id}.name`)}
                      </h3>
                    </div>
                    <span
                      className={[
                        'rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em]',
                        isSelected
                          ? 'border-accent/70 bg-accent text-slate-950'
                          : 'border-line text-slate-300',
                      ].join(' ')}
                    >
                      {t(
                        isSelected
                          ? 'onboarding.selectedBadge'
                          : 'onboarding.selectBadge',
                      )}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-200">
                    {t(`regions.${region.id}.description`)}
                  </p>
                </div>
              </button>
            );
          })}
        </section>

        <PageCard>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">
                {t('onboarding.selectionKicker')}
              </p>
              <h3 className="text-xl font-semibold text-slate-50">
                {selectedRegion ? t(`regions.${selectedRegion.id}.name`) : ''}
              </h3>
              <p className="text-sm leading-6 text-slate-300">
                {selectedRegion
                  ? t(`regions.${selectedRegion.id}.description`)
                  : null}
              </p>
            </div>

            <div className="rounded-2xl border border-line bg-slate-950/60 p-4">
              <p className="text-sm font-medium text-slate-100">
                {t('onboarding.selectionPreviewTitle')}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {t('onboarding.selectionPreviewBody')}
              </p>
            </div>

            <button
              className="w-full rounded-2xl border border-accent bg-accent px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              disabled={bootstrapMutation.isPending}
              onClick={() => bootstrapMutation.mutate(selectedRegionId)}
              type="button"
            >
              {bootstrapMutation.isPending
                ? t('onboarding.confirmingRegion')
                : t('onboarding.confirmRegion')}
            </button>

            <p className="text-xs leading-5 text-slate-400">
              {bootstrapMutation.isError
                ? t(getGameplayErrorKey(bootstrapMutation.error.message))
                : bootstrapMutation.data?.alreadyGranted
                  ? t('onboarding.alreadyBootstrapped')
                  : t('onboarding.selectionHint')}
            </p>
          </div>
        </PageCard>
      </div>
    </div>
  );
}
