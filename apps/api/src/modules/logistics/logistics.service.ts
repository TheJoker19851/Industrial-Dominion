import type { FastifyInstance } from 'fastify';
import type { LogisticsTransferResult, ResourceId } from '@industrial-dominion/shared';

type LogisticsTransferRpcResult = {
  transfer_id: string;
  from_location_id: string;
  to_location_id: string;
  resource_id: ResourceId;
  quantity: number;
  from_inventory_quantity: number;
  to_inventory_quantity: number;
  created_at: string;
};

export async function createLogisticsTransfer(
  app: FastifyInstance,
  input: {
    playerId: string;
    fromLocationId: string;
    toLocationId: string;
    itemKey: ResourceId;
    quantity: number;
  },
): Promise<LogisticsTransferResult> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new Error('Transfer quantity must be greater than zero.');
  }

  const { data, error } = await app.getSupabaseAdminClient().rpc('create_logistics_transfer', {
    p_player_id: input.playerId,
    p_from_location_id: input.fromLocationId,
    p_to_location_id: input.toLocationId,
    p_item_key: input.itemKey,
    p_quantity: input.quantity,
  });

  if (error) {
    throw new Error(error.message);
  }

  const result = (data?.[0] ?? null) as LogisticsTransferRpcResult | null;

  if (!result) {
    throw new Error('Logistics transfer did not return a result.');
  }

  return {
    transferId: result.transfer_id,
    fromLocationId: result.from_location_id,
    toLocationId: result.to_location_id,
    resourceId: result.resource_id,
    quantity: result.quantity,
    fromInventoryQuantity: result.from_inventory_quantity,
    toInventoryQuantity: result.to_inventory_quantity,
    createdAt: result.created_at,
  };
}
