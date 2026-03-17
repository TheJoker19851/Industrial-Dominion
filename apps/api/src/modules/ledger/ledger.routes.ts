import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getLedgerFeed } from './ledger.service.js';

export const ledgerRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = z
        .object({
          limit: z.coerce.number().int().positive().max(25).optional(),
        })
        .safeParse(request.query);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid ledger query.',
        });
      }

      return getLedgerFeed(app, {
        playerId: request.authUser!.id,
        limit: parsed.data.limit,
      });
    },
  );
};
