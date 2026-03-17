import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type VercelConfig = {
  framework: string;
  rewrites: Array<{
    source: string;
    destination: string;
  }>;
};

const vercelConfigPath = path.resolve(import.meta.dirname, '../vercel.json');
const vercelConfig = JSON.parse(
  readFileSync(vercelConfigPath, 'utf8'),
) as VercelConfig;

describe('Vercel deployment baseline', () => {
  it('keeps the frontend configured as a Vite project', () => {
    expect(vercelConfig.framework).toBe('vite');
  });

  it('rewrites SPA deep links to index.html', () => {
    expect(vercelConfig.rewrites).toEqual([
      {
        source: '/((?!.*\\.).*)',
        destination: '/index.html',
      },
    ]);
  });
});
