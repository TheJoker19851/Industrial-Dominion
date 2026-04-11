import type {
  DashboardLogisticsLocationSummary,
  PlayerLocationKey,
  RegionId,
  ResourceId,
} from '@industrial-dominion/shared';

interface EconomicRegionDescriptor {
  resourceId: ResourceId;
  specialtyKey: string;
  activityKey: string;
}

export interface EconomicNetworkNode {
  id: string;
  kind: 'region' | 'hub' | 'zone';
  regionId?: RegionId;
  locationId?: string;
  locationKey?: PlayerLocationKey;
  titleKey: string;
  roleKey: string;
  activityKey: string;
  statusKey: string;
  resourceId?: ResourceId;
  isCurrent?: boolean;
}

export interface EconomicNetworkLink {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  labelKey: string;
}

const regionDescriptors: Record<RegionId, EconomicRegionDescriptor> = {
  ironridge: {
    resourceId: 'iron_ore',
    specialtyKey: 'dashboard.network.specialties.ironridge',
    activityKey: 'dashboard.network.activities.ironridge',
  },
  greenhaven: {
    resourceId: 'wood',
    specialtyKey: 'dashboard.network.specialties.greenhaven',
    activityKey: 'dashboard.network.activities.greenhaven',
  },
  sunbarrel: {
    resourceId: 'crude_oil',
    specialtyKey: 'dashboard.network.specialties.sunbarrel',
    activityKey: 'dashboard.network.activities.sunbarrel',
  },
  riverplain: {
    resourceId: 'water',
    specialtyKey: 'dashboard.network.specialties.riverplain',
    activityKey: 'dashboard.network.activities.riverplain',
  },
};

const locationRoleKeys: Record<PlayerLocationKey, string> = {
  primary_storage: 'dashboard.network.roles.primary_storage',
  remote_storage: 'dashboard.network.roles.remote_storage',
};

const locationStatusKeys: Record<PlayerLocationKey, string> = {
  primary_storage: 'dashboard.network.statuses.current',
  remote_storage: 'dashboard.network.statuses.connected',
};

const locationActivityKeys: Record<PlayerLocationKey, string> = {
  primary_storage: 'dashboard.network.activities.primary_storage',
  remote_storage: 'dashboard.network.activities.remote_storage',
};

function getDominantResourceId(location: DashboardLogisticsLocationSummary) {
  return [...location.inventory].sort((left, right) => right.quantity - left.quantity)[0]?.resourceId;
}

export function buildEconomicNetwork(
  regionId: RegionId | undefined,
  logisticsLocations: DashboardLogisticsLocationSummary[],
): {
  nodes: EconomicNetworkNode[];
  links: EconomicNetworkLink[];
} {
  const fallbackRegionId: RegionId = regionId ?? 'ironridge';
  const regionDescriptor = regionDescriptors[fallbackRegionId];
  const primaryLocation = logisticsLocations.find((entry) => entry.key === 'primary_storage') ?? null;
  const remoteLocation = logisticsLocations.find((entry) => entry.key === 'remote_storage') ?? null;

  const nodes: EconomicNetworkNode[] = [
    {
      id: `region-${fallbackRegionId}`,
      kind: 'region',
      regionId: fallbackRegionId,
      titleKey: `regions.${fallbackRegionId}.name`,
      roleKey: 'dashboard.network.roles.region_anchor',
      activityKey: regionDescriptor.activityKey,
      statusKey: 'dashboard.network.statuses.current',
      resourceId: regionDescriptor.resourceId,
      isCurrent: true,
    },
    {
      id: 'trade-hub',
      kind: 'hub',
      titleKey: 'dashboard.network.tradeHubTitle',
      roleKey: 'dashboard.network.roles.trade_hub',
      activityKey: 'dashboard.network.activities.trade_hub',
      statusKey: 'dashboard.network.statuses.market_live',
      resourceId: regionDescriptor.resourceId,
    },
  ];

  if (remoteLocation) {
    nodes.push({
      id: remoteLocation.locationId,
      kind: 'zone',
      locationId: remoteLocation.locationId,
      locationKey: remoteLocation.key,
      titleKey: remoteLocation.nameKey,
      roleKey: locationRoleKeys[remoteLocation.key],
      activityKey: locationActivityKeys[remoteLocation.key],
      statusKey: locationStatusKeys[remoteLocation.key],
      resourceId: getDominantResourceId(remoteLocation),
    });
  } else if (primaryLocation) {
    nodes.push({
      id: primaryLocation.locationId,
      kind: 'zone',
      locationId: primaryLocation.locationId,
      locationKey: primaryLocation.key,
      titleKey: primaryLocation.nameKey,
      roleKey: locationRoleKeys[primaryLocation.key],
      activityKey: locationActivityKeys[primaryLocation.key],
      statusKey: locationStatusKeys[primaryLocation.key],
      resourceId: getDominantResourceId(primaryLocation),
    });
  }

  const regionNodeId = `region-${fallbackRegionId}`;
  const remoteNodeId = remoteLocation?.locationId ?? primaryLocation?.locationId;

  const links: EconomicNetworkLink[] = [
    {
      id: 'region-trade-hub',
      fromNodeId: regionNodeId,
      toNodeId: 'trade-hub',
      labelKey: 'dashboard.network.links.trade_flow',
    },
  ];

  if (remoteNodeId) {
    links.push({
      id: 'region-remote-zone',
      fromNodeId: regionNodeId,
      toNodeId: remoteNodeId,
      labelKey: 'dashboard.network.links.logistics_flow',
    });
  }

  return {
    nodes,
    links,
  };
}

export function getLocationContextTitle(
  location: DashboardLogisticsLocationSummary | null | undefined,
  regionId: RegionId | undefined,
) {
  if (!location) {
    return regionId ? `regions.${regionId}.name` : 'dashboard.unknownLocation';
  }

  if (location.key === 'primary_storage') {
    return regionId ? `regions.${regionId}.name` : location.nameKey;
  }

  if (location.key === 'remote_storage') {
    return 'dashboard.network.industrialZoneTitle';
  }

  return location.nameKey;
}

export function getLocationStatusKey(locationKey: PlayerLocationKey | undefined) {
  if (!locationKey) {
    return 'dashboard.network.statuses.connected';
  }

  return locationStatusKeys[locationKey];
}
