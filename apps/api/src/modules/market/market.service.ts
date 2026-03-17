import type { FastifyInstance } from 'fastify';
import { gameConfig } from '@industrial-dominion/config';
import type {
  MarketBuyResult,
  MarketOfferItem,
  MarketSellResult,
  MarketSnapshot,
  MarketInventoryItem,
  PlayerProfile,
  RegionId,
  ResourceId,
  SupportedLocale,
} from '@industrial-dominion/shared';

type PlayerRow = {
  id: string;
  locale: SupportedLocale;
  credits: number;
  region_id: RegionId | null;
};

type InventoryRow = {
  player_id: string;
  resource_id: ResourceId;
  quantity: number;
  resources: {
    base_price: number;
    tradable: boolean;
  } | null;
};

type OfferRow = {
  id: ResourceId;
  base_price: number;
  tradable: boolean;
};

type BuyRpcResult = {
  order_id: string;
  price_per_unit: number;
  total_cost: number;
  inventory_quantity: number;
  player_credits: number;
};

type SellRpcResult = {
  order_id: string;
  price_per_unit: number;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  inventory_quantity: number;
  player_credits: number;
};

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

function mapOfferItem(entry: OfferRow): MarketOfferItem | null {
  if (!entry.tradable) {
    return null;
  }

  return {
    resourceId: entry.id,
    basePrice: entry.base_price,
  };
}

function mapInventoryItem(entry: InventoryRow): MarketInventoryItem | null {
  if (!entry.resources?.tradable) {
    return null;
  }

  const grossValue = entry.resources.base_price * entry.quantity;
  const feeAmount = Math.round(grossValue * gameConfig.marketFee);
  const netValue = grossValue - feeAmount;

  return {
    resourceId: entry.resource_id,
    quantity: entry.quantity,
    basePrice: entry.resources.base_price,
    grossValue,
    feeAmount,
    netValue,
  };
}

export async function getMarketSnapshot(
  app: FastifyInstance,
  playerId: string,
): Promise<MarketSnapshot> {
  const supabase = app.getSupabaseAdminClient();
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, locale, credits, region_id')
    .eq('id', playerId)
    .maybeSingle<PlayerRow>();

  if (playerError) {
    throw new Error(`Failed to load market player state: ${playerError.message}`);
  }

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('inventories')
    .select('player_id, resource_id, quantity, resources(base_price, tradable)')
    .eq('player_id', playerId)
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

  return {
    player: mapPlayer(player),
    marketFeeRate: gameConfig.marketFee,
    offers: (offerRows ?? [])
      .map(mapOfferItem)
      .filter((entry): entry is MarketOfferItem => entry !== null),
    inventory: (inventoryRows ?? [])
      .map(mapInventoryItem)
      .filter((entry): entry is MarketInventoryItem => entry !== null),
  };
}

export async function buyResource(
  app: FastifyInstance,
  input: {
    playerId: string;
    resourceId: ResourceId;
    quantity: number;
  },
): Promise<MarketBuyResult> {
  const { data, error } = await app.getSupabaseAdminClient().rpc('buy_market_resource', {
    p_player_id: input.playerId,
    p_resource_id: input.resourceId,
    p_quantity: input.quantity,
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
  };
}

export async function sellResource(
  app: FastifyInstance,
  input: {
    playerId: string;
    resourceId: ResourceId;
    quantity: number;
  },
): Promise<MarketSellResult> {
  const { data, error } = await app.getSupabaseAdminClient().rpc('sell_inventory_resource', {
    p_player_id: input.playerId,
    p_resource_id: input.resourceId,
    p_quantity: input.quantity,
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
  };
}
