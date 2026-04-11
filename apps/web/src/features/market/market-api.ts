import type {
  MarketBuyResult,
  MarketContextKey,
  MarketLimitOrderResult,
  MarketSellResult,
  MarketSnapshot,
  ResourceId,
} from '@industrial-dominion/shared';
import { apiRequest } from '@/lib/api';

export function getMarketSnapshot(accessToken: string) {
  return apiRequest<MarketSnapshot>('/market', {
    method: 'GET',
    accessToken,
  });
}

export function buyMarketResource(input: {
  accessToken: string;
  resourceId: ResourceId;
  quantity: number;
  marketContextKey: MarketContextKey;
}) {
  return apiRequest<MarketBuyResult>('/market/buy', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      resourceId: input.resourceId,
      quantity: input.quantity,
      marketContextKey: input.marketContextKey,
    }),
  });
}

export function sellMarketResource(input: {
  accessToken: string;
  resourceId: ResourceId;
  quantity: number;
  marketContextKey: MarketContextKey;
}) {
  return apiRequest<MarketSellResult>('/market/sell', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      resourceId: input.resourceId,
      quantity: input.quantity,
      marketContextKey: input.marketContextKey,
    }),
  });
}

export function createMarketOrder(input: {
  accessToken: string;
  resourceId: ResourceId;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
}) {
  return apiRequest<MarketLimitOrderResult>('/market/orders', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      resourceId: input.resourceId,
      side: input.side,
      price: input.price,
      quantity: input.quantity,
    }),
  });
}
