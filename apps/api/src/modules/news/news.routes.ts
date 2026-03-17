import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getSystemNewsFeed } from './news.service.js';

export const newsRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = z
        .object({
          limit: z.coerce.number().int().positive().max(10).optional(),
        })
        .safeParse(request.query);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid news query.',
        });
      }

      return getSystemNewsFeed(app, {
        limit: parsed.data.limit,
      });
    },
  );
};
