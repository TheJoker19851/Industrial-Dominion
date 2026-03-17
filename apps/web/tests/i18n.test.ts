import { describe, expect, it } from 'vitest';
import {
  fallbackLocale,
  localeStorageKey,
  resolveInitialLocale,
  supportedLocales,
  toggleLocale,
} from '../src/i18n/config';
import { i18nResources } from '../src/i18n/resources';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, nestedValue]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      return flattenKeys(nestedValue, nextPrefix);
    },
  );
}

describe('i18n framework', () => {
  it('supports English and French with English as the fallback', () => {
    expect(supportedLocales).toEqual(['en', 'fr']);
    expect(fallbackLocale).toBe('en');
    expect(localeStorageKey).toBe('industrial-dominion.locale');
  });

  it('keeps locale translation keys aligned', () => {
    const englishKeys = flattenKeys(i18nResources.en.translation).sort();
    const frenchKeys = flattenKeys(i18nResources.fr.translation).sort();

    expect(frenchKeys).toEqual(englishKeys);
  });

  it('resolves and toggles locales predictably', () => {
    expect(
      resolveInitialLocale({ storedLocale: 'fr', defaultLocale: 'en' }),
    ).toBe('fr');
    expect(
      resolveInitialLocale({ browserLocale: 'fr-CA', defaultLocale: 'en' }),
    ).toBe('fr');
    expect(
      resolveInitialLocale({ storedLocale: 'de', defaultLocale: 'en' }),
    ).toBe('en');
    expect(toggleLocale('en')).toBe('fr');
    expect(toggleLocale('fr')).toBe('en');
  });
});
