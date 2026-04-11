import type {
  MarketContextKey,
  MarketContextPrice,
  MarketContextSummary,
  PlayerLocationKey,
  RegionId,
  ResourceId,
} from '@industrial-dominion/shared';

interface PlayerLocationContext {
  id: string;
  key: PlayerLocationKey;
  nameKey: string;
}

const regionalFocusResourceByRegion: Record<RegionId, ResourceId> = {
  ironridge: 'iron_ore',
  greenhaven: 'wood',
  sunbarrel: 'crude_oil',
  riverplain: 'water',
};

const tradeHubPremiums: Partial<Record<ResourceId, number>> = {
  iron_ingot: 0.18,
  iron_ore: 0.05,
  coal: 0.04,
};

const tradeHubBuyPressure: Partial<Record<ResourceId, number>> = {
  iron_ingot: 0.1,
  iron_ore: 0.08,
};

const regionalAnchorDiscount = -0.15;
const regionalAnchorSellPressure = -0.1;

function roundRegionalPrice(basePrice: number, modifier: number) {
  return Math.max(1, Math.round(basePrice * (1 + modifier)));
}

export function buildMarketContexts(input: {
  regionId: RegionId | undefined;
  locations: PlayerLocationContext[];
}): MarketContextSummary[] {
  const focusResourceId = regionalFocusResourceByRegion[input.regionId ?? 'ironridge'];
  const primaryLocation = input.locations.find((entry) => entry.key === 'primary_storage');
  const remoteLocation =
    input.locations.find((entry) => entry.key === 'remote_storage') ?? primaryLocation;

  if (!primaryLocation || !remoteLocation) {
    return [];
  }

  return [
    {
      key: 'region_anchor',
      labelKey: input.regionId ? `regions.${input.regionId}.name` : primaryLocation.nameKey,
      descriptionKey: 'market.contextDescriptions.region_anchor',
      locationId: primaryLocation.id,
      locationNameKey: primaryLocation.nameKey,
      focusResourceId,
    },
    {
      key: 'trade_hub',
      labelKey: 'dashboard.network.tradeHubTitle',
      descriptionKey: 'market.contextDescriptions.trade_hub',
      locationId: remoteLocation.id,
      locationNameKey: remoteLocation.nameKey,
      focusResourceId: 'iron_ingot',
    },
  ];
}

export function getMarketContextPrice(input: {
  contextKey: MarketContextKey;
  regionId: RegionId | undefined;
  resourceId: ResourceId;
  basePrice: number;
  side: 'buy' | 'sell';
}): MarketContextPrice {
  const regionalFocusResourceId = regionalFocusResourceByRegion[input.regionId ?? 'ironridge'];
  let modifier = 0;

  if (input.contextKey === 'region_anchor') {
    if (input.resourceId === regionalFocusResourceId) {
      modifier = input.side === 'buy' ? regionalAnchorDiscount : regionalAnchorSellPressure;
    }
  }

  if (input.contextKey === 'trade_hub') {
    modifier =
      input.side === 'buy'
        ? tradeHubBuyPressure[input.resourceId] ?? 0
        : tradeHubPremiums[input.resourceId] ?? 0;
  }

  return {
    contextKey: input.contextKey,
    price: roundRegionalPrice(input.basePrice, modifier),
    modifierPercent: modifier,
  };
}
