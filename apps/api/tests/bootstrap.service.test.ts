import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { bootstrapPlayer, getBootstrapStatus } from '../src/modules/bootstrap/bootstrap.service';

function createPlayersTableMock(initialPlayer: {
  id: string;
  locale: 'en' | 'fr';
  credits: number;
  region_id: 'ironridge' | 'greenhaven' | 'sunbarrel' | 'riverplain' | null;
} | null) {
  let player = initialPlayer;

  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation(() => ({
      maybeSingle: vi.fn().mockImplementation(async () => ({
        data: player,
        error: null,
      })),
    })),
    insert: vi.fn().mockImplementation(async (payload: typeof player) => {
      player = payload;
      return { error: null };
    }),
    update: vi.fn().mockImplementation((payload: Partial<typeof player>) => ({
      eq: vi.fn().mockImplementation(async () => {
        player = player ? { ...player, ...payload } : player;
        return { error: null };
      }),
    })),
    setPlayer(nextPlayer: typeof player) {
      player = nextPlayer;
    },
  };
}

function createAppMock(initialPlayer: {
  id: string;
  locale: 'en' | 'fr';
  credits: number;
  region_id: 'ironridge' | 'greenhaven' | 'sunbarrel' | 'riverplain' | null;
} | null = null) {
  const playersTable = createPlayersTableMock(initialPlayer);
  const playerSettingsTable = {
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  const playerLocationsTable = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          returns: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  const rpc = vi.fn().mockImplementation(async (_fn, payload) => {
    const insertedPlayer = (await playersTable.eq('id', payload.p_player_id).maybeSingle())
      .data;

    playersTable.setPlayer(
      insertedPlayer
        ? {
            ...insertedPlayer,
            credits: payload.p_credits,
          }
        : insertedPlayer,
    );

    return {
      data: { alreadyGranted: false },
      error: null,
    };
  });

  return {
    app: {
      getSupabaseAdminClient: () => ({
        from: (table: string) => {
          if (table === 'players') {
            return playersTable;
          }

          if (table === 'player_settings') {
            return playerSettingsTable;
          }

          if (table === 'player_locations') {
            return playerLocationsTable;
          }

          throw new Error(`Unexpected table ${table}`);
        },
        rpc,
      }),
    } as unknown as FastifyInstance,
    rpc,
    playersTable,
    playerLocationsTable,
    playerSettingsTable,
  };
}

describe('bootstrap service', () => {
  it('returns unbootstrapped status when no player record exists', async () => {
    const { app } = createAppMock();

    await expect(getBootstrapStatus(app, 'player-123')).resolves.toEqual({
      player: null,
      isBootstrapped: false,
    });
  });

  it('creates player bootstrap state and grants starter package', async () => {
    const { app, rpc, playersTable, playerLocationsTable, playerSettingsTable } = createAppMock();

    const result = await bootstrapPlayer(app, {
      playerId: 'player-123',
      locale: 'en',
      regionId: 'greenhaven',
    });

    expect(playersTable.insert).toHaveBeenCalledWith({
      id: 'player-123',
      locale: 'en',
      region_id: 'greenhaven',
    });
    expect(playerSettingsTable.upsert).toHaveBeenCalledWith({
      player_id: 'player-123',
      locale: 'en',
    });
    expect(playerLocationsTable.upsert).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('grant_starter_package', {
      p_player_id: 'player-123',
      p_credits: 2500,
      p_plot_count: 1,
      p_warehouse_count: 1,
    });
    expect(result).toEqual({
      player: {
        id: 'player-123',
        locale: 'en',
        credits: 2500,
        regionId: 'greenhaven',
      },
      isBootstrapped: true,
      starterPackage: {
        credits: 2500,
        plotCount: 1,
        warehouseCount: 1,
      },
      alreadyGranted: false,
    });
  });
});
