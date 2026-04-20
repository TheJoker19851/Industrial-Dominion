import type { FastifyInstance } from 'fastify';
import { gameConfig } from '@industrial-dominion/config';
import type {
  MarketBuyResult,
  MarketContextKey,
  MarketContextSummary,
  MarketContextPrice,
  MarketQuoteComparison,
  MarketLimitOrderResult,
  MarketOrderItem,
  MarketOfferItem,
  MarketTopOfBook,
  MarketSellResult,
  MarketSnapshot,
  MarketInventoryItem,
  PlayerProfile,
  RegionId,
  ResourceId,
  SlippageQuote,
  SupportedLocale,
} from '@industrial-dominion/shared';
import { calculateSlippageQuote } from '@industrial-dominion/shared';
import { readPlayerLocations } from '../../db/player-locations.js';
import { buildMarketContexts, getMarketContextPrice } from './market-context.js';

type PlayerRow = {
  id: string;
  locale: SupportedLocale;
  credits: number;
  region_id: RegionId | null;
};

type InventoryRow = {
  player_id: string;
  location_id: string;
  resource_id: ResourceId;
  quantity: number;
  resources: {
    base_price: number;
    tradable: boolean;
  } | null;
};

type PlayerLocationRow = {
  id: string;
  key: 'primary_storage' | 'remote_storage';
  name_key: string;
};

type OfferRow = {
  id: ResourceId;
  base_price: number;
  tradable: boolean;
};

type MarketOrderRow = {
  id: string;
  resource_id: ResourceId;
  side: 'buy' | 'sell';
  price_per_unit: number;
  quantity: number;
  remaining_quantity: number;
  status: 'open' | 'filled' | 'cancelled';
  created_at: string;
};

type MarketOrderBookRow = {
  resource_id: ResourceId;
  side: 'buy' | 'sell';
  price_per_unit: number;
  remaining_quantity: number;
  status: 'open' | 'filled' | 'cancelled';
};

type BuyRpcResult = {
  order_id: string;
  price_per_unit: number;
  total_cost: number;
  inventory_quantity: number;
  player_credits: number;
  location_id: string;
  market_context_key: MarketContextKey;
};

type SellRpcResult = {
  order_id: string;
  price_per_unit: number;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  inventory_quantity: number;
  player_credits: number;
  location_id: string;
  market_context_key: MarketContextKey;
};

type LimitOrderRpcResult = {
  order_id: string;
  resource_id: ResourceId;
  side: 'buy' | 'sell';
  price_per_unit: number;
  quantity: number;
  remaining_quantity: number;
  status: 'open' | 'filled' | 'cancelled';
  player_credits: number;
  inventory_quantity: number;
  matched_order_id: string | null;
  trade_id: string | null;
  created_at: string;
};

const instantTradeSpreadRate = 0.05;

function applyInstantTradeSpread(price: number, side: 'buy' | 'sell') {
  const adjustedPrice =
    side === 'buy'
      ? Math.round(price * (1 + instantTradeSpreadRate))
      : Math.round(price * (1 - instantTradeSpreadRate));

  return Math.max(1, adjustedPrice);
}

function toModifierPercent(price: number, basePrice: number) {
  return Number(((price - basePrice) / Math.max(basePrice, 1)).toFixed(2));
}

function buildQuoteComparison(input: {
  quotePrice: number;
  referencePrice: number | null;
  side: 'buy' | 'sell';
}): MarketQuoteComparison {
  const { quotePrice, referencePrice, side } = input;

  if (referencePrice === null) {
    return {
      referencePrice: null,
      deltaAbsolute: null,
      deltaPercent: null,
      relation: 'unavailable',
    };
  }

  const deltaAbsolute = Math.abs(quotePrice - referencePrice);
  const deltaPercent = Number((deltaAbsolute / Math.max(referencePrice, 1)).toFixed(2));

  if (quotePrice === referencePrice) {
    return {
      referencePrice,
      deltaAbsolute,
      deltaPercent,
      relation: 'equal',
    };
  }

  const relation =
    side === 'buy'
      ? quotePrice < referencePrice
        ? 'better'
        : 'worse'
      : quotePrice > referencePrice
        ? 'better'
        : 'worse';

  return {
    referencePrice,
    deltaAbsolute,
    deltaPercent,
    relation,
  };
}

function mapPlayer(player: PlayerRow | null): PlayerProfile | null {
  if (!player) {
    return null;
  }

  return {
    id: player.id,
    locale: player.locale,
    credits: player.credits,
    regionId: player.region_id ?? undefined,
  };
}

function optionalSlippage(quote: SlippageQuote): SlippageQuote | undefined {
  return quote.slippageBps > 0 ? quote : undefined;
}

function mapOfferItem(input: {
  entry: OfferRow;
  playerRegionId: RegionId | undefined;
  contexts: MarketContextSummary[];
  topOfBook: MarketTopOfBook;
}): MarketOfferItem | null {
  const { entry, playerRegionId, contexts, topOfBook } = input;

  if (!entry.tradable) {
    return null;
  }

  const contextPrices = contexts.map<MarketContextPrice>((context) =>
    {
      const contextQuote = getMarketContextPrice({
        contextKey: context.key,
        regionId: playerRegionId,
        resourceId: entry.id,
        basePrice: entry.base_price,
        side: 'buy',
      });
      const spreadAdjustedPrice = applyInstantTradeSpread(contextQuote.price, 'buy');

      return {
        contextKey: contextQuote.contextKey,
        price: spreadAdjustedPrice,
        modifierPercent: toModifierPercent(spreadAdjustedPrice, entry.base_price),
        bookComparison: buildQuoteComparison({
          quotePrice: spreadAdjustedPrice,
          referencePrice: topOfBook.bestAsk,
          side: 'buy',
        }),
      };
    },
  );

  return {
    resourceId: entry.id,
    basePrice: entry.base_price,
    contextPrices,
    topOfBook,
  };
}

function buildTopOfBookByResource(input: {
  offerRows: OfferRow[];
  openOrderRows: MarketOrderBookRow[];
}) {
  const topOfBookByResource = new Map<ResourceId, MarketTopOfBook>();

  for (const offerRow of input.offerRows) {
    topOfBookByResource.set(offerRow.id, {
      bestBid: null,
      bestAsk: null,
    });
  }

  for (const orderRow of input.openOrderRows) {
    const topOfBook = topOfBookByResource.get(orderRow.resource_id);

    if (!topOfBook) {
      continue;
    }

    if (orderRow.side === 'buy') {
      if (topOfBook.bestBid === null || orderRow.price_per_unit > topOfBook.bestBid) {
        topOfBook.bestBid = orderRow.price_per_unit;
      }

      continue;
    }

    if (topOfBook.bestAsk === null || orderRow.price_per_unit < topOfBook.bestAsk) {
      topOfBook.bestAsk = orderRow.price_per_unit;
    }
  }

  return topOfBookByResource;
}

function mapInventoryItem(input: {
  entry: InventoryRow;
  playerRegionId: RegionId | undefined;
  contexts: MarketContextSummary[];
  topOfBookByResource: Map<ResourceId, MarketTopOfBook>;
}): MarketInventoryItem | null {
  const { entry, playerRegionId, contexts, topOfBookByResource } = input;

  if (!entry.resources?.tradable) {
    return null;
  }

  const context = contexts.find((item) => item.locationId === entry.location_id);

  if (!context) {
    return null;
  }

  const contextPrice = getMarketContextPrice({
    contextKey: context.key,
    regionId: playerRegionId,
    resourceId: entry.resource_id,
    basePrice: entry.resources.base_price,
    side: 'sell',
  }).price;
  const effectivePrice = applyInstantTradeSpread(contextPrice, 'sell');
  const slippage = calculateSlippageQuote({
    anchorPrice: effectivePrice,
    quantity: entry.quantity,
    side: 'sell',
    resourceId: entry.resource_id,
  });
  const grossValue = effectivePrice * entry.quantity;
  const feeAmount = Math.round(grossValue * gameConfig.marketFee);
  const netValue = grossValue - feeAmount;

  return {
    resourceId: entry.resource_id,
    quantity: entry.quantity,
    basePrice: entry.resources.base_price,
    effectivePrice,
    grossValue,
    feeAmount,
    netValue,
    marketContextKey: context.key,
    locationId: context.locationId,
    locationNameKey: context.locationNameKey,
    bookComparison: buildQuoteComparison({
      quotePrice: effectivePrice,
      referencePrice: topOfBookByResource.get(entry.resource_id)?.bestBid ?? null,
      side: 'sell',
    }),
    slippage: optionalSlippage(slippage),
  };
}

async function readPlayerMarketContextState(app: FastifyInstance, playerId: string) {
  const supabase = app.getSupabaseAdminClient();
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, locale, credits, region_id')
    .eq('id', playerId)
    .maybeSingle<PlayerRow>();

  if (playerError) {
    throw new Error(`Failed to load market player state: ${playerError.message}`);
  }

  const locationRows = (player ? await readPlayerLocations(app, playerId) : []) as PlayerLocationRow[];
  const contexts = buildMarketContexts({
    regionId: player?.region_id ?? undefined,
    locations: locationRows.map((entry) => ({
      id: entry.id,
      key: entry.key,
      nameKey: entry.name_key,
    })),
  });

  return {
    player,
    contexts,
  };
}

function resolveMarketContext(
  contexts: MarketContextSummary[],
  marketContextKey: MarketContextKey,
) {
  return contexts.find((context) => context.key === marketContextKey) ?? contexts[0] ?? null;
}

export async function getMarketSnapshot(
  app: FastifyInstance,
  playerId: string,
): Promise<MarketSnapshot> {
  const supabase = app.getSupabaseAdminClient();
  const { player, contexts } = await readPlayerMarketContextState(app, playerId);
  const locationIds = contexts.map((entry) => entry.locationId);

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('inventories')
    .select('player_id, location_id, resource_id, quantity, resources(base_price, tradable)')
    .eq('player_id', playerId)
    .in('location_id', locationIds)
    .gt('quantity', 0)
    .order('quantity', { ascending: false })
    .returns<InventoryRow[]>();

  if (inventoryError) {
    throw new Error(`Failed to load market inventory state: ${inventoryError.message}`);
  }

  const { data: offerRows, error: offerError } = await supabase
    .from('resources')
    .select('id, base_price, tradable')
    .eq('tradable', true)
    .order('base_price', { ascending: true })
    .returns<OfferRow[]>();

  if (offerError) {
    throw new Error(`Failed to load market offers: ${offerError.message}`);
  }

  const { data: openOrderRows, error: openOrderError } = await supabase
    .from('market_orders')
    .select('resource_id, side, price_per_unit, remaining_quantity, status')
    .eq('status', 'open')
    .gt('remaining_quantity', 0)
    .returns<MarketOrderBookRow[]>();

  if (openOrderError) {
    throw new Error(`Failed to load market order book: ${openOrderError.message}`);
  }

  const topOfBookByResource = buildTopOfBookByResource({
    offerRows: offerRows ?? [],
    openOrderRows: openOrderRows ?? [],
  });

  const { data: orderRows, error: orderError } = await supabase
    .from('market_orders')
    .select('id, resource_id, side, price_per_unit, quantity, remaining_quantity, status, created_at')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })
    .limit(8)
    .returns<MarketOrderRow[]>();

  if (orderError) {
    throw new Error(`Failed to load market orders: ${orderError.message}`);
  }

  return {
    player: mapPlayer(player),
    contexts,
    marketFeeRate: gameConfig.marketFee,
    offers: (offerRows ?? [])
      .map((entry) =>
        mapOfferItem({
          entry,
          playerRegionId: player?.region_id ?? undefined,
          contexts,
          topOfBook: topOfBookByResource.get(entry.id) ?? {
            bestBid: null,
            bestAsk: null,
          },
        }),
      )
      .filter((entry): entry is MarketOfferItem => entry !== null),
    inventory: (inventoryRows ?? [])
      .map((entry) =>
        mapInventoryItem({
          entry,
          playerRegionId: player?.region_id ?? undefined,
          contexts,
          topOfBookByResource,
        }),
      )
      .filter((entry): entry is MarketInventoryItem => entry !== null),
    orders: (orderRows ?? []).map<MarketOrderItem>((entry) => ({
      id: entry.id,
      resourceId: entry.resource_id,
      side: entry.side,
      pricePerUnit: entry.price_per_unit,
      quantity: entry.quantity,
      remainingQuantity: entry.remaining_quantity,
      status: entry.status,
      createdAt: entry.created_at,
    })),
  };
}

export async function buyResource(
  app: FastifyInstance,
  input: {
    playerId: string;
    resourceId: ResourceId;
    quantity: number;
    marketContextKey: MarketContextKey;
  },
): Promise<MarketBuyResult> {
  const { player, contexts } = await readPlayerMarketContextState(app, input.playerId);
  const marketContext = resolveMarketContext(contexts, input.marketContextKey);
  const { data: resourceRow, error: resourceError } = await app
    .getSupabaseAdminClient()
    .from('resources')
    .select('id, base_price, tradable')
    .eq('id', input.resourceId)
    .maybeSingle<OfferRow>();

  if (resourceError) {
    throw new Error(`Failed to load market resource: ${resourceError.message}`);
  }

  if (!resourceRow) {
    throw new Error('Resource not found.');
  }

  if (!marketContext) {
    throw new Error('Market context is invalid.');
  }

  const marketContextPrice = getMarketContextPrice({
    contextKey: marketContext.key,
    regionId: player?.region_id ?? undefined,
    resourceId: input.resourceId,
    basePrice: resourceRow.base_price,
    side: 'buy',
  }).price;
  const spreadPrice = applyInstantTradeSpread(marketContextPrice, 'buy');
  const slippage = calculateSlippageQuote({
    anchorPrice: spreadPrice,
    quantity: input.quantity,
    side: 'buy',
    resourceId: input.resourceId,
  });
  const price = Math.max(1, Math.round(slippage.totalGross / input.quantity));

  const { data, error } = await app.getSupabaseAdminClient().rpc('buy_market_resource_at_location', {
    p_player_id: input.playerId,
    p_location_id: marketContext.locationId,
    p_market_context_key: marketContext.key,
    p_resource_id: input.resourceId,
    p_quantity: input.quantity,
    p_price_per_unit: price,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data?.[0] ?? null) as BuyRpcResult | null;

  if (!result) {
    throw new Error('Market buy did not return a result.');
  }

  return {
    playerCredits: result.player_credits,
    resourceId: input.resourceId,
    quantityPurchased: input.quantity,
    inventoryQuantity: result.inventory_quantity,
    pricePerUnit: result.price_per_unit,
    totalCost: result.total_cost,
    orderId: result.order_id,
    marketContextKey: result.market_context_key,
    locationId: result.location_id,
    slippage: optionalSlippage(slippage),
  };
}

export async function sellResource(
  app: FastifyInstance,
  input: {
    playerId: string;
    resourceId: ResourceId;
    quantity: number;
    marketContextKey: MarketContextKey;
  },
): Promise<MarketSellResult> {
  const { player, contexts } = await readPlayerMarketContextState(app, input.playerId);
  const marketContext = resolveMarketContext(contexts, input.marketContextKey);
  const { data: resourceRow, error: resourceError } = await app
    .getSupabaseAdminClient()
    .from('resources')
    .select('id, base_price, tradable')
    .eq('id', input.resourceId)
    .maybeSingle<OfferRow>();

  if (resourceError) {
    throw new Error(`Failed to load market resource: ${resourceError.message}`);
  }

  if (!resourceRow) {
    throw new Error('Resource not found.');
  }

  if (!marketContext) {
    throw new Error('Market context is invalid.');
  }

  const marketContextPrice = getMarketContextPrice({
    contextKey: marketContext.key,
    regionId: player?.region_id ?? undefined,
    resourceId: input.resourceId,
    basePrice: resourceRow.base_price,
    side: 'sell',
  }).price;
  const spreadPrice = applyInstantTradeSpread(marketContextPrice, 'sell');
  const slippage = calculateSlippageQuote({
    anchorPrice: spreadPrice,
    quantity: input.quantity,
    side: 'sell',
    resourceId: input.resourceId,
  });
  const price = Math.max(1, Math.round(slippage.totalGross / input.quantity));

  const { data, error } = await app.getSupabaseAdminClient().rpc('sell_inventory_resource_at_location', {
    p_player_id: input.playerId,
    p_location_id: marketContext.locationId,
    p_market_context_key: marketContext.key,
    p_resource_id: input.resourceId,
    p_quantity: input.quantity,
    p_price_per_unit: price,
    p_fee_rate: gameConfig.marketFee,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data?.[0] ?? null) as SellRpcResult | null;

  if (!result) {
    throw new Error('Market sell did not return a result.');
  }

  return {
    playerCredits: result.player_credits,
    resourceId: input.resourceId,
    quantitySold: input.quantity,
    inventoryQuantity: result.inventory_quantity,
    pricePerUnit: result.price_per_unit,
    grossAmount: result.gross_amount,
    feeAmount: result.fee_amount,
    netAmount: result.net_amount,
    orderId: result.order_id,
    marketContextKey: result.market_context_key,
    locationId: result.location_id,
    slippage: optionalSlippage(slippage),
  };
}

export async function createMarketOrder(
  app: FastifyInstance,
  input: {
    playerId: string;
    resourceId: ResourceId;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
  },
): Promise<MarketLimitOrderResult> {
  const { data, error } = await app.getSupabaseAdminClient().rpc('create_market_limit_order', {
    p_player_id: input.playerId,
    p_resource_id: input.resourceId,
    p_side: input.side,
    p_price_per_unit: input.price,
    p_quantity: input.quantity,
    p_fee_rate: gameConfig.marketFee,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data?.[0] ?? null) as LimitOrderRpcResult | null;

  if (!result) {
    throw new Error('Market order did not return a result.');
  }

  return {
    orderId: result.order_id,
    resourceId: result.resource_id,
    side: result.side,
    pricePerUnit: result.price_per_unit,
    quantity: result.quantity,
    remainingQuantity: result.remaining_quantity,
    status: result.status,
    playerCredits: result.player_credits,
    inventoryQuantity: result.inventory_quantity,
    matchedOrderId: result.matched_order_id ?? undefined,
    tradeId: result.trade_id ?? undefined,
    createdAt: result.created_at,
  };
}
