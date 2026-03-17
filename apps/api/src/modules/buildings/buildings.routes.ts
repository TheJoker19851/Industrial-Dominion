import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { starterExtractorCatalog, starterTransformRecipes } from '@industrial-dominion/shared';
import {
  claimProduction,
  claimTransform,
  placeFirstExtractor,
  startTransform,
} from './buildings.service.js';
import { syncStarterTutorialProgress } from '../tutorial/tutorial.service.js';

const placeFirstExtractorSchema = z.object({
  buildingTypeId: z.enum(
    starterExtractorCatalog.map((extractor) => extractor.id) as [
      string,
      ...string[],
    ],
  ),
});

const startTransformSchema = z.object({
  recipeId: z.enum(
    starterTransformRecipes.map((recipe) => recipe.id) as [string, ...string[]],
  ),
});

export const buildingRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/first-extractor',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = placeFirstExtractorSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid first extractor payload.',
        });
      }

      try {
        const result = await placeFirstExtractor(app, {
          playerId: request.authUser!.id,
          buildingTypeId: parsed.data.buildingTypeId,
        });

        await syncStarterTutorialProgress(app, {
          playerId: request.authUser!.id,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to place first extractor.';
        const statusCode =
          message === 'Player must complete bootstrap before placing an extractor.' ||
          message === 'Player already placed the first extractor.' ||
          message === 'Starter extractor does not match the player region.' ||
          message === 'Unknown starter extractor.'
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
    '/:buildingId/start-transform',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsedParams = z
        .object({
          buildingId: z.string().min(1),
        })
        .safeParse(request.params);
      const parsedBody = startTransformSchema.safeParse(request.body);

      if (!parsedParams.success || !parsedBody.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid transform start payload.',
        });
      }

      try {
        return await startTransform(app, {
          playerId: request.authUser!.id,
          buildingId: parsedParams.data.buildingId,
          recipeId: parsedBody.data.recipeId,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to start transform.';
        const statusCode =
          message === 'Transform building not found for player.'
            ? 404
            : message === 'Transform recipe not found.' ||
                message === 'Building cannot run this transform recipe.' ||
                message === 'A transform job is already active for this building.' ||
                message === 'Not enough input inventory to start transform.'
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
    '/transform-jobs/:jobId/claim',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = z
        .object({
          jobId: z.string().min(1),
        })
        .safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid transform claim payload.',
        });
      }

      try {
        return await claimTransform(app, {
          playerId: request.authUser!.id,
          jobId: parsed.data.jobId,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to claim transform output.';
        const statusCode =
          message === 'Transform job not found for player.'
            ? 404
            : message === 'Transform job is not ready to claim yet.' ||
                message === 'Transform job has already been claimed.'
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
    '/:buildingId/claim-production',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = z
        .object({
          buildingId: z.string().min(1),
        })
        .safeParse(request.params);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid claim production payload.',
        });
      }

      try {
        const result = await claimProduction(app, {
          playerId: request.authUser!.id,
          buildingId: parsed.data.buildingId,
        });

        await syncStarterTutorialProgress(app, {
          playerId: request.authUser!.id,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to claim production.';
        const statusCode =
          message === 'Starter extractor not found for player.'
            ? 404
            : message === 'No production is ready to claim yet.' ||
                message === 'Building is not a starter extractor.'
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
