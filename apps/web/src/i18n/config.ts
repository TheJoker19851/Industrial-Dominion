export const supportedLocales = ['en', 'fr'] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const fallbackLocale: AppLocale = 'en';
export const localeStorageKey = 'industrial-dominion.locale';

export function isSupportedLocale(locale: string): locale is AppLocale {
  return supportedLocales.includes(locale as AppLocale);
}

export function getStoredLocale(
  storage: Pick<Storage, 'getItem'> | undefined,
): AppLocale | null {
  if (!storage) {
    return null;
  }

  const storedLocale = storage.getItem(localeStorageKey);
  return storedLocale && isSupportedLocale(storedLocale) ? storedLocale : null;
}

export function persistLocale(
  locale: AppLocale,
  storage: Pick<Storage, 'setItem'> | undefined,
) {
  storage?.setItem(localeStorageKey, locale);
}

export function resolveInitialLocale(options?: {
  defaultLocale?: string;
  storedLocale?: string | null;
  browserLocale?: string;
}): AppLocale {
  const candidates = [
    options?.storedLocale,
    options?.browserLocale?.split('-')[0],
    options?.defaultLocale,
    fallbackLocale,
  ];

  for (const candidate of candidates) {
    if (candidate && isSupportedLocale(candidate)) {
      return candidate;
    }
  }

  return fallbackLocale;
}

export function toggleLocale(locale: AppLocale): AppLocale {
  return locale === 'en' ? 'fr' : 'en';
}
