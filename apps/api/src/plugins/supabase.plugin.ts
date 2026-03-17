import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import {
  createSupabaseAdminClient,
  createSupabaseAuthClient,
} from '../db/client/supabase.js';

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type SupabaseAuthClient = ReturnType<typeof createSupabaseAuthClient>;

declare module 'fastify' {
  interface FastifyInstance {
    getSupabaseAdminClient(): SupabaseAdminClient;
    getSupabaseAuthClient(): SupabaseAuthClient;
  }
}

export const supabasePlugin: FastifyPluginAsync = fp(async (app) => {
  let adminClient: SupabaseAdminClient | null = null;
  let authClient: SupabaseAuthClient | null = null;

  app.decorate('getSupabaseAdminClient', () => {
    if (!adminClient) {
      adminClient = createSupabaseAdminClient();
    }

    return adminClient;
  });

  app.decorate('getSupabaseAuthClient', () => {
    if (!authClient) {
      authClient = createSupabaseAuthClient();
    }

    return authClient;
  });
});
