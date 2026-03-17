import { describe, expect, it } from 'vitest';
import { appNavigationItems } from '../src/app/navigation';

describe('app navigation baseline', () => {
  it('includes the core starter routes in shell order', () => {
    expect(appNavigationItems).toEqual([
      { to: '/', labelKey: 'navigation.dashboard' },
      { to: '/market', labelKey: 'navigation.market' },
      { to: '/onboarding', labelKey: 'navigation.onboarding' },
      { to: '/settings', labelKey: 'navigation.settings' },
    ]);
  });
});
