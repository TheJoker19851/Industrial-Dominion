import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/AuthProvider';
import { useLanguageSwitcher } from '@/i18n/useLanguageSwitcher';

export function SettingsPage() {
  const { t } = useTranslation();
  const { locale, toggleLanguage } = useLanguageSwitcher();
  const { session, isLoading, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [statusKey, setStatusKey] = useState<
    'idle' | 'linkSent' | 'signedOut' | 'authError'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');

  return (
    <div className="space-y-4 pb-16 md:pb-0">
      <h2 className="text-2xl font-bold">{t('settings.title')}</h2>
      <p className="text-sm text-slate-300">
        {t('settings.currentLanguage', { locale: locale.toUpperCase() })}
      </p>
      <button
        className="rounded-full border border-line px-4 py-2"
        onClick={toggleLanguage}
      >
        {t('settings.toggleLanguage')}
      </button>

      <section className="space-y-3 rounded-2xl border border-line bg-panel/60 p-4">
        <h3 className="text-lg font-semibold text-slate-50">
          {t('settings.authTitle')}
        </h3>

        {isLoading ? (
          <p className="text-sm text-slate-300">{t('settings.authLoading')}</p>
        ) : session?.user ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              {t('settings.signedInAs', { email: session.user.email ?? '-' })}
            </p>
            <button
              className="rounded-full border border-line px-4 py-2"
              onClick={async () => {
                const result = await signOut();

                if (result.error) {
                  setStatusKey('authError');
                  setErrorMessage(result.error);
                  return;
                }

                setStatusKey('signedOut');
                setErrorMessage('');
              }}
            >
              {t('settings.signOut')}
            </button>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();

              const result = await signInWithEmail(email);

              if (result.error) {
                setStatusKey('authError');
                setErrorMessage(result.error);
                return;
              }

              setStatusKey('linkSent');
              setErrorMessage('');
            }}
          >
            <label
              className="block text-sm text-slate-300"
              htmlFor="auth-email"
            >
              {t('settings.emailLabel')}
            </label>
            <input
              id="auth-email"
              className="w-full rounded-xl border border-line bg-slate-950 px-3 py-2 text-slate-100"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('settings.emailPlaceholder')}
              required
            />
            <button
              className="rounded-full border border-line px-4 py-2"
              type="submit"
            >
              {t('settings.sendMagicLink')}
            </button>
          </form>
        )}

        {statusKey !== 'idle' ? (
          <p className="text-sm text-slate-300">
            {statusKey === 'authError'
              ? t('settings.authError', { message: errorMessage })
              : t(`settings.${statusKey}`)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
