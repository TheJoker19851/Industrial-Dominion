import type { FastifyInstance } from 'fastify';
import type { RegionId, SupportedLocale } from '@industrial-dominion/shared';
import {
  createStarterPackageRepository,
  grantStarterPackage,
} from './starter-package.service.js';

export type BootstrapStatusResult = {
  player: {
    id: string;
    locale: SupportedLocale;
    credits: number;
    regionId?: RegionId;
  } | null;
  isBootstrapped: boolean;
};

export type BootstrapPlayerResult = BootstrapStatusResult & {
  starterPackage: {
    credits: number;
    plotCount: number;
    warehouseCount: number;
  };
  alreadyGranted: boolean;
};

type PlayerRow = {
  id: string;
  locale: SupportedLocale;
  credits: number;
  region_id: RegionId | null;
};

async function readPlayer(app: FastifyInstance, playerId: string) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('players')
    .select('id, locale, credits, region_id')
    .eq('id', playerId)
    .maybeSingle<PlayerRow>();

  if (error) {
    throw new Error(`Failed to load player bootstrap state: ${error.message}`);
  }

  return data;
}

function mapPlayer(player: PlayerRow | null): BootstrapStatusResult['player'] {
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

async function ensurePlayerLocations(app: FastifyInstance, playerId: string) {
  const { error } = await app.getSupabaseAdminClient().from('player_locations').upsert(
    [
      {
        player_id: playerId,
        key: 'primary_storage',
        name_key: 'locations.primary_storage.name',
      },
      {
        player_id: playerId,
        key: 'remote_storage',
        name_key: 'locations.remote_storage.name',
      },
    ],
    {
      onConflict: 'player_id,key',
    },
  );

  if (error) {
    throw new Error(`Failed to ensure player locations: ${error.message}`);
  }
}

async function ensurePlayerRecord(
  app: FastifyInstance,
  input: {
    playerId: string;
    locale: SupportedLocale;
    regionId: RegionId;
  },
) {
  const player = await readPlayer(app, input.playerId);

  if (!player) {
    const { error } = await app.getSupabaseAdminClient().from('players').insert({
      id: input.playerId,
      locale: input.locale,
      region_id: input.regionId,
    });

    if (error) {
      throw new Error(`Failed to create player bootstrap record: ${error.message}`);
    }
  } else if (!player.region_id) {
    const { error } = await app
      .getSupabaseAdminClient()
      .from('players')
      .update({
        locale: input.locale,
        region_id: input.regionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.playerId);

    if (error) {
      throw new Error(`Failed to update player bootstrap record: ${error.message}`);
    }
  }

  const { error } = await app.getSupabaseAdminClient().from('player_settings').upsert({
    player_id: input.playerId,
    locale: input.locale,
  });

  if (error) {
    throw new Error(`Failed to persist player settings: ${error.message}`);
  }

  await ensurePlayerLocations(app, input.playerId);
}

export async function getBootstrapStatus(
  app: FastifyInstance,
  playerId: string,
): Promise<BootstrapStatusResult> {
  const player = mapPlayer(await readPlayer(app, playerId));

  return {
    player,
    isBootstrapped: Boolean(player?.regionId),
  };
}

export async function bootstrapPlayer(
  app: FastifyInstance,
  input: {
    playerId: string;
    locale: SupportedLocale;
    regionId: RegionId;
  },
): Promise<BootstrapPlayerResult> {
  await ensurePlayerRecord(app, input);

  const starterPackageResult = await grantStarterPackage(
    input.playerId,
    createStarterPackageRepository(app.getSupabaseAdminClient()),
  );
  const status = await getBootstrapStatus(app, input.playerId);

  return {
    ...status,
    starterPackage: starterPackageResult.starterPackage,
    alreadyGranted: starterPackageResult.alreadyGranted,
  };
}
