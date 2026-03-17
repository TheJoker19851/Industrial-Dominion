export type AppNavigationItem = {
  to: string;
  labelKey: string;
};

export const appNavigationItems: AppNavigationItem[] = [
  {
    to: '/',
    labelKey: 'navigation.dashboard',
  },
  {
    to: '/market',
    labelKey: 'navigation.market',
  },
  {
    to: '/onboarding',
    labelKey: 'navigation.onboarding',
  },
  {
    to: '/settings',
    labelKey: 'navigation.settings',
  },
];
