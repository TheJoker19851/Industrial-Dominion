export function clampSellQuantity(value: number, maxQuantity: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.min(Math.floor(value), Math.max(1, maxQuantity));
}

export function clampBuyQuantity(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}

export function clampOrderPrice(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    return 1;
  }

  return Math.floor(value);
}
