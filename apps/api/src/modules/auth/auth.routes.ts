import type { FastifyPluginAsync } from 'fastify';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/session',
    {
      preHandler: app.requireAuth,
    },
    async (request) => ({
      user: request.authUser,
    }),
  );
};
