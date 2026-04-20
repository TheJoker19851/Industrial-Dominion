import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  resourceIds,
  starterRegionIds,
  starterResourceIds,
} from '@industrial-dominion/shared';
import { createLogisticsTransfer } from './logistics.service.js';
import { previewArbitrage } from './logistics-arbitrage.service.js';
import { syncStarterTutorialProgress } from '../tutorial/tutorial.service.js';

const createLogisticsTransferSchema = z.object({
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  itemKey: z.enum(starterResourceIds),
  quantity: z.number().int().min(1),
});

const previewArbitrageSchema = z.object({
  resourceId: z.enum(resourceIds),
  quantity: z.number().int().positive(),
  originRegion: z.enum(starterRegionIds),
  destinationRegion: z.enum(starterRegionIds),
});

export const logisticsRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/transfers',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = createLogisticsTransferSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid logistics transfer payload.',
        });
      }

      try {
        const result = await createLogisticsTransfer(app, {
          playerId: request.authUser!.id,
          fromLocationId: parsed.data.fromLocationId,
          toLocationId: parsed.data.toLocationId,
          itemKey: parsed.data.itemKey,
          quantity: parsed.data.quantity,
        });

        await syncStarterTutorialProgress(app, {
          playerId: request.authUser!.id,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to create logistics transfer.';
        const statusCode =
          message === 'Transfer source location not found.'
            ? 404
            : message === 'Transfer destination location not found.'
              ? 404
              : message === 'Transfer quantity must be greater than zero.' ||
                  message ===
                    'Transfer source and destination must be different.' ||
                  message === 'Not enough inventory in the source location.'
                ? 400
                : 500;

        return reply.code(statusCode).send({
          error:
            statusCode === 404
              ? 'Not Found'
              : statusCode === 400
                ? 'Bad Request'
                : 'Internal Server Error',
          message,
        });
      }
    },
  );

  app.post(
    '/arbitrage-preview',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = previewArbitrageSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid arbitrage preview payload.',
        });
      }

      if (parsed.data.originRegion === parsed.data.destinationRegion) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Origin and destination regions must be different.',
        });
      }

      try {
        return await previewArbitrage(app, {
          playerId: request.authUser!.id,
          resourceId: parsed.data.resourceId,
          quantity: parsed.data.quantity,
          originRegion: parsed.data.originRegion,
          destinationRegion: parsed.data.destinationRegion,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to preview arbitrage.';
        const statusCode =
          message === 'Resource not found.' ||
          message === 'Resource is not tradable.'
            ? 400
            : 500;

        return reply.code(statusCode).send({
          error: statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
          message,
        });
      }
    },
  );
};
