import type { FastifyPluginAsync } from 'fastify';
import { getDashboardSnapshot } from './dashboard.service.js';
import { syncStarterTutorialProgress } from '../tutorial/tutorial.service.js';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      preHandler: app.requireAuth,
    },
    async (request) => {
      const snapshot = await getDashboardSnapshot(app, {
        playerId: request.authUser!.id,
      });

      if (snapshot.player && snapshot.inventory.length > 0) {
        await syncStarterTutorialProgress(app, {
          playerId: request.authUser!.id,
          markInventoryViewed: true,
        });
      }

      return snapshot;
    },
  );
};
