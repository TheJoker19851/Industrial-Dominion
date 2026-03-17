import { describe, expect, it } from 'vitest';
import {
  getStoredLocale,
  localeStorageKey,
  persistLocale,
  resolveInitialLocale,
} from '../src/i18n/config';

describe('locale persistence helpers', () => {
  it('reads and writes supported locales from storage', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };

    persistLocale('fr', storage);

    expect(values.get(localeStorageKey)).toBe('fr');
    expect(getStoredLocale(storage)).toBe('fr');
  });

  it('falls back when storage contains an unsupported locale', () => {
    const storage = {
      getItem: () => 'de',
    };

    expect(getStoredLocale(storage)).toBeNull();
    expect(
      resolveInitialLocale({ storedLocale: 'de', defaultLocale: 'en' }),
    ).toBe('en');
  });
});
