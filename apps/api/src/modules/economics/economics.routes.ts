import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { resourceIds, starterRegionIds } from '@industrial-dominion/shared';
import {
  previewDecision,
  batchAnalyze,
  getMarketSignals,
  executeDecision,
  getDecisionHistory,
} from './economics.service.js';

const economicStrategies = [
  'SELL_LOCAL',
  'PROCESS_AND_SELL_LOCAL',
  'TRANSPORT_AND_SELL',
  'PROCESS_THEN_TRANSPORT_AND_SELL',
] as const;

const decisionPreviewSchema = z.object({
  resource: z.enum(resourceIds),
  quantity: z.number().int().positive(),
  region: z.enum(starterRegionIds),
});

const batchAnalysisSchema = z.object({
  resource: z.enum(resourceIds),
  quantities: z.array(z.number().int().positive()).min(1).max(10),
  regions: z.array(z.enum(starterRegionIds)).min(1).max(4),
});

export const economicsRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/decision-preview',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = decisionPreviewSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid decision preview payload.',
        });
      }

      try {
        return await previewDecision(app, {
          playerId: request.authUser!.id,
          resource: parsed.data.resource,
          quantity: parsed.data.quantity,
          region: parsed.data.region,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to preview economic decision.';
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

  app.post(
    '/batch-analysis',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = batchAnalysisSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid batch analysis payload.',
        });
      }

      try {
        return await batchAnalyze(app, {
          playerId: request.authUser!.id,
          resource: parsed.data.resource,
          quantities: parsed.data.quantities,
          regions: parsed.data.regions,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to run batch analysis.';
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

  app.post(
    '/market-signals',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = decisionPreviewSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid market signals payload.',
        });
      }

      try {
        return await getMarketSignals(app, {
          playerId: request.authUser!.id,
          resource: parsed.data.resource,
          quantity: parsed.data.quantity,
          region: parsed.data.region,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to read market signals.';
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

  const decisionExecuteSchema = z.object({
    strategy: z.enum(economicStrategies),
    resource: z.enum(resourceIds),
    quantity: z.number().int().positive(),
    region: z.enum(starterRegionIds),
  });

  app.post(
    '/decision-execute',
    {
      preHandler: app.requireAuth,
    },
    async (request, reply) => {
      const parsed = decisionExecuteSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid decision execute payload.',
        });
      }

      try {
        return await executeDecision(app, {
          playerId: request.authUser!.id,
          strategy: parsed.data.strategy,
          resource: parsed.data.resource,
          quantity: parsed.data.quantity,
          region: parsed.data.region,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to execute decision.';
        const statusCode =
          message === 'Resource not found.' ||
          message === 'Resource is not tradable.' ||
          message === 'Not enough inventory to execute decision.' ||
          message === 'No recipe found for resource.' ||
          message === 'Input quantity too low for processing.' ||
          message === 'Output resource is not tradable.'
            ? 400
            : 500;

        return reply.code(statusCode).send({
          error: statusCode === 400 ? 'Bad Request' : 'Internal Server Error',
          message,
        });
      }
    },
  );

  app.get(
    '/decision-history',
    {
      preHandler: app.requireAuth,
    },
    async (request) => {
      const limitParam = request.query as { limit?: string };
      const limit = limitParam.limit ? parseInt(limitParam.limit, 10) : 20;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        return {
          history: [],
        };
      }

      return await getDecisionHistory(app, {
        playerId: request.authUser!.id,
        limit,
      });
    },
  );
};
