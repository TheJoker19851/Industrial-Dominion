import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { starterRegionIds } from '@industrial-dominion/shared';
import { bootstrapPlayer, getBootstrapStatus } from './bootstrap.service.js';
import { syncStarterTutorialProgress } from '../tutorial/tutorial.service.js';

const bootstrapBodySchema = z.object({
  regionId: z.enum(starterRegionIds),
  locale: z.enum(['en', 'fr']),
});

export const bootstrapRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/status',
    {
      preHandler: app.requireAuth,
    },
    async (request) => getBootstrapStatus(app, request.authUser!.id),
  );

  app.post(
    '/complete',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = bootstrapBodySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid bootstrap payload.',
        });
      }

      const result = await bootstrapPlayer(app, {
        playerId: request.authUser!.id,
        locale: parsed.data.locale,
        regionId: parsed.data.regionId,
      });

      await syncStarterTutorialProgress(app, {
        playerId: request.authUser!.id,
      });

      return result;
    },
  );
};
