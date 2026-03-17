import type { DashboardSnapshot } from '@industrial-dominion/shared';

export type DashboardViewState =
  | 'needs_sign_in'
  | 'needs_bootstrap'
  | 'ready';

export function getDashboardViewState(
  input: {
    isAuthenticated: boolean;
    snapshot: DashboardSnapshot | null;
  },
): DashboardViewState {
  if (!input.isAuthenticated) {
    return 'needs_sign_in';
  }

  if (!input.snapshot?.player?.regionId) {
    return 'needs_bootstrap';
  }

  return 'ready';
}
