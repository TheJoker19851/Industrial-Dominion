import type { RegionId, SupportedLocale } from '@industrial-dominion/shared';
import { apiRequest } from '@/lib/api';

export type BootstrapStatusResponse = {
  player: {
    id: string;
    locale: SupportedLocale;
    credits: number;
    regionId?: RegionId;
  } | null;
  isBootstrapped: boolean;
};

export type BootstrapCompleteResponse = BootstrapStatusResponse & {
  starterPackage: {
    credits: number;
    plotCount: number;
    warehouseCount: number;
  };
  alreadyGranted: boolean;
};

export function fetchBootstrapStatus(accessToken: string) {
  return apiRequest<BootstrapStatusResponse>('/bootstrap/status', {
    accessToken,
  });
}

export function completeBootstrap(
  accessToken: string,
  payload: {
    regionId: RegionId;
    locale: SupportedLocale;
  },
) {
  return apiRequest<BootstrapCompleteResponse>('/bootstrap/complete', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
  });
}
