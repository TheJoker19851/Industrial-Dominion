import type { AppLocale } from './config';

const usdCurrencyByLocale: Record<AppLocale, string> = {
  en: 'USD',
  fr: 'USD',
};

export function formatNumber(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatCurrency(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: usdCurrencyByLocale[locale],
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentage(value: number, locale: AppLocale): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatDate(
  value: Date | number | string,
  locale: AppLocale,
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}
