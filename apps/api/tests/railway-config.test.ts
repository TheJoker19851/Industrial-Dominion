import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type RailwayConfig = {
  build: {
    builder: string;
    buildCommand: string;
    watchPatterns: string[];
  };
  deploy: {
    startCommand: string;
    healthcheckPath: string;
    restartPolicyType: string;
    restartPolicyMaxRetries: number;
  };
};

const railwayConfigPath = path.resolve(import.meta.dirname, '../railway.json');
const railwayConfig = JSON.parse(
  readFileSync(railwayConfigPath, 'utf8'),
) as RailwayConfig;

describe('Railway deployment baseline', () => {
  it('uses workspace-aware build and start commands for the API service', () => {
    expect(railwayConfig.build.builder).toBe('RAILPACK');
    expect(railwayConfig.build.buildCommand).toBe(
      'corepack pnpm --filter @industrial-dominion/api build',
    );
    expect(railwayConfig.deploy.startCommand).toBe(
      'corepack pnpm --filter @industrial-dominion/api start',
    );
  });

  it('keeps healthcheck and watch paths aligned with the monorepo layout', () => {
    expect(railwayConfig.deploy.healthcheckPath).toBe('/health');
    expect(railwayConfig.deploy.restartPolicyType).toBe('ON_FAILURE');
    expect(railwayConfig.deploy.restartPolicyMaxRetries).toBe(10);
    expect(railwayConfig.build.watchPatterns).toEqual(
      expect.arrayContaining([
        '/apps/api/**',
        '/packages/shared/**',
        '/packages/config/**',
        '/package.json',
        '/pnpm-lock.yaml',
        '/pnpm-workspace.yaml',
        '/turbo.json',
        '/tsconfig.base.json',
      ]),
    );
  });
});
