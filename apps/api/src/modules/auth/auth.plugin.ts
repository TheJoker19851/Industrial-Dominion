import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: {
      id: string;
      email?: string;
    } | null;
  }

  interface FastifyInstance {
    requireAuth: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void | FastifyReply>;
  }
}

function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest('authUser', null);

  app.decorate(
    'requireAuth',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = readBearerToken(request);

      if (!token) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing bearer token.',
        });
      }

      const supabase = app.getSupabaseAdminClient();
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired access token.',
        });
      }

      request.authUser = {
        id: data.user.id,
        email: data.user.email,
      };
    },
  );
});
