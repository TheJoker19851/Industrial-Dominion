import type { FastifyInstance } from 'fastify';
import { authPlugin } from './auth/auth.plugin.js';
import { authRoutes } from './auth/auth.routes.js';
import { bootstrapRoutes } from './bootstrap/bootstrap.routes.js';
import { buildingRoutes } from './buildings/buildings.routes.js';
import { dashboardRoutes } from './dashboard/dashboard.routes.js';
import { healthRoutes } from './health/health.routes.js';
import { ledgerRoutes } from './ledger/ledger.routes.js';
import { logisticsRoutes } from './logistics/logistics.routes.js';
import { marketRoutes } from './market/market.routes.js';
import { newsRoutes } from './news/news.routes.js';
import { productionRoutes } from './production/production.routes.js';
import { rootRoutes } from './root/root.routes.js';
import { tutorialRoutes } from './tutorial/tutorial.routes.js';
import { supabasePlugin } from '../plugins/supabase.plugin.js';

export async function registerModules(app: FastifyInstance) {
  await app.register(supabasePlugin);
  await app.register(authPlugin);
  await app.register(dashboardRoutes, { prefix: '/dashboard' });
  await app.register(ledgerRoutes, { prefix: '/ledger' });
  await app.register(logisticsRoutes, { prefix: '/logistics' });
  await app.register(marketRoutes, { prefix: '/market' });
  await app.register(newsRoutes, { prefix: '/news' });
  await app.register(productionRoutes, { prefix: '/production' });
  await app.register(tutorialRoutes, { prefix: '/tutorial' });
  await app.register(buildingRoutes, { prefix: '/buildings' });
  await app.register(bootstrapRoutes, { prefix: '/bootstrap' });
  await app.register(rootRoutes);
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(healthRoutes, { prefix: '/health' });
}
