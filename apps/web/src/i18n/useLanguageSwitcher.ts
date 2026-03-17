import { useTranslation } from 'react-i18next';
import { fallbackLocale, resolveInitialLocale, toggleLocale } from './config';

export function useLanguageSwitcher() {
  const { i18n } = useTranslation();

  const locale = resolveInitialLocale({
    storedLocale: i18n.resolvedLanguage ?? i18n.language,
    defaultLocale: fallbackLocale,
  });

  return {
    locale,
    changeLanguage: (nextLocale: string) => i18n.changeLanguage(nextLocale),
    toggleLanguage: () => i18n.changeLanguage(toggleLocale(locale)),
  };
}
