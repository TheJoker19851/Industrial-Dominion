import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { productionRecipeCatalog } from '@industrial-dominion/shared';
import { createProductionJob } from './production.service.js';
import { syncStarterTutorialProgress } from '../tutorial/tutorial.service.js';

const createProductionJobSchema = z.object({
  recipeKey: z.enum(
    productionRecipeCatalog.map((recipe) => recipe.key) as [string, ...string[]],
  ),
  runs: z.number().int().min(1),
});

export const productionRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/jobs',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = createProductionJobSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid production job payload.',
        });
      }

      try {
        const result = await createProductionJob(app, {
          playerId: request.authUser!.id,
          recipeKey: parsed.data.recipeKey,
          runs: parsed.data.runs,
        });

        await syncStarterTutorialProgress(app, {
          playerId: request.authUser!.id,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to create production job.';
        const statusCode =
          message === 'Production structure not found for player.'
            ? 404
            : message === 'Production recipe not found.' ||
                message === 'Starter processing installation required for production.' ||
                message === 'Production runs must be at least 1.' ||
                message === 'Not enough input inventory to start production.'
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
};
