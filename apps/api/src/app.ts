import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerModules } from './modules/register-modules.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  void app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  void registerModules(app);

  return app;
}
