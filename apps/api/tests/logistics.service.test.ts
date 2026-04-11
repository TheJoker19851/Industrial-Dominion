import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createLogisticsTransfer } from '../src/modules/logistics/logistics.service';

function createAppMock() {
  const rpc = vi.fn().mockImplementation((fn: string, payload: Record<string, unknown>) => {
    if (fn !== 'create_logistics_transfer') {
      throw new Error(`Unexpected rpc ${fn}`);
    }

    if (payload.p_quantity === 0) {
      return Promise.resolve({
        data: null,
        error: {
          message: 'Transfer quantity must be greater than zero.',
        },
      });
    }

    if (payload.p_from_location_id === payload.p_to_location_id) {
      return Promise.resolve({
        data: null,
        error: {
          message: 'Transfer source and destination must be different.',
        },
      });
    }

    if (payload.p_quantity === 999) {
      return Promise.resolve({
        data: null,
        error: {
          message: 'Not enough inventory in the source location.',
        },
      });
    }

    return Promise.resolve({
      data: [
        {
          transfer_id: 'transfer-123',
          from_location_id: String(payload.p_from_location_id),
          to_location_id: String(payload.p_to_location_id),
          resource_id: payload.p_item_key,
          quantity: payload.p_quantity,
          from_inventory_quantity: 25,
          to_inventory_quantity: 50,
          created_at: '2026-03-17T16:00:00.000Z',
        },
      ],
      error: null,
    });
  });

  return {
    app: {
      getSupabaseAdminClient: () => ({
        rpc,
      }),
    } as unknown as FastifyInstance,
    rpc,
  };
}

describe('logistics service', () => {
  it('creates a logistics transfer successfully', async () => {
    const { app, rpc } = createAppMock();

    const result = await createLogisticsTransfer(app, {
      playerId: 'player-123',
      fromLocationId: '11111111-1111-1111-1111-111111111111',
      toLocationId: '22222222-2222-2222-2222-222222222222',
      itemKey: 'iron_ore',
      quantity: 25,
    });

    expect(result).toEqual({
      transferId: 'transfer-123',
      fromLocationId: '11111111-1111-1111-1111-111111111111',
      toLocationId: '22222222-2222-2222-2222-222222222222',
      resourceId: 'iron_ore',
      quantity: 25,
      fromInventoryQuantity: 25,
      toInventoryQuantity: 50,
      createdAt: '2026-03-17T16:00:00.000Z',
    });
    expect(rpc).toHaveBeenCalledWith('create_logistics_transfer', {
      p_player_id: 'player-123',
      p_from_location_id: '11111111-1111-1111-1111-111111111111',
      p_to_location_id: '22222222-2222-2222-2222-222222222222',
      p_item_key: 'iron_ore',
      p_quantity: 25,
    });
  });

  it('fails when the source inventory is insufficient', async () => {
    const { app } = createAppMock();

    await expect(
      createLogisticsTransfer(app, {
        playerId: 'player-123',
        fromLocationId: '11111111-1111-1111-1111-111111111111',
        toLocationId: '22222222-2222-2222-2222-222222222222',
        itemKey: 'iron_ore',
        quantity: 999,
      }),
    ).rejects.toThrow('Not enough inventory in the source location.');
  });

  it('fails when source and destination match', async () => {
    const { app } = createAppMock();

    await expect(
      createLogisticsTransfer(app, {
        playerId: 'player-123',
        fromLocationId: '11111111-1111-1111-1111-111111111111',
        toLocationId: '11111111-1111-1111-1111-111111111111',
        itemKey: 'iron_ore',
        quantity: 10,
      }),
    ).rejects.toThrow('Transfer source and destination must be different.');
  });

  it('fails when quantity is invalid before calling the backend', async () => {
    const { app, rpc } = createAppMock();

    await expect(
      createLogisticsTransfer(app, {
        playerId: 'player-123',
        fromLocationId: '11111111-1111-1111-1111-111111111111',
        toLocationId: '22222222-2222-2222-2222-222222222222',
        itemKey: 'iron_ore',
        quantity: 0,
      }),
    ).rejects.toThrow('Transfer quantity must be greater than zero.');
    expect(rpc).not.toHaveBeenCalled();
  });
});
