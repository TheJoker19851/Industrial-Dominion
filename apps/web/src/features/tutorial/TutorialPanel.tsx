import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageCard } from '@industrial-dominion/ui';
import { useTranslation } from 'react-i18next';
import {
  getStarterTutorialCurrentStep,
  type StarterTutorialStepId,
} from '@industrial-dominion/shared';
import { useAuth } from '@/features/auth/AuthProvider';
import { skipStarterTutorial, getStarterTutorial } from './tutorial-api';

function getTutorialStepPath(stepId: StarterTutorialStepId) {
  switch (stepId) {
    case 'buy_resource':
    case 'sell_resource':
      return '/market';
    default:
      return '/';
  }
}

export function TutorialPanel() {
  const { t } = useTranslation();
  const { session, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token ?? null;
  const tutorialQuery = useQuery({
    queryKey: ['starter-tutorial', session?.user.id],
    queryFn: () => getStarterTutorial(accessToken!),
    enabled: Boolean(accessToken),
  });
  const skipMutation = useMutation({
    mutationFn: () => skipStarterTutorial(accessToken!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['starter-tutorial', session?.user.id],
      });
    },
  });

  if (isAuthLoading || !session || tutorialQuery.isLoading || tutorialQuery.isError) {
    return null;
  }

  const progress = tutorialQuery.data;

  if (!progress || progress.isSkipped) {
    return null;
  }

  const step = getStarterTutorialCurrentStep(progress);

  if (!step) {
    return null;
  }

  const ctaHref = getTutorialStepPath(progress.currentStepId);

  return (
    <PageCard>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.28em] text-accent">
              {t('tutorial.title')}
            </p>
            <p className="text-sm text-slate-300">
              {t('tutorial.progress', {
                current: progress.currentStepIndex,
                total: progress.totalSteps,
              })}
            </p>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-slate-50">
              {t(step.titleKey)}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              {t(step.descriptionKey)}
            </p>
            <p className="text-sm font-medium text-slate-100">
              {t('tutorial.objectiveLabel')} {t(step.objectiveKey)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
          <Link
            to={ctaHref}
            className="inline-flex items-center justify-center rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            {t('tutorial.openAction')}
          </Link>
          {!progress.isCompleted ? (
            <button
              type="button"
              onClick={() => skipMutation.mutate()}
              disabled={skipMutation.isPending}
              className="rounded-full border border-line px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {skipMutation.isPending ? t('tutorial.skipping') : t('tutorial.skip')}
            </button>
          ) : null}
        </div>
      </div>
    </PageCard>
  );
}
