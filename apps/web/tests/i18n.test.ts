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

  it('contains processor-gated starter-loop feedback keys in both locales', () => {
    const en = i18nResources.en.translation as Record<string, unknown>;
    const fr = i18nResources.fr.translation as Record<string, unknown>;

    const enDashboard = en.dashboard as Record<string, string>;
    const frDashboard = fr.dashboard as Record<string, string>;
    const enGameplayErrors = en.gameplayErrors as Record<string, string>;
    const frGameplayErrors = fr.gameplayErrors as Record<string, string>;

    expect(enDashboard.transformProcessingInstallationRequired).toBeTruthy();
    expect(frDashboard.transformProcessingInstallationRequired).toBeTruthy();
    expect(enDashboard.ledgerBuildOutcome).toBeTruthy();
    expect(frDashboard.ledgerBuildOutcome).toBeTruthy();
    expect(enDashboard.ledgerTransformStartedOutcome).toBeTruthy();
    expect(frDashboard.ledgerTransformStartedOutcome).toBeTruthy();
    expect(enDashboard.ledgerProductionOutcome).toBeTruthy();
    expect(frDashboard.ledgerProductionOutcome).toBeTruthy();
    expect(enGameplayErrors.processingInstallationRequiredForProduction).toBeTruthy();
    expect(frGameplayErrors.processingInstallationRequiredForProduction).toBeTruthy();
  });
});
