import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercentage,
} from '../src/i18n/format';

describe('locale-aware formatting helpers', () => {
  it('formats numbers per locale', () => {
    expect(formatNumber(1234567.89, 'en')).toBe('1,234,567.89');
    expect(formatNumber(1234567.89, 'fr')).toBe('1\u202f234\u202f567,89');
  });

  it('formats currency per locale', () => {
    expect(formatCurrency(2500, 'en')).toBe('$2,500');
    expect(formatCurrency(2500, 'fr')).toBe('2\u202f500\u00a0$US');
  });

  it('formats percentages per locale', () => {
    expect(formatPercentage(0.125, 'en')).toBe('12.5%');
    expect(formatPercentage(0.125, 'fr')).toBe('12,5\u00a0%');
  });

  it('formats dates per locale', () => {
    expect(formatDate('2026-03-15T00:00:00.000Z', 'en')).toBe('Mar 15, 2026');
    expect(formatDate('2026-03-15T00:00:00.000Z', 'fr')).toBe('15 mars 2026');
  });
});
