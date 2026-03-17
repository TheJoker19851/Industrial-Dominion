import { useTranslation } from 'react-i18next';
import { fallbackLocale, isSupportedLocale, type AppLocale } from './config';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercentage,
} from './format';

function resolveLocale(locale: string): AppLocale {
  return isSupportedLocale(locale) ? locale : fallbackLocale;
}

export function useFormatters() {
  const { i18n } = useTranslation();
  const locale = resolveLocale(i18n.resolvedLanguage ?? i18n.language);

  return {
    locale,
    formatNumber: (value: number) => formatNumber(value, locale),
    formatCurrency: (value: number) => formatCurrency(value, locale),
    formatPercentage: (value: number) => formatPercentage(value, locale),
    formatDate: (value: Date | number | string) => formatDate(value, locale),
  };
}
