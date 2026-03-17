import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSource(pathFromWebRoot: string) {
  return readFileSync(resolve(process.cwd(), pathFromWebRoot), 'utf8');
}

describe('mobile layout guards', () => {
  it('keeps the fixed mobile nav safe-area aware', () => {
    const shellSource = readSource('src/app/shell.tsx');

    expect(shellSource).toContain('env(safe-area-inset-bottom)');
  });

  it('uses stacked mobile layouts for starter-loop action cards', () => {
    const dashboardSource = readSource('src/features/dashboard/DashboardPage.tsx');
    const marketSource = readSource('src/features/market/MarketPage.tsx');
    const onboardingSource = readSource('src/features/onboarding/OnboardingPage.tsx');

    expect(dashboardSource).toContain('flex flex-col gap-4 sm:flex-row');
    expect(marketSource).toContain('flex flex-col gap-3 sm:flex-row');
    expect(onboardingSource).toContain('flex flex-col gap-3 sm:flex-row');
  });
});
