import type {
  MarketBuyResult,
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
}) {
  return apiRequest<MarketBuyResult>('/market/buy', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      resourceId: input.resourceId,
      quantity: input.quantity,
    }),
  });
}

export function sellMarketResource(input: {
  accessToken: string;
  resourceId: ResourceId;
  quantity: number;
}) {
  return apiRequest<MarketSellResult>('/market/sell', {
    method: 'POST',
    accessToken: input.accessToken,
    body: JSON.stringify({
      resourceId: input.resourceId,
      quantity: input.quantity,
    }),
  });
}
