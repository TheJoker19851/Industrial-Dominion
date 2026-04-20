import type { FastifyInstance } from 'fastify';
import { gameConfig } from '@industrial-dominion/config';
import type {
  ArbitrageQuote,
  RegionId,
  ResourceId,
} from '@industrial-dominion/shared';
import { buildArbitrageQuote } from '@industrial-dominion/shared';
import { getMarketContextPrice } from '../market/market-context.js';

type PlayerRow = {
  id: string;
  locale: 'en' | 'fr';
  credits: number;
  region_id: RegionId | null;
};

type ResourceRow = {
  id: ResourceId;
  base_price: number;
  tradable: boolean;
};

const instantTradeSpreadRate = 0.05;

function applyInstantTradeSpread(price: number, side: 'buy' | 'sell') {
  const adjustedPrice =
    side === 'buy'
      ? Math.round(price * (1 + instantTradeSpreadRate))
      : Math.round(price * (1 - instantTradeSpreadRate));

  return Math.max(1, adjustedPrice);
}

export async function previewArbitrage(
  app: FastifyInstance,
  input: {
    playerId: string;
    resourceId: ResourceId;
    quantity: number;
    originRegion: RegionId;
    destinationRegion: RegionId;
  },
): Promise<ArbitrageQuote> {
  const supabase = app.getSupabaseAdminClient();

  const { error: playerError } = await supabase
    .from('players')
    .select('id, locale, credits, region_id')
    .eq('id', input.playerId)
    .maybeSingle<PlayerRow>();

  if (playerError) {
    throw new Error(`Failed to load player: ${playerError.message}`);
  }

  const { data: resourceRow, error: resourceError } = await supabase
    .from('resources')
    .select('id, base_price, tradable')
    .eq('id', input.resourceId)
    .maybeSingle<ResourceRow>();

  if (resourceError) {
    throw new Error(`Failed to load resource: ${resourceError.message}`);
  }

  if (!resourceRow) {
    throw new Error('Resource not found.');
  }

  if (!resourceRow.tradable) {
    throw new Error('Resource is not tradable.');
  }

  const originPriceContext = getMarketContextPrice({
    contextKey: 'region_anchor',
    regionId: input.originRegion,
    resourceId: input.resourceId,
    basePrice: resourceRow.base_price,
    side: 'sell',
  });

  const destinationPriceContext = getMarketContextPrice({
    contextKey: 'region_anchor',
    regionId: input.destinationRegion,
    resourceId: input.resourceId,
    basePrice: resourceRow.base_price,
    side: 'sell',
  });

  const originAnchorPrice = applyInstantTradeSpread(
    originPriceContext.price,
    'sell',
  );
  const destinationAnchorPrice = applyInstantTradeSpread(
    destinationPriceContext.price,
    'sell',
  );

  return buildArbitrageQuote({
    resource: input.resourceId,
    quantity: input.quantity,
    originRegion: input.originRegion,
    destinationRegion: input.destinationRegion,
    originAnchorPrice,
    destinationAnchorPrice,
    feeRate: gameConfig.marketFee,
  });
}
