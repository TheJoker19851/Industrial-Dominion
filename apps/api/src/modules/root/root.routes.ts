import type { FastifyPluginAsync } from 'fastify';

export const rootRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({
    name: 'industrial-dominion-api',
    status: 'ok',
  }));
};
