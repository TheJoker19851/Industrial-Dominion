import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguageSwitcher } from '@/i18n/useLanguageSwitcher';
import { TutorialPanel } from '@/features/tutorial/TutorialPanel';
import { appNavigationItems } from './navigation';

export function AppShell() {
  const { t } = useTranslation();
  const { locale, toggleLanguage } = useLanguageSwitcher();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(212,162,76,0.16),_transparent_40%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,1))]" />
      <div className="absolute inset-0 -z-10 bg-industrial-grid bg-[size:32px_32px] opacity-20" />

      <header className="border-b border-line/80 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">
              {t('common.shellBadge')}
            </div>
            <div className="truncate font-semibold text-slate-50">
              {t('common.appName')}
            </div>
          </div>
          <nav className="hidden items-center gap-2 md:flex">
            {appNavigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'rounded-full px-3 py-2 text-sm transition',
                    isActive
                      ? 'bg-accent text-slate-950'
                      : 'text-slate-300 hover:bg-white/5 hover:text-slate-50',
                  ].join(' ')
                }
                end={item.to === '/'}
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
          <button
            className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-accent hover:text-accent"
            onClick={toggleLanguage}
          >
            {locale.toUpperCase()}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-6">
        <section className="mb-6 rounded-3xl border border-line bg-panel/80 p-5 shadow-panel md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.28em] text-accent">
                {t('shell.kicker')}
              </p>
              <h1 className="max-w-2xl text-2xl font-semibold text-slate-50 md:text-4xl">
                {t('shell.headline')}
              </h1>
              <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                {t('shell.subheadline')}
              </p>
            </div>
          </div>
        </section>
        <div className="mb-6">
          <TutorialPanel />
        </div>
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-line bg-slate-950/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-4 gap-2">
          {appNavigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded-2xl px-2 py-3 text-center text-[11px] font-medium leading-tight transition',
                  isActive
                    ? 'bg-accent text-slate-950 shadow-[0_10px_30px_rgba(212,162,76,0.2)]'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-slate-50',
                ].join(' ')
              }
              end={item.to === '/'}
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
