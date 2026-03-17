import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { starterResourceIds } from '@industrial-dominion/shared';
import { buyResource, getMarketSnapshot, sellResource } from './market.service.js';
import { syncStarterTutorialProgress } from '../tutorial/tutorial.service.js';

const buyResourceBodySchema = z.object({
  resourceId: z.enum(starterResourceIds),
  quantity: z.number().int().positive(),
});

const sellResourceBodySchema = z.object({
  resourceId: z.enum(starterResourceIds),
  quantity: z.number().int().positive(),
});

export const marketRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      preHandler: app.requireAuth,
    },
    async (request) => getMarketSnapshot(app, request.authUser!.id),
  );

  app.post(
    '/buy',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = buyResourceBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid market buy payload.',
        });
      }

      try {
        const result = await buyResource(app, {
          playerId: request.authUser!.id,
          resourceId: parsed.data.resourceId,
          quantity: parsed.data.quantity,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to buy resource.';
        const statusCode =
          message === 'Quantity must be greater than zero.' ||
          message === 'Resource not found.' ||
          message === 'Resource is not purchasable.' ||
          message === 'Not enough credits to buy resource.'
            ? 400
            : 500;

        return reply.code(statusCode).send({
          error: statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
          message,
        });
      }
    },
  );

  app.post(
    '/sell',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = sellResourceBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid market sell payload.',
        });
      }

      try {
        const result = await sellResource(app, {
          playerId: request.authUser!.id,
          resourceId: parsed.data.resourceId,
          quantity: parsed.data.quantity,
        });

        await syncStarterTutorialProgress(app, {
          playerId: request.authUser!.id,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to sell resource.';
        const statusCode =
          message === 'Quantity must be greater than zero.' ||
          message === 'Resource not found.' ||
          message === 'Resource is not tradable.' ||
          message === 'Not enough inventory to sell.'
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
