import type { FastifyInstance } from 'fastify';
import type { PlayerLocationKey } from '@industrial-dominion/shared';

type PlayerLocationRow = {
  id: string;
  key: PlayerLocationKey;
  name_key: string;
};

export async function readPlayerLocations(app: FastifyInstance, playerId: string) {
  const { data, error } = await app
    .getSupabaseAdminClient()
    .from('player_locations')
    .select('id, key, name_key')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true })
    .returns<PlayerLocationRow[]>();

  if (error) {
    throw new Error(`Failed to load player locations: ${error.message}`);
  }

  return data ?? [];
}

export async function readPlayerLocationId(
  app: FastifyInstance,
  playerId: string,
  key: PlayerLocationKey,
) {
  const locations = await readPlayerLocations(app, playerId);
  const location = locations.find((entry) => entry.key === key);

  if (!location) {
    throw new Error('Player location not found.');
  }

  return location.id;
}
