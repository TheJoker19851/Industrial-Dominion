import type { MarketSnapshot, ResourceId } from '@industrial-dominion/shared';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type MarketScenario = {
  key: string;
  priceAdjustments: Partial<Record<ResourceId, Partial<Record<string, number>>>>;
  inventoryQuantityAdjustments: Partial<Record<ResourceId, number>>;
};

export const MARKET_PREVIEW_REFRESH_STORAGE_KEY =
  'industrial-dominion.market-preview-refresh-cycle';

const MARKET_PREVIEW_SCENARIOS: MarketScenario[] = [
  {
    key: 'foundry_push',
    priceAdjustments: {
      iron_ore: {
        region_anchor: -1,
        trade_hub: 1,
      },
      iron_ingot: {
        trade_hub: 3,
      },
      coal: {
        trade_hub: 1,
      },
    },
    inventoryQuantityAdjustments: {
      iron_ore: 8,
    },
  },
  {
    key: 'harvest_window',
    priceAdjustments: {
      water: {
        region_anchor: -1,
      },
      crops: {
        trade_hub: 2,
      },
      iron_ore: {
        trade_hub: -1,
      },
    },
    inventoryQuantityAdjustments: {
      water: 6,
      crops: 4,
    },
  },
  {
    key: 'fuel_rush',
    priceAdjustments: {
      wood: {
        region_anchor: -1,
      },
      coal: {
        trade_hub: 3,
      },
      iron_ingot: {
        trade_hub: -2,
      },
    },
    inventoryQuantityAdjustments: {
      wood: 6,
      coal: 5,
    },
  },
];

function getScenario(cycle: number) {
  if (cycle <= 0) {
    return null;
  }

  return MARKET_PREVIEW_SCENARIOS[(cycle - 1) % MARKET_PREVIEW_SCENARIOS.length]!;
}

function getAdjustedOfferPrice(
  snapshot: MarketSnapshot,
  resourceId: ResourceId,
  contextKey: string,
) {
  const offer = snapshot.offers.find((entry) => entry.resourceId === resourceId);

  if (!offer) {
    return 0;
  }

  return (
    offer.contextPrices.find((quote) => quote.contextKey === contextKey)?.price ?? offer.basePrice
  );
}

export function restoreMarketPreviewRefreshCycle(storage: StorageLike | null | undefined) {
  if (!storage) {
    return 0;
  }

  try {
    const rawValue = storage.getItem(MARKET_PREVIEW_REFRESH_STORAGE_KEY);
    const parsed = rawValue ? Number.parseInt(rawValue, 10) : 0;

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function persistMarketPreviewRefreshCycle(
  storage: StorageLike | null | undefined,
  cycle: number,
) {
  if (!storage) {
    return;
  }

  storage.setItem(MARKET_PREVIEW_REFRESH_STORAGE_KEY, `${Math.max(0, Math.floor(cycle))}`);
}

export function getRefreshedPreviewMarketSnapshot(
  snapshot: MarketSnapshot,
  cycle: number,
) {
  const scenario = getScenario(cycle);

  if (!scenario) {
    return {
      snapshot,
      cycle: 0,
      scenarioKey: 'baseline',
    };
  }

  // MVP assumption: a refresh rotates through a few bounded market pulses.
  // The session stays deterministic while still making prices and visible stock
  // feel less frozen during repeated dashboard playtests.
  const refreshedOffers = snapshot.offers.map((offer) => ({
    ...offer,
    contextPrices: offer.contextPrices.map((quote) => {
      const delta = scenario.priceAdjustments[offer.resourceId]?.[quote.contextKey] ?? 0;
      const price = Math.max(1, quote.price + delta);

      return {
        contextKey: quote.contextKey,
        price,
        modifierPercent: Number(((price - offer.basePrice) / Math.max(offer.basePrice, 1)).toFixed(2)),
      };
    }),
  }));

  const refreshedSnapshot: MarketSnapshot = {
    ...snapshot,
    offers: refreshedOffers,
    inventory: snapshot.inventory.map((entry) => {
      const quantity = Math.max(
        1,
        entry.quantity + (scenario.inventoryQuantityAdjustments[entry.resourceId] ?? 0),
      );
      const effectivePrice = getAdjustedOfferPrice(
        { ...snapshot, offers: refreshedOffers },
        entry.resourceId,
        entry.marketContextKey,
      );
      const grossValue = effectivePrice * quantity;
      const feeAmount = Math.round(grossValue * snapshot.marketFeeRate);

      return {
        ...entry,
        quantity,
        effectivePrice,
        grossValue,
        feeAmount,
        netValue: grossValue - feeAmount,
      };
    }),
  };

  return {
    snapshot: refreshedSnapshot,
    cycle,
    scenarioKey: scenario.key,
  };
}
