import { describe, expect, it } from 'vitest';
import { clampBuyQuantity, clampSellQuantity } from '../src/features/market/market-model';

describe('market model helpers', () => {
  it('clamps invalid quantities to the minimum sellable value', () => {
    expect(clampSellQuantity(0, 10)).toBe(1);
    expect(clampSellQuantity(Number.NaN, 10)).toBe(1);
  });

  it('clamps quantities to the available inventory', () => {
    expect(clampSellQuantity(15, 10)).toBe(10);
  });

  it('rounds down fractional quantities', () => {
    expect(clampSellQuantity(3.9, 10)).toBe(3);
  });

  it('clamps invalid buy quantities to the minimum buyable value', () => {
    expect(clampBuyQuantity(0)).toBe(1);
    expect(clampBuyQuantity(Number.NaN)).toBe(1);
    expect(clampBuyQuantity(4.8)).toBe(4);
  });
});
