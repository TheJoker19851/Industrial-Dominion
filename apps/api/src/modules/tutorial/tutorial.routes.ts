import type { FastifyPluginAsync } from 'fastify';
import { getStarterTutorialProgress, skipStarterTutorial } from './tutorial.service.js';

export const tutorialRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      preHandler: app.requireAuth,
    },
    async (request) => getStarterTutorialProgress(app, request.authUser!.id),
  );

  app.post(
    '/skip',
    {
      preHandler: app.requireAuth,
    },
    async (request) => skipStarterTutorial(app, request.authUser!.id),
  );
};
