import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  fallbackLocale,
  getStoredLocale,
  persistLocale,
  resolveInitialLocale,
  supportedLocales,
} from './config';
import { i18nResources } from './resources';

const browserStorage =
  typeof window !== 'undefined' && 'localStorage' in window
    ? window.localStorage
    : undefined;

const initialLocale = resolveInitialLocale({
  defaultLocale: import.meta.env.VITE_DEFAULT_LOCALE || fallbackLocale,
  storedLocale: getStoredLocale(browserStorage),
  browserLocale:
    typeof navigator !== 'undefined' ? navigator.language : undefined,
});

void i18n.use(initReactI18next).init({
  resources: i18nResources,
  lng: initialLocale,
  fallbackLng: fallbackLocale,
  supportedLngs: supportedLocales,
  load: 'languageOnly',
  returnNull: false,
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (locale) => {
  if (locale && locale !== i18n.resolvedLanguage) {
    return;
  }

  const nextLocale = resolveInitialLocale({
    storedLocale: locale,
  });

  persistLocale(nextLocale, browserStorage);
});

export default i18n;
