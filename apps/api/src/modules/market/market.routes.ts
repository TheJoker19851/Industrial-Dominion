import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resourceIds } from '@industrial-dominion/shared';
import { buyResource, createMarketOrder, getMarketSnapshot, sellResource } from './market.service.js';
import { syncStarterTutorialProgress } from '../tutorial/tutorial.service.js';

const buyResourceBodySchema = z.object({
  resourceId: z.enum(resourceIds),
  quantity: z.number().int().positive(),
  marketContextKey: z.enum(['region_anchor', 'trade_hub']).default('region_anchor'),
});

const sellResourceBodySchema = z.object({
  resourceId: z.enum(resourceIds),
  quantity: z.number().int().positive(),
  marketContextKey: z.enum(['region_anchor', 'trade_hub']).default('region_anchor'),
});

const createMarketOrderBodySchema = z.object({
  resourceId: z.enum(resourceIds),
  side: z.enum(['buy', 'sell']),
  price: z.number().int().positive(),
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
          marketContextKey: parsed.data.marketContextKey,
        });

        await syncStarterTutorialProgress(app, {
          playerId: request.authUser!.id,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to buy resource.';
        const statusCode =
          message === 'Quantity must be greater than zero.' ||
          message === 'Price must be greater than zero.' ||
          message === 'Market context is invalid.' ||
          message === 'Market location not found.' ||
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
    '/orders',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = createMarketOrderBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid market order payload.',
        });
      }

      try {
        const result = await createMarketOrder(app, {
          playerId: request.authUser!.id,
          resourceId: parsed.data.resourceId,
          side: parsed.data.side,
          price: parsed.data.price,
          quantity: parsed.data.quantity,
        });

        await syncStarterTutorialProgress(app, {
          playerId: request.authUser!.id,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to create market order.';
        const statusCode =
          message === 'Market order side is invalid.' ||
          message === 'Market order price must be greater than zero.' ||
          message === 'Market order quantity must be greater than zero.' ||
          message === 'Resource is not tradable.' ||
          message === 'Not enough credits to place buy order.' ||
          message === 'Not enough inventory to place sell order.'
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
          marketContextKey: parsed.data.marketContextKey,
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
          message === 'Price must be greater than zero.' ||
          message === 'Market context is invalid.' ||
          message === 'Market location not found.' ||
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
